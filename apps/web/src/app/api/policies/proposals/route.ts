import { M03ProposalSchemaV0_1 } from '@nerva/contracts';
import { apiError, apiJson, correlationId, readM03Json } from '../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await readM03Json(request);
  const correlation = correlationId(request, body.ok ? body.value : undefined);
  if (!body.ok)
    return apiError(400, 'INVALID_JSON', 'A bounded JSON body is required.', correlation);
  const raw = body.value;
  const input =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const proposal = M03ProposalSchemaV0_1.safeParse({
    schemaVersion: '0.1',
    proposalId: `proposal-${correlation}`,
    source: input.source === 'STRUCTURED' ? 'STRUCTURED' : 'NATURAL_LANGUAGE',
    untrusted: true,
    ...(typeof input.languageInput === 'string' ? { languageInput: input.languageInput } : {}),
    proposedPolicy: input.proposedPolicy ?? null,
    diagnostics: ['UNTRUSTED_PROPOSAL_REQUIRES_DETERMINISTIC_COMPILATION_AND_ACTOR_CONFIRMATION'],
  });
  if (!proposal.success)
    return apiError(
      422,
      'PROPOSAL_INVALID',
      'The proposal is outside its bounded schema.',
      correlation,
    );
  return apiJson({ ...proposal.data, correlationId: correlation, authority: 'PROPOSAL_ONLY' }, 202);
}
