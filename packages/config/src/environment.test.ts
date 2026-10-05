import { describe, expect, it } from 'vitest';
import { loadPerplConfig, loadServerConfig, publicConfig } from './index.js';

describe('M01-CFG-001/M01-ENV-001 configuration boundary', () => {
  it('defaults to local with execution disabled and exposes Monad chain IDs through typed config', () => {
    const config = loadServerConfig({ NODE_ENV: 'test' });
    expect(config.environment).toBe('LOCAL');
    expect(config.executionEnabled).toBe(false);
    expect(config.killSwitchEnabled).toBe(true);
    expect(config.networks.monadMainnet.chainId).toBe(143);
    expect(config.networks.monadTestnet.chainId).toBe(10143);
    expect(publicConfig(config)).not.toHaveProperty('databaseUrl');
    const serverConfig = loadServerConfig({
      NERVA_ENVIRONMENT: 'LOCAL',
      DATABASE_URL: 'postgresql://nerva:local-only-secret@127.0.0.1:5432/nerva',
    });
    expect(publicConfig(serverConfig)).not.toHaveProperty('databaseUrl');
  });

  it('fails closed on malformed critical settings and blocks MAINNET_EXECUTION', () => {
    expect(() => loadServerConfig({ NERVA_ENVIRONMENT: 'MYSTERY' })).toThrow();
    expect(() =>
      loadServerConfig({ NERVA_ENVIRONMENT: 'LOCAL', NERVA_EXECUTION_ENABLED: 'true' }),
    ).toThrow();
    expect(() => loadServerConfig({ NERVA_ENVIRONMENT: 'MAINNET_EXECUTION' })).toThrow(/disabled/i);
    expect(() => loadServerConfig({ NERVA_KILL_SWITCH_ENABLED: 'sometimes' })).toThrow();
  });

  it('accepts Vercel-native POSTGRES_URL as a server-only database fallback', () => {
    const fallback = loadServerConfig({
      NERVA_ENVIRONMENT: 'TESTNET_DEMO',
      POSTGRES_URL: 'postgresql://nerva:server-only@db.example.internal:5432/nerva?sslmode=require',
    });
    expect(fallback.databaseUrl).toBe(
      'postgresql://nerva:server-only@db.example.internal:5432/nerva?sslmode=require&uselibpqcompat=true',
    );
    expect(publicConfig(fallback)).not.toHaveProperty('databaseUrl');

    const explicit = loadServerConfig({
      NERVA_ENVIRONMENT: 'TESTNET_DEMO',
      DATABASE_URL: 'postgresql://nerva:primary@db.primary.internal:5432/nerva?sslmode=require',
      POSTGRES_URL: 'postgresql://nerva:fallback@db.fallback.internal:5432/nerva?sslmode=require',
    });
    expect(explicit.databaseUrl).toBe(
      'postgresql://nerva:primary@db.primary.internal:5432/nerva?sslmode=require',
    );

    expect(() =>
      loadServerConfig({
        NERVA_ENVIRONMENT: 'TESTNET_DEMO',
        POSTGRES_URL: 'https://not-postgres.example',
      }),
    ).toThrow(/PostgreSQL URL/i);
  });

  it('keeps demo simulation independent from autonomous execution', () => {
    const config = loadServerConfig({
      NERVA_ENVIRONMENT: 'TESTNET_DEMO',
      NERVA_DEMO_SIMULATION_ENABLED: 'true',
    });
    expect(config.demoSimulationEnabled).toBe(true);
    expect(config.executionEnabled).toBe(false);
  });

  it('admits Perpl public observation without credentials and rejects any scope except read', () => {
    const publicOnly = loadPerplConfig({ NERVA_ENVIRONMENT: 'LOCAL' }, 'LOCAL');
    expect(publicOnly.enabled).toBe(false);
    expect(publicOnly.chainId).toBe(143);
    expect(publicOnly.credentials).toBeUndefined();
    expect(() =>
      loadPerplConfig(
        {
          NERVA_ENVIRONMENT: 'LOCAL',
          PERPL_API_KEY: 'key',
          PERPL_API_KEY_SECRET: 'a'.repeat(64),
          PERPL_API_KEY_SCOPE: 'trade',
        },
        'LOCAL',
      ),
    ).toThrow(/read/i);
    expect(() =>
      loadPerplConfig(
        {
          NERVA_ENVIRONMENT: 'LOCAL',
          PERPL_API_KEY: 'key',
        },
        'LOCAL',
      ),
    ).toThrow(/complete/i);
  });

  it('binds Perpl URLs and chain identity to the admitted Monad network', () => {
    const testnet = loadPerplConfig(
      {
        NERVA_ENVIRONMENT: 'TESTNET_DEMO',
        PERPL_OBSERVATION_ENABLED: 'true',
      },
      'TESTNET_DEMO',
    );
    expect(testnet.chainId).toBe(10143);
    expect(testnet.network).toBe('monad-testnet');
    expect(() =>
      loadPerplConfig(
        {
          NERVA_ENVIRONMENT: 'TESTNET_DEMO',
          PERPL_CHAIN_ID: '143',
        },
        'TESTNET_DEMO',
      ),
    ).toThrow(/network/i);
  });
});
