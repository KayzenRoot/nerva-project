import { z } from 'zod';
import type { SafetyEnvironment } from '@nerva/domain';

export const MONAD_NETWORKS = Object.freeze({
  monadMainnet: Object.freeze({ name: 'monad-mainnet', chainId: 143 as const }),
  monadTestnet: Object.freeze({ name: 'monad-testnet', chainId: 10_143 as const }),
});

const EnvironmentSchema = z.enum([
  'LOCAL',
  'TESTNET_DEMO',
  'TESTNET',
  'MAINNET_READONLY',
  'MAINNET_EXECUTION',
]);
const BooleanSettingSchema = z.enum(['true', 'false']).transform((value) => value === 'true');
const DatabaseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => /^postgres(?:ql)?:\/\//.test(value), 'DATABASE_URL must be a PostgreSQL URL');

export interface ServerConfig {
  readonly environment: SafetyEnvironment;
  readonly executionEnabled: false;
  readonly killSwitchEnabled: boolean;
  readonly demoSimulationEnabled: boolean;
  readonly databaseUrl?: string;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug';
  readonly networks: typeof MONAD_NETWORKS;
}

export interface PublicConfig {
  readonly environment: Exclude<SafetyEnvironment, 'MAINNET_EXECUTION'>;
  readonly executionEnabled: false;
  readonly demoSimulationEnabled: boolean;
}

export interface PerplServerConfig {
  readonly enabled: boolean;
  readonly network: 'monad-mainnet' | 'monad-testnet';
  readonly chainId: 143 | 10_143;
  readonly apiUrl: string;
  readonly wsUrl: string;
  readonly marketFreshnessMs: number;
  readonly accountFreshnessMs: number;
  readonly reconnectMinMs: number;
  readonly reconnectMaxMs: number;
  readonly credentials?: Readonly<{ apiKey: string; keySecretHex: string; scope: 'read' }>;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  max: number,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > max)
    throw new Error(`${label} must be an integer in [100, ${max}]`);
  return parsed;
}

export function loadPerplConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  environment: SafetyEnvironment = (env.NERVA_ENVIRONMENT as SafetyEnvironment | undefined) ??
    'LOCAL',
): PerplServerConfig {
  const requestedChain =
    env.PERPL_CHAIN_ID === undefined
      ? environment === 'TESTNET_DEMO' || environment === 'TESTNET'
        ? 10_143
        : 143
      : Number(env.PERPL_CHAIN_ID);
  if (requestedChain !== 143 && requestedChain !== 10_143)
    throw new Error('PERPL_CHAIN_ID must be Monad mainnet 143 or testnet 10143');
  const chainId = requestedChain as 143 | 10_143;
  if (
    ((environment === 'TESTNET_DEMO' || environment === 'TESTNET') && chainId !== 10_143) ||
    (environment === 'MAINNET_READONLY' && chainId !== 143)
  )
    throw new Error('Perpl chain identity does not match NERVA environment network');
  const network = chainId === 143 ? 'monad-mainnet' : 'monad-testnet';
  const hostname = chainId === 143 ? 'app.perpl.xyz' : 'testnet.perpl.xyz';
  const defaultOrigin = `https://${hostname}`;
  const apiUrl = new URL(env.PERPL_API_URL ?? `${defaultOrigin}/api`);
  const wsUrl = new URL(env.PERPL_WS_URL ?? `wss://${hostname}`);
  if (
    apiUrl.protocol !== 'https:' ||
    wsUrl.protocol !== 'wss:' ||
    apiUrl.hostname !== hostname ||
    wsUrl.hostname !== hostname ||
    apiUrl.pathname.replace(/\/$/, '') !== '/api'
  )
    throw new Error('Perpl URLs must be secure and match the configured Monad network');
  const enabled = BooleanSettingSchema.parse(env.PERPL_OBSERVATION_ENABLED ?? 'false');
  const anyCredential = [env.PERPL_API_KEY, env.PERPL_API_KEY_SECRET, env.PERPL_API_KEY_SCOPE].some(
    (value) => value !== undefined,
  );
  let credentials: PerplServerConfig['credentials'];
  if (anyCredential) {
    if (!env.PERPL_API_KEY || !env.PERPL_API_KEY_SECRET || !env.PERPL_API_KEY_SCOPE)
      throw new Error(
        'Perpl authenticated mode requires the complete API key, secret and scope set',
      );
    if (env.PERPL_API_KEY_SCOPE !== 'read')
      throw new Error('Only the exact Perpl API key scope read is admitted');
    if (!/^(?:0x)?[0-9a-f]{64}$/i.test(env.PERPL_API_KEY_SECRET))
      throw new Error('Perpl read-only API secret must be a 32-byte hex value');
    credentials = Object.freeze({
      apiKey: env.PERPL_API_KEY,
      keySecretHex: env.PERPL_API_KEY_SECRET,
      scope: 'read',
    });
  }
  const marketFreshnessMs = boundedInteger(
    env.PERPL_MARKET_FRESHNESS_MS,
    5_000,
    'PERPL_MARKET_FRESHNESS_MS',
    300_000,
  );
  const accountFreshnessMs = boundedInteger(
    env.PERPL_ACCOUNT_FRESHNESS_MS,
    15_000,
    'PERPL_ACCOUNT_FRESHNESS_MS',
    300_000,
  );
  const reconnectMinMs = boundedInteger(
    env.PERPL_RECONNECT_MIN_MS,
    250,
    'PERPL_RECONNECT_MIN_MS',
    30_000,
  );
  const reconnectMaxMs = boundedInteger(
    env.PERPL_RECONNECT_MAX_MS,
    30_000,
    'PERPL_RECONNECT_MAX_MS',
    60_000,
  );
  if (reconnectMaxMs < reconnectMinMs)
    throw new Error('Perpl maximum reconnect delay must be >= minimum delay');
  return Object.freeze({
    enabled,
    network,
    chainId,
    apiUrl: apiUrl.toString().replace(/\/$/, ''),
    wsUrl: wsUrl.toString().replace(/\/$/, ''),
    marketFreshnessMs,
    accountFreshnessMs,
    reconnectMinMs,
    reconnectMaxMs,
    ...(credentials ? { credentials } : {}),
  });
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ServerConfig {
  const environment = EnvironmentSchema.parse(env.NERVA_ENVIRONMENT ?? 'LOCAL');
  if (environment === 'MAINNET_EXECUTION')
    throw new Error('MAINNET_EXECUTION is disabled in M01; startup refused');

  const executionRequested = BooleanSettingSchema.parse(env.NERVA_EXECUTION_ENABLED ?? 'false');
  if (executionRequested)
    throw new Error('Execution capability is disabled in M01; startup refused');

  const killSwitchEnabled = BooleanSettingSchema.parse(env.NERVA_KILL_SWITCH_ENABLED ?? 'true');
  const demoSimulationEnabled = BooleanSettingSchema.parse(
    env.NERVA_DEMO_SIMULATION_ENABLED ?? 'false',
  );
  const logLevel = z
    .enum(['fatal', 'error', 'warn', 'info', 'debug'])
    .default('info')
    .parse(env.NERVA_LOG_LEVEL);
  const databaseUrlCandidate = env.DATABASE_URL ?? env.POSTGRES_URL;
  const databaseUrl =
    databaseUrlCandidate === undefined ? undefined : DatabaseUrlSchema.parse(databaseUrlCandidate);

  return Object.freeze({
    environment,
    executionEnabled: false,
    killSwitchEnabled,
    demoSimulationEnabled,
    ...(databaseUrl ? { databaseUrl } : {}),
    logLevel,
    networks: MONAD_NETWORKS,
  });
}

export function publicConfig(config: ServerConfig): PublicConfig {
  if (config.environment === 'MAINNET_EXECUTION')
    throw new Error('MAINNET_EXECUTION is not a public M01 environment');
  return Object.freeze({
    environment: config.environment,
    executionEnabled: false,
    demoSimulationEnabled: config.demoSimulationEnabled,
  });
}
