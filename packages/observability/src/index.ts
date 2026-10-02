import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type Logger, type DestinationStream, type LoggerOptions } from 'pino';

const correlation = new AsyncLocalStorage<string>();

export interface LoggerOptionsForNerva {
  readonly level: string;
  readonly environment: string;
  readonly component?: string;
  readonly stream?: DestinationStream;
}

const redactedPaths = [
  'authorization',
  'Authorization',
  'headers.authorization',
  'headers.Authorization',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'seedPhrase',
  'seed_phrase',
  'secret',
  'token',
  'password',
  '*.authorization',
  '*.Authorization',
  '*.apiKey',
  '*.api_key',
  '*.privateKey',
  '*.private_key',
  '*.seedPhrase',
  '*.seed_phrase',
  '*.secret',
  '*.token',
  '*.password',
  '**.authorization',
  '**.apiKey',
  '**.api_key',
  '**.privateKey',
  '**.private_key',
  '**.seedPhrase',
  '**.seed_phrase',
  '**.secret',
  '**.token',
  '**.password',
];

export function createLogger(options: LoggerOptionsForNerva): Logger {
  const loggerOptions: LoggerOptions = {
    level: options.level,
    base: {
      module: 'M01',
      component: options.component ?? 'platform',
      environment: options.environment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: redactedPaths, censor: '[REDACTED]' },
    mixin: () => ({ correlationId: correlation.getStore() ?? 'unscoped' }),
  };
  return options.stream ? pino(loggerOptions, options.stream) : pino(loggerOptions);
}

export function runWithCorrelation<T>(correlationId: string, callback: () => T): T {
  if (!correlationId.trim()) throw new Error('Correlation ID cannot be blank');
  return correlation.run(correlationId, callback);
}

export function currentCorrelationId(): string | undefined {
  return correlation.getStore();
}

export interface AuditEvent {
  readonly schemaVersion: '0.1';
  readonly eventId: string;
  readonly eventType: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly subjectId?: string;
  readonly reason: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export function emitAuditEvent(logger: Logger, event: AuditEvent): void {
  logger.info({ eventName: 'audit_event', ...event }, 'audit event');
}
