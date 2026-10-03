import { verifyM04PermissionEvidence } from '@nerva/db';
import { apiJson, withM03Database } from '../../../../../server/m03-api.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const correlationId =
    request.headers.get('x-correlation-id') ??
    `m04-evidence-${new URL(request.url).searchParams.get('requestId') ?? 'verify'}`;
  return withM03Database(
    {
      correlationId,
      unavailable: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Evidence verification is unavailable.',
      },
      failure: {
        code: 'M04_EVIDENCE_VERIFY_FAILED',
        message: 'The evidence chain could not be verified.',
      },
    },
    async (pool) => {
      const result = await verifyM04PermissionEvidence(pool);
      return apiJson(
        {
          schemaVersion: '0.1',
          status: result.verified ? 'VERIFIED' : 'FAILED',
          count: result.count,
          lastHash: result.lastHash,
          authority: 'INTEGRITY_ONLY',
          executionEnabled: false,
          correlationId,
        },
        result.verified ? 200 : 503,
      );
    },
  );
}
