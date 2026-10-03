import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const policy = read('packages/policy/src/index.ts');
const execution = read('packages/execution/src/index.ts');
const contracts = read('packages/contracts/src/index.ts');
const config = read('packages/config/src/index.ts');
const schema = read('packages/db/src/schema.ts');
const permissions = read('packages/permissions/src/index.ts');
const m04Persistence = read('packages/db/src/m04.ts');
const m04Binding = read('apps/web/src/app/api/permissions/bind/route.ts');
const m04Grant = read('apps/web/src/app/api/permissions/grants/route.ts');
const m04Authorization = read('apps/web/src/app/api/permissions/authorize/route.ts');
const m04Delegate = read('apps/web/src/server/monad-testnet-rpc.ts');
const m04ReadRoute = read('apps/web/src/app/api/permissions/route.ts');
const m04Boundary = read('apps/web/src/app/api/executions/route.ts');
const mainnetBlock = /MAINNET_EXECUTION[\s\S]{0,180}disabled[\s\S]{0,80}startup refused/i.test(
  config,
);
if (!mainnetBlock) throw new Error('MAINNET_EXECUTION is not hard-blocked during configuration');
if (!contracts.includes("z.enum(['POSITION_ADVERSE_MOVE_BPS', 'PORTFOLIO_DRAWDOWN_BPS'])"))
  throw new Error('M03 trigger metrics include an unproven or unsupported signal');
if (!contracts.includes("z.enum(['REDUCE_POSITION', 'CLOSE_POSITION', 'NO_ACTION'])"))
  throw new Error('The M03 action allowlist differs from the admitted three values');
for (const forbidden of [
  'LIQUIDATION_DISTANCE',
  'LIQUIDATION_DISTANCE_BPS',
  'MAINTENANCE_MARGIN',
  'MARGIN_SAFETY',
  'FUNDING_DIRECTION',
]) {
  if (contracts.includes(`metric: z.literal('${forbidden}')`))
    throw new Error(`Unproven metric ${forbidden} can be compiled as a trigger`);
}
if (!policy.includes('MAINNET_EXECUTION_HARD_BLOCKED'))
  throw new Error('M03 planner lacks a mainnet hard block');
if (
  !execution.includes("input.plan.environment !== 'TESTNET'") ||
  !execution.includes("input.plan.network !== 'monad-testnet'") ||
  !execution.includes('input.plan.chainId !== 10_143')
)
  throw new Error('M03 dispatch does not independently hard-block mainnet and non-testnet');
if (
  !policy.includes("authority: 'DRY_RUN_ONLY'") ||
  !execution.includes('PROVIDER_PREFLIGHT_UNAVAILABLE')
)
  throw new Error('Dry-run evidence can be mistaken for provider preflight');
if (!execution.includes('NO_DOCUMENTED_PROTECTIVE_ONLY_PERPL_SCOPE'))
  throw new Error('An unproven Perpl protective-only write scope is not refused');
if (
  !execution.includes('KILL_SWITCH_WON_BEFORE_SUBMISSION') ||
  !execution.includes('KILL_SWITCH_ENABLED_BEFORE_AUTHORIZATION')
)
  throw new Error('Kill switch is not rechecked before authorization and submission');
if (
  !execution.includes('runIfDisabled') ||
  !execution.includes('ATOMIC_GATE_OR_SUBMISSION_RESULT_AMBIGUOUS_NO_RETRY')
)
  throw new Error('Provider dispatch is not serialized with the durable kill-switch gate');
if (
  !execution.includes(
    "input.nonceLedger.consume(auth.issuer, auth.nonce, 'execution-authorization')",
  ) ||
  !execution.includes(
    "input.nonceLedger.consume(enrollment.issuer, enrollment.nonce, 'provider-enrollment')",
  )
)
  throw new Error('Authorization and provider-enrollment proof replay is not blocked durably');
if (
  !execution.includes('function isDocumentedProtectiveOnlyScope') ||
  !execution.includes('!enrollment.scopes.every(isDocumentedProtectiveOnlyScope)')
)
  throw new Error('An undocumented provider write scope has been admitted');
if (!execution.includes('AMBIGUOUS_PROVIDER_OUTCOME_NO_RETRY'))
  throw new Error('Ambiguous provider outcome does not require no-retry recovery');
if ((execution.match(/\.submitProtective\(command\)/g) ?? []).length !== 1)
  throw new Error('Effect adapter must have exactly one bounded provider submission call');
if (/(?:api[_-]?key|secret|signature|private|mnemonic|seedphrase|seed_phrase)/i.test(schema))
  throw new Error('M03 database schema contains credential-shaped column identifiers');
if (
  !schema.includes("'UNAVAILABLE_UNPROVEN'") &&
  !read('packages/risk/src/engine.ts').includes('UNAVAILABLE_UNPROVEN')
)
  throw new Error('Risk state lost the UNAVAILABLE_UNPROVEN limitation');

if (
  !permissions.includes('MONAD_TESTNET_CHAIN_ID = 10_143') ||
  !permissions.includes("type M04Action = 'REDUCE_POSITION' | 'CLOSE_POSITION' | 'NO_ACTION'") ||
  !permissions.includes('compileCapabilityGrant') ||
  !permissions.includes('verifyGrantApproval') ||
  !permissions.includes('verifyAuthorization') ||
  !permissions.includes('verifyGrantRevocation') ||
  !permissions.includes('deriveSessionAuthority') ||
  !permissions.includes('verifyPermissionEvidenceChain')
)
  throw new Error(
    'M04 deterministic identity, grant, signature, session, revocation or evidence controls are incomplete',
  );
if (
  !permissions.includes("status: 'UNKNOWN'") ||
  !permissions.includes('FINALIZED_BLOCK_CHANGED_DURING_READ') ||
  !m04Delegate.includes("'finalized'") ||
  !m04Delegate.includes('requireCanonical: true')
)
  throw new Error('M04 EIP-7702 observation does not fail closed on uncertain finalized state');
if (
  !m04Persistence.includes('FOR UPDATE OF s') ||
  !m04Persistence.includes('m04_nonce_ledger') ||
  !m04Persistence.includes('generation=') ||
  !m04Persistence.includes('m04_permission_evidence_head')
)
  throw new Error('M04 persistence lacks durable nonce, revocation or evidence serialization');
if (
  !m04Binding.includes('AWAITING_OWNER_SIGNATURE') ||
  !m04Grant.includes('AWAITING_OWNER_SIGNATURE') ||
  !m04Authorization.includes('AWAITING_OWNER_SIGNATURE')
)
  throw new Error(
    'M04 external EIP-712 signing flow does not expose an owner-controlled typed-data challenge',
  );
if (
  !m04ReadRoute.includes('verifyWalletReadAuthorization') ||
  !m04ReadRoute.includes('consumeM04ReadAccess') ||
  m04ReadRoute.indexOf('const proof = await verifyWalletReadAuthorization') >
    m04ReadRoute.indexOf('listM04PermissionReadModel(pool')
)
  throw new Error(
    'M04 private account read model is not gated by a signed, durable owner read proof',
  );
if (
  !m04Boundary.includes('validateM04AuthorizationRef') ||
  !m04Boundary.includes('M04_AUTHORIZATION_INVALID_OR_REVOKED')
)
  throw new Error('M03 execution boundary does not revalidate current M04 authority');
const m04EffectSource = [
  permissions,
  m04Binding,
  m04Grant,
  m04Authorization,
  m04Delegate,
  m04ReadRoute,
].join('\n');
if (
  /(?:eth_sendTransaction|eth_sendRawTransaction|sendTransaction\s*\(|signTransaction\s*\(|\.submitProtective\s*\()/i.test(
    m04EffectSource,
  )
)
  throw new Error('M04 wallet/permission code contains an effectful transaction path');
if (
  /process\.env\.(?:PRIVATE|SEED|MNEMONIC)|(?:privateKey|seedPhrase|mnemonic)\s*=/i.test(
    m04EffectSource,
  )
)
  throw new Error('M04 wallet/permission code accesses or holds wallet secret material');

const workspaces = JSON.parse(read('package.json')).workspaces;
for (const relative of ['packages/policy', 'packages/execution', 'packages/permissions']) {
  if (!workspaces.includes(relative)) throw new Error(`${relative} is not in the workspace graph`);
}
const forbiddenProviderWrite =
  /(?:\/v1\/trading\/orders?|\bOrderRequest\b|\bmt\s*:\s*(?:22|30|31)\b|\bmethod\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"])/i;
const perplSources = [];
function collect(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.join(root, directory, entry.name);
    if (entry.isDirectory()) collect(path.relative(root, file));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(file) && !file.endsWith('.test.ts'))
      perplSources.push(fs.readFileSync(file, 'utf8'));
  }
}
collect('packages/perpl/src');
if (forbiddenProviderWrite.test(perplSources.join('\n')))
  throw new Error('M03 expanded the M02 Perpl observation adapter with a trade/write path');

console.log(
  JSON.stringify({
    ok: true,
    m03ActionAllowlist: ['REDUCE_POSITION', 'CLOSE_POSITION', 'NO_ACTION'],
    unprovenMetricsCanAuthorize: false,
    mainnetEffect: 'HARD_BLOCKED',
    perplWriteAdapter: 'NOT_IMPLEMENTED_SCOPE_UNPROVEN',
    m04MainnetEffect: 'HARD_BLOCKED',
    m04LivePerplEffect: 'BLOCKED',
    m04CredentialCustody: 'NONE',
    m04Eip7702Mode: 'READ_ONLY_FINALIZED_BLOCK',
    protectiveOnlyScope: 'UNAVAILABLE_UNPROVEN',
    ambiguousRetry: 'BLOCKED',
  }),
);
