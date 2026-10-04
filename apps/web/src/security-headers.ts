export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nonce)) throw new Error('CSP nonce must be base64');

  const developmentConnectSources = isDevelopment ? ' ws://127.0.0.1:*' : '';
  const developmentEval = isDevelopment ? " 'unsafe-eval'" : '';
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentEval}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${developmentConnectSources}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (isDevelopment) {
    directives.push("style-src-elem 'self' 'unsafe-inline'");
    directives.push("style-src-attr 'unsafe-inline'");
  }
  return directives.join('; ');
}
