import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

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
