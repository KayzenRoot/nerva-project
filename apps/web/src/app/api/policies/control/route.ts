import { z } from 'zod';
import { M03PolicyControlProofSchemaV0_1 } from '@nerva/contracts';
import { appendM03PolicyLifecycleEvent, consumeM03Nonce } from '@nerva/db';
import { apiError, apiJson, parseM03Request, withM03Database } from '../../../../server/m03-api.ts';
import { verifyM03PolicyControlProof } from '../../../../server/m03-trust.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    proof: M03PolicyControlProofSchemaV0_1,
    correlationId: z.string().min(1).max(200),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, RequestSchema, {
    code: 'POLICY_CONTROL_INVALID',
    message: 'The control request is invalid.',
  });
  if (!parsed.ok) return parsed.response;
  const correlation = parsed.correlationId;
  return withM03Database(
    {
      correlationId: correlation,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Policy control persistence is unavailable.',
      },
      failure: {
        code: 'POLICY_CONTROL_STATE_CONFLICT',
        message: 'The policy control could not be applied to its current state.',
      },
    },
    async (pool) => {
      const proof = parsed.data.proof;
      const current = await pool.query<{ content_hash: string; state: string }>(
        `SELECT v.content_hash,p.state FROM policy_versions v JOIN policies p ON p.policy_id=v.policy_id
       WHERE v.policy_id=$1 ORDER BY v.version DESC LIMIT 1`,
        [proof.policyId],
      );
      const row = current.rows[0];
      if (!row || row.content_hash !== proof.policyVersionHash)
        return apiError(
          409,
          'POLICY_VERSION_MISMATCH',
          'The proof does not bind to the current policy version.',
          correlation,
        );
      if (!['ACTIVE', 'PAUSED'].includes(row.state))
        return apiError(
          409,
          'POLICY_NOT_CONTROLLABLE',
          'The policy lifecycle state does not allow this control.',
          correlation,
        );
      const verified = await verifyM03PolicyControlProof(proof, {
        policyId: proof.policyId,
        policyVersionHash: row.content_hash,
        now: new Date().toISOString(),
      });
      if (!verified)
        return apiError(
          403,
          'POLICY_CONTROL_PROVENANCE_INVALID',
          'A trusted, current actor proof is required.',
          correlation,
        );
      if (
        !(await consumeM03Nonce(pool, {
          issuer: verified.issuerId,
          nonce: verified.nonce,
          purpose: 'policy-control',
        }))
      )
        return apiError(
          409,
          'POLICY_CONTROL_REPLAY',
          'The actor proof nonce was already consumed.',
          correlation,
        );
      await appendM03PolicyLifecycleEvent(pool, {
        policyId: proof.policyId,
        policyVersionHash: proof.policyVersionHash,
        action: proof.action,
        actorRef: verified.actorId,
        issuerRef: verified.issuerId,
        proofRefHash: verified.proofRefHash,
        correlationId: correlation,
        occurredAt: new Date().toISOString(),
      });
      return apiJson({
        schemaVersion: '0.1',
        status: proof.action === 'PAUSE' ? 'PAUSED' : 'REVOKED',
        correlationId: correlation,
        policyId: proof.policyId,
        policyVersionHash: proof.policyVersionHash,
        actorRef: verified.actorId,
        proofRefHash: verified.proofRefHash,
        executionEnabled: false,
      });
    },
  );
}
