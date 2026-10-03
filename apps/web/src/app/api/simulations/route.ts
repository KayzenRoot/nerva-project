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
    code: 'SIMULATION_REQUEST_INVALID',
    message: 'The simulation request is invalid.',
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
        code: 'SIMULATION_PERSISTENCE_UNAVAILABLE',
        message: 'The simulation could not be durably recorded.',
      },
    },
    async (pool) => {
      const now = new Date().toISOString();
      const result = await prepareCurrentM03Plan({
        pool,
        policyValue: parsed.data.policy,
        proofValue: parsed.data.proof,
        correlationId: correlation,
        now,
        simulate: true,
      });
      if (result.kind === 'INVALID')
        return apiError(result.status, result.code, 'The plan cannot be simulated.', correlation);
      if (result.kind === 'TRIGGER_REFUSED')
        return apiJson(
          {
            schemaVersion: '0.1',
            status: 'REFUSED',
            reason: result.evaluation.reason,
            correlationId: correlation,
            simulation: null,
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
            simulation: null,
          },
          409,
        );
      const simulation = result.simulation;
      if (!simulation)
        return apiError(
          503,
          'SIMULATION_RESULT_UNAVAILABLE',
          'The simulation could not be produced.',
          correlation,
        );
      return apiJson(
        {
          schemaVersion: '0.1',
          status: simulation.status,
          correlationId: result.plan.correlationId,
          planDigest: result.plan.digest,
          simulation,
          authority: simulation.authority,
          safety: { executionEnabled: false, providerPreflight: 'UNAVAILABLE_UNPROVEN' },
        },
        simulation.status === 'PASS' ? 201 : 409,
      );
    },
  );
}
