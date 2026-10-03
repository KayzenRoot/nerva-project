import {
  apiError,
  apiJson,
  M03PolicyOperationRequestSchema as RequestSchema,
  parseM03Request,
  trustedM03IssuerUnavailable,
  withM03Database,
} from '../../../server/m03-api.ts';
import { evaluateCurrentM03Policy } from '../../../server/m03-workflow.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, RequestSchema, {
    code: 'EVALUATION_REQUEST_INVALID',
    message: 'The policy evaluation request is invalid.',
  });
  if (!parsed.ok) return parsed.response;
  const correlation = parsed.correlationId;
  const issuerError = trustedM03IssuerUnavailable(correlation);
  if (issuerError) return issuerError;
  return withM03Database(
    {
      correlationId: correlation,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The current risk and policy stores are unavailable.',
      },
      failure: {
        code: 'EVALUATION_PERSISTENCE_UNAVAILABLE',
        message: 'The evaluation could not be durably recorded.',
      },
    },
    async (pool) => {
      const result = await evaluateCurrentM03Policy({
        pool,
        policyValue: parsed.data.policy,
        proofValue: parsed.data.proof,
        now: new Date().toISOString(),
      });
      if (!result.ok)
        return apiError(
          result.status,
          result.code,
          'The policy evaluation was refused.',
          correlation,
        );
      return apiJson({
        schemaVersion: '0.1',
        status: result.evaluation.result,
        correlationId: result.evaluation.correlationId,
        evaluation: result.evaluation,
        policyVersionHash: result.policy.compiled.canonicalHash,
        sourceSnapshotHash: result.risk.snapshotHash,
        authority: 'DETERMINISTIC_RISK_ONLY',
        safety: { executionEnabled: false },
      });
    },
  );
}
