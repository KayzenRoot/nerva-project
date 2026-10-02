import { loadServerConfig, type ServerConfig } from '@nerva/config';
import { createDatabase, readGlobalExecutionDisabled } from '@nerva/db';
import { createLogger } from '@nerva/observability';

export interface WorkerRuntime {
  readonly status: 'SAFE_MODE' | 'STOPPED';
  readonly executionEnabled: false;
  readonly globalExecutionDisabled: boolean;
  refreshKillSwitch(): Promise<boolean>;
  shutdown(reason?: string): Promise<void>;
}

export async function startWorker(
  config: ServerConfig = loadServerConfig(),
): Promise<WorkerRuntime> {
  const logger = createLogger({
    level: config.logLevel,
    environment: config.environment,
    component: 'worker',
  });
  let stopped = false;
  let globalExecutionDisabled = true;
  const database = config.databaseUrl ? createDatabase(config) : undefined;
  const refreshKillSwitch = async (): Promise<boolean> => {
    try {
      const persisted = database ? await readGlobalExecutionDisabled(database.db) : true;
      globalExecutionDisabled = config.killSwitchEnabled || persisted;
    } catch (error) {
      globalExecutionDisabled = true;
      logger.warn(
        { err: error, globalExecutionDisabled },
        'kill-switch state unavailable; failing closed',
      );
    }
    return globalExecutionDisabled;
  };
  await refreshKillSwitch();
  logger.info(
    { state: 'SAFE_MODE', executionEnabled: false, globalExecutionDisabled },
    'worker started without external integrations',
  );
  return {
    get status() {
      return stopped ? 'STOPPED' : 'SAFE_MODE';
    },
    executionEnabled: false,
    get globalExecutionDisabled() {
      return globalExecutionDisabled;
    },
    refreshKillSwitch,
    async shutdown(reason = 'shutdown requested') {
      if (stopped) return;
      stopped = true;
      await database?.pool.end();
      logger.info({ state: 'STOPPED', reason }, 'worker stopped');
    },
  };
}
