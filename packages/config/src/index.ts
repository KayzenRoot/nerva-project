import { z } from 'zod';
import type { SafetyEnvironment } from '@nerva/domain';

export const MONAD_NETWORKS = Object.freeze({
  monadMainnet: Object.freeze({ name: 'monad-mainnet', chainId: 143 as const }),
  monadTestnet: Object.freeze({ name: 'monad-testnet', chainId: 10_143 as const }),
});

const EnvironmentSchema = z.enum([
  'LOCAL',
  'TESTNET_DEMO',
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
  const databaseUrl =
    env.DATABASE_URL === undefined ? undefined : DatabaseUrlSchema.parse(env.DATABASE_URL);

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
