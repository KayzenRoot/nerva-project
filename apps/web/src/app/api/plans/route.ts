import {
  apiError,
  apiJson,
  M03PolicyOperationRequestSchema as RequestSchema,
  parseM03Request,
  trustedM03IssuerUnavailable,
  withM03Database,
} from '../../../server/m03-api.ts';
import { prepareCurrentM03Plan } from '../../../server/m03-workflow.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = await parseM03Request(request, RequestSchema, {
    code: 'PLAN_REQUEST_INVALID',
    message: 'The policy planning request is invalid.',
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
        code: 'PLAN_PERSISTENCE_UNAVAILABLE',
        message: 'The plan could not be durably recorded.',
      },
    },
    async (pool) => {
      const result = await prepareCurrentM03Plan({
        pool,
        policyValue: parsed.data.policy,
        proofValue: parsed.data.proof,
        correlationId: correlation,
        now: new Date().toISOString(),
        simulate: false,
      });
      if (result.kind === 'INVALID')
        return apiError(result.status, result.code, 'The policy cannot be planned.', correlation);
      if (result.kind === 'TRIGGER_REFUSED')
        return apiJson(
          {
            schemaVersion: '0.1',
            status: 'REFUSED',
            reason: result.evaluation.reason,
            correlationId: correlation,
            evaluation: result.evaluation,
          },
          409,
        );
      if (result.kind === 'PLAN_REFUSED')
        return apiJson(
          {
            schemaVersion: '0.1',
            status: 'REFUSED',
            reason: result.reason,
            correlationId: correlation,
            evaluation: result.evaluation,
          },
          409,
        );
      return apiJson(
        {
          schemaVersion: '0.1',
          status: 'PLANNED',
          correlationId: result.plan.correlationId,
          plan: result.plan,
          authority:
            result.plan.action === 'NO_ACTION'
              ? 'NO_FINANCIAL_EFFECT'
              : 'BOUNDED_TESTNET_PLAN_PENDING_SIMULATION_AND_PROOFS',
          safety: { executionEnabled: false },
        },
        201,
      );
    },
  );
}
