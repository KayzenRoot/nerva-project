import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rootManifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const expectedPaths = [
  'apps/web',
  'apps/worker',
  'packages/domain',
  'packages/contracts',
  'packages/config',
  'packages/observability',
  'packages/db',
  'packages/testing',
  'packages/perpl',
  'packages/risk',
  'packages/policy',
  'packages/execution',
];
if (
  JSON.stringify([...rootManifest.workspaces].sort()) !== JSON.stringify([...expectedPaths].sort())
) {
  throw new Error('Workspace list differs from the M01-M03 implementation shape');
}

const manifests = new Map();
for (const workspace of expectedPaths) {
  const file = path.join(root, workspace, 'package.json');
  if (!fs.existsSync(file)) throw new Error(`Missing workspace manifest: ${workspace}`);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifests.set(manifest.name, { workspace, manifest });
}

const allManifests = [{ workspace: '.', manifest: rootManifest }, ...manifests.values()];
for (const { workspace, manifest } of allManifests) {
  const direct = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };
  for (const [name, version] of Object.entries(direct)) {
    if (String(version).startsWith('workspace:')) continue;
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version))) {
      throw new Error(`${workspace} has a non-exact direct dependency ${name}@${version}`);
    }
  }
}

const edges = new Map([...manifests.keys()].map((name) => [name, []]));
for (const [name, { workspace, manifest }] of manifests) {
  const internal = Object.keys(manifest.dependencies ?? {}).filter((dep) => manifests.has(dep));
  edges.set(name, internal);
  if (workspace === 'packages/domain' && Object.keys(manifest.dependencies ?? {}).length > 0) {
    throw new Error('The domain package must not have runtime dependencies');
  }
  if (workspace.startsWith('packages/') && workspace !== 'packages/domain') {
    const allowed = {
      'packages/contracts': ['@nerva/domain'],
      'packages/config': ['@nerva/domain'],
      'packages/observability': ['@nerva/domain'],
      'packages/db': ['@nerva/domain', '@nerva/config'],
      'packages/testing': ['@nerva/domain', '@nerva/contracts'],
      'packages/perpl': ['@nerva/domain'],
      'packages/risk': ['@nerva/domain'],
      'packages/policy': ['@nerva/domain', '@nerva/contracts'],
      'packages/execution': ['@nerva/domain', '@nerva/contracts', '@nerva/policy'],
    }[workspace];
    for (const dep of internal)
      if (!allowed.includes(dep)) throw new Error(`${workspace} may not depend on ${dep}`);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(name) {
  if (visiting.has(name)) throw new Error(`Workspace dependency cycle includes ${name}`);
  if (visited.has(name)) return;
  visiting.add(name);
  for (const dep of edges.get(name) ?? []) visit(dep);
  visiting.delete(name);
  visited.add(name);
}
for (const name of edges.keys()) visit(name);

console.log(
  JSON.stringify({
    ok: true,
    workspaces: expectedPaths.length,
    dependencyGraph: Object.fromEntries(edges),
  }),
);
