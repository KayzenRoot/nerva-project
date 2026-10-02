import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbidden =
  /^(?:ethers|viem|web3|wagmi|@metamask\/|@perpl\/|@envio\/|envio|openai|@openai\/|ai|@ai-sdk\/|@privy-io\/|@walletconnect\/)/i;
const manifests = [
  'package.json',
  ...['apps', 'packages'].flatMap((folder) =>
    fs
      .readdirSync(path.join(root, folder), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${folder}/${entry.name}/package.json`),
  ),
];
for (const file of manifests) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (forbidden.test(name))
        throw new Error(`Forbidden integration dependency ${name} in ${file}`);
    }
  }
}

const sourceRoots = ['apps', 'packages'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const ignoredDirectories = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);
const forbiddenCode =
  /(?:eth_sendRawTransaction|eth_sendTransaction|sendTransaction\s*\(|signTransaction\s*\(|wallet\.sign|process\.env\.(?:PRIVATE|SEED|MNEMONIC)|const\s+(?:privateKey|seedPhrase|mnemonic)\s*=)/i;
const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) collect(file);
    else if (sourceExtensions.has(path.extname(file)) && !file.endsWith('.test.ts'))
      files.push(file);
  }
}
for (const folder of sourceRoots) collect(path.join(root, folder));
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const importStrings = [...text.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  for (const specifier of importStrings)
    if (forbidden.test(specifier))
      throw new Error(`Forbidden runtime import ${specifier} in ${path.relative(root, file)}`);
  if (forbiddenCode.test(text))
    throw new Error(
      `M01 source contains a signing/submission or secret-material path: ${path.relative(root, file)}`,
    );
}
console.log(
  JSON.stringify({
    ok: true,
    manifests: manifests.length,
    sourceFiles: files.length,
    forbiddenImports: 0,
    executionPaths: 0,
  }),
);
