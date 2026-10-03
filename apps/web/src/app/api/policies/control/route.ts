import { z } from 'zod';
import { M03PolicyControlProofSchemaV0_1 } from '@nerva/contracts';
import { appendM03PolicyLifecycleEvent, consumeM03Nonce, createDatabase } from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { apiError, apiJson, correlationId, readM03Json } from '../../../../server/m03-api.ts';
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
  const body = await readM03Json(request);
  const correlation = correlationId(request, body.ok ? body.value : undefined);
  if (!body.ok)
    return apiError(400, 'INVALID_JSON', 'A bounded JSON body is required.', correlation);
  const parsed = RequestSchema.safeParse(body.value);
  if (!parsed.success)
    return apiError(422, 'POLICY_CONTROL_INVALID', 'The control request is invalid.', correlation);
  if (parsed.data.correlationId !== correlation)
    return apiError(
      400,
      'CORRELATION_MISMATCH',
      'The body and request correlation identifiers must match.',
      correlation,
    );
  const config = loadServerConfig();
  if (!config.databaseUrl)
    return apiError(
      503,
      'DATABASE_UNAVAILABLE',
      'Policy control persistence is unavailable.',
      correlation,
    );
  const { pool } = createDatabase(config);
  try {
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
  } catch {
    return apiError(
      409,
      'POLICY_CONTROL_STATE_CONFLICT',
      'The policy control could not be applied to its current state.',
      correlation,
    );
  } finally {
    await pool.end();
  }
}
