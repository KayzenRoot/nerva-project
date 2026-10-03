import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbidden =
  /^(?:ethers|web3|wagmi|@metamask\/|@perpl\/|@envio\/|envio|openai|@openai\/|ai|@ai-sdk\/|@privy-io\/|@walletconnect\/)/i;
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
      if (
        name === 'viem' &&
        file === 'packages/permissions/package.json' &&
        manifest[field][name] === '2.57.2'
      )
        continue;
      if (name === 'viem')
        throw new Error(
          `viem is allowed only as an exact dependency of packages/permissions: ${file}`,
        );
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
const forbiddenPerplCapability =
  /(?:\/v1\/trading\/orders?|\bOrderRequest\b|\bmt\s*:\s*(?:22|30|31)\b|\bmethod\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"])/i;
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
    if (
      forbidden.test(specifier) ||
      (specifier === 'viem' &&
        !path.relative(root, file).replaceAll('\\', '/').startsWith('packages/permissions/'))
    )
      throw new Error(`Forbidden runtime import ${specifier} in ${path.relative(root, file)}`);
  if (forbiddenCode.test(text))
    throw new Error(
      `M01 source contains a signing/submission or secret-material path: ${path.relative(root, file)}`,
    );
}
const perplSources = files.filter((file) =>
  path.relative(root, file).replaceAll('\\', '/').startsWith('packages/perpl/'),
);
const perplText = perplSources.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
if (forbiddenPerplCapability.test(perplText))
  throw new Error(
    'Perpl observation adapter contains an order/write capability or trade-scope message',
  );
if (!/readonly\s+method:\s*'GET'/.test(perplText) || !/method:\s*'GET'/.test(perplText))
  throw new Error('Perpl authenticated REST adapter must expose and send only GET');
if (!/Object\.freeze\(\{\s*mt:\s*5,/.test(perplText) || !/mt:\s*29,/.test(perplText))
  throw new Error(
    'Perpl WebSocket may send public subscription and read-only API sign-in frames only',
  );
const mutatingRoutes = [];
const allowedMutatingRoutes = new Set([
  'policies/proposals/route.ts',
  'policies/compile/route.ts',
  'policies/confirm/route.ts',
  'policies/control/route.ts',
  'evaluations/route.ts',
  'plans/route.ts',
  'simulations/route.ts',
  'executions/route.ts',
  'executions/[attemptId]/recovery/route.ts',
  'permissions/bind/route.ts',
  'permissions/agents/route.ts',
  'permissions/grants/route.ts',
  'permissions/delegation/route.ts',
  'permissions/authorize/route.ts',
  'permissions/sessions/route.ts',
  'permissions/sessions/revoke/route.ts',
  'permissions/revoke/route.ts',
  'permissions/unbind/route.ts',
  'permissions/route.ts',
]);
const apiRoot = path.join(root, 'apps/web/src/app/api');
if (fs.existsSync(apiRoot)) {
  for (const file of files) {
    const relative = path.relative(apiRoot, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
      continue;
    const source = fs.readFileSync(file, 'utf8');
    if (/export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(source)) {
      const apiRelative = relative.replaceAll('\\', '/');
      if (!allowedMutatingRoutes.has(apiRelative)) mutatingRoutes.push(path.relative(root, file));
    }
  }
}
if (mutatingRoutes.length > 0)
  throw new Error(`API contains an unadmitted mutating route: ${mutatingRoutes.join(', ')}`);
const mutationRouteFiles = [...allowedMutatingRoutes].map((route) => path.join(apiRoot, route));
for (const route of mutationRouteFiles) {
  if (!fs.existsSync(route)) continue;
  const source = fs.readFileSync(route, 'utf8');
  const isPermissionRoute = path
    .relative(apiRoot, route)
    .replaceAll('\\', '/')
    .startsWith('permissions/');
  const guarded = isPermissionRoute
    ? /M04|m04|@nerva\/permissions|@nerva\/db/.test(source)
    : /M03|m03|@nerva\/(?:policy|execution)/.test(source);
  if (!guarded)
    throw new Error(
      `Mutating route is missing its owning trust boundary: ${path.relative(root, route)}`,
    );
}
console.log(
  JSON.stringify({
    ok: true,
    manifests: manifests.length,
    sourceFiles: files.length,
    forbiddenImports: 0,
    executionPaths: 0,
    perplRestMethods: ['GET'],
    perplWebSocketOutboundMessageTypes: [5, 29],
    mutatingApiRoutes: mutationRouteFiles.filter((route) => fs.existsSync(route)).length,
  }),
);
