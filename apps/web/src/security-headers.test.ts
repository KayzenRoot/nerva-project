import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from './security-headers.ts';

describe('M06 browser security policy', () => {
  it('allows only the per-request nonce for production inline code', () => {
    const policy = buildContentSecurityPolicy('bmVydmEtY3NwLW5vbmNl', false);
    expect(policy).toContain("script-src 'self' 'nonce-bmVydmEtY3NwLW5vbmNl' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-bmVydmEtY3NwLW5vbmNl'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
  });

  it('limits development exceptions to the local toolchain', () => {
    const policy = buildContentSecurityPolicy('bmVydmEtY3NwLW5vbmNl', true);
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).toContain('ws://127.0.0.1:*');
    expect(policy).not.toContain('ws://*');
  });

  it('rejects malformed nonces rather than interpolating arbitrary policy text', () => {
    expect(() => buildContentSecurityPolicy("nonce'; script-src *", false)).toThrow(
      'CSP nonce must be base64',
    );
  });
});
