import { NextRequest, NextResponse } from 'next/server';
import { resolveLocale } from './app/i18n.ts';

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    'x-nerva-locale',
    resolveLocale(request.nextUrl.searchParams.get('lang') ?? undefined),
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
