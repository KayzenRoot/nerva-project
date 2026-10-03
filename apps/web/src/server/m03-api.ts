import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createDatabase } from '@nerva/db';
import { loadServerConfig } from '@nerva/config';
import { z } from 'zod';

const correlationPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export async function readM03Json(
  request: Request,
): Promise<Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false }>> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > 64_000) return { ok: false };
  try {
    const text = await request.text();
    if (text.length > 64_000) return { ok: false };
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export type ParsedM03Request<TSchema extends z.ZodTypeAny> =
  | Readonly<{ ok: true; data: z.infer<TSchema>; correlationId: string }>
  | Readonly<{ ok: false; response: NextResponse }>;

export async function parseM03Request<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
  invalid: Readonly<{ code: string; message: string }>,
): Promise<ParsedM03Request<TSchema>> {
  const body = await readM03Json(request);
  const correlation = correlationId(request, body.ok ? body.value : undefined);
  if (!body.ok)
    return {
      ok: false,
      response: apiError(400, 'INVALID_JSON', 'A bounded JSON body is required.', correlation),
    };
  const parsed = schema.safeParse(body.value);
  if (!parsed.success)
    return { ok: false, response: apiError(422, invalid.code, invalid.message, correlation) };
  const suppliedCorrelation = (parsed.data as { readonly correlationId?: unknown }).correlationId;
  if (suppliedCorrelation !== correlation)
    return {
      ok: false,
      response: apiError(
        400,
        'CORRELATION_MISMATCH',
        'The body and request correlation identifiers must match.',
        correlation,
      ),
    };
  return { ok: true, data: parsed.data, correlationId: correlation };
}

type M03Pool = ReturnType<typeof createDatabase>['pool'];

export async function withM03Database(
  options: Readonly<{
    correlationId: string;
    unavailable: Readonly<{ code: string; message: string }>;
    failure: Readonly<{ code: string; message: string }>;
    onError?: (error: unknown) => Response;
  }>,
  operation: (pool: M03Pool) => Promise<Response>,
): Promise<Response> {
  let pool: M03Pool | undefined;
  try {
    const config = loadServerConfig();
    if (!config.databaseUrl)
      return apiError(
        503,
        options.unavailable.code,
        options.unavailable.message,
        options.correlationId,
      );
    pool = createDatabase(config).pool;
    return await operation(pool);
  } catch (error) {
    return (
      options.onError?.(error) ??
      apiError(503, options.failure.code, options.failure.message, options.correlationId)
    );
  } finally {
    await pool?.end();
  }
}

export function correlationId(request: Request, body: unknown): string {
  const bodyValue =
    body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).correlationId
      : undefined;
  const header = request.headers.get('x-correlation-id') ?? undefined;
  const value = typeof bodyValue === 'string' ? bodyValue : header;
  return typeof value === 'string' && correlationPattern.test(value)
    ? value
    : `m03-${randomUUID()}`;
}

export function apiError(status: number, code: string, message: string, correlation: string) {
  return NextResponse.json(
    { schemaVersion: '0.1', error: { code, message }, correlationId: correlation },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
