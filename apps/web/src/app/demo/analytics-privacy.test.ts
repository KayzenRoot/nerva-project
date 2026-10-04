import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('M05 demo privacy boundary', () => {
  it('does not call APIs, provider code, or persistence from the demo route and model', async () => {
    const files = [
      new URL('./demo-view.tsx', import.meta.url),
      new URL('./demo-model.ts', import.meta.url),
    ];
    const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));
    const source = sources.join('\n');
    expect(source).not.toMatch(
      /fetch\s*\(|\b(?:createDatabase|pool\.query|localStorage|sessionStorage)\b/,
    );
    expect(source).not.toMatch(/(?:0x[a-fA-F0-9]{64}|mnemonic|seed phrase|private key)/i);
    expect(source).not.toMatch(/(?:transactionHash|blockNumber|providerReceipt|confirmedOnChain)/i);
  });
});
