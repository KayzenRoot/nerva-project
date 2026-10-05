import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveLocale } from './app/i18n.ts';
import { buildContentSecurityPolicy } from './security-headers.ts';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString('base64');
  const policy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
  const requestHeaders = new Headers(request.headers);
  const locale = resolveLocale(
    request.nextUrl.searchParams.get('lang') ?? request.headers.get('x-nerva-locale') ?? undefined,
  );
  requestHeaders.set('x-nerva-locale', locale);
  requestHeaders.set('x-nerva-csp-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
