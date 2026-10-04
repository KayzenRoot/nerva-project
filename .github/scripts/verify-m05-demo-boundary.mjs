import { readFile } from 'node:fs/promises';

const paths = [
  'apps/web/src/app/demo/page.tsx',
  'apps/web/src/app/demo/demo-copy.ts',
  'apps/web/src/app/demo/demo-view.tsx',
  'apps/web/src/app/demo/demo-model.ts',
];
const forbidden = [
  /from\s+['"](?:@nerva\/(?:db|execution|permissions|perpl)|\.\.\/api)/,
  /fetch\s*\(/,
  /(?:createDatabase|pool\.query|localStorage|sessionStorage)\b/,
  /(?:transactionHash|providerReceipt|confirmedOnChain|eth_sendTransaction)/i,
  /(?:private key|seed phrase|mnemonic)/i,
];

const sources = await Promise.all(paths.map((path) => readFile(path, 'utf8')));
for (const [index, source] of sources.entries()) {
  const path = paths[index];
  for (const pattern of forbidden) {
    if (pattern.test(source)) throw new Error(`DEMO_BOUNDARY_VIOLATION:${path}:${pattern}`);
  }
}
console.log(
  'M05 DEMO_ONLY boundary PASS: no provider, database, wallet, or effect path in demo source.',
);
