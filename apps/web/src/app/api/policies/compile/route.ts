import { compileM03Policy } from '@nerva/policy';
import { apiError, apiJson, correlationId, readM03Json } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await readM03Json(request);
  const correlation = correlationId(request, body.ok ? body.value : undefined);
  if (!body.ok)
    return apiError(400, 'INVALID_JSON', 'A bounded JSON body is required.', correlation);
  const input =
    body.value !== null && typeof body.value === 'object' && !Array.isArray(body.value)
      ? (body.value as Record<string, unknown>).policy
      : undefined;
  const result = await compileM03Policy(input);
  if (!result.ok || !result.policy)
    return apiJson(
      {
        schemaVersion: '0.1',
        status: 'INVALID',
        correlationId: correlation,
        diagnostics: result.diagnostics,
      },
      422,
    );
  return apiJson({
    schemaVersion: '0.1',
    status: 'COMPILED_UNCONFIRMED',
    correlationId: correlation,
    policyId: result.policy.policyId,
    version: result.policy.version,
    policyVersionHash: result.policy.canonicalHash,
    canonicalPolicy: result.policy.policy,
    authority: 'VALIDATION_ONLY',
  });
}
