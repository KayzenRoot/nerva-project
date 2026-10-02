import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type Logger, type DestinationStream, type LoggerOptions } from 'pino';

const correlation = new AsyncLocalStorage<string>();

const sensitiveLogKeys = new Set([
  'authorization',
  'apikey',
  'privatekey',
  'seedphrase',
  'secret',
  'token',
  'password',
]);
const sensitiveLogKeyPrefixes = ['authorization', 'apikey', 'privatekey', 'seedphrase'];
const sensitiveLogKeySuffixes = ['secret', 'token', 'password'];

function isSensitiveLogKey(key: string): boolean {
  const normalizedKey = key.replaceAll(/[-_]/g, '').toLowerCase();
  return (
    sensitiveLogKeys.has(normalizedKey) ||
    sensitiveLogKeyPrefixes.some((prefix) => normalizedKey.startsWith(prefix)) ||
    sensitiveLogKeySuffixes.some((suffix) => normalizedKey.endsWith(suffix))
  );
}

function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (value === null || typeof value !== 'object') return value;

  const sanitized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, item] of Object.entries(value)) {
    const sanitizedItem = isSensitiveLogKey(key) ? '[REDACTED]' : sanitizeLogValue(item);
    Object.defineProperty(sanitized, key, {
      configurable: true,
      enumerable: true,
      value: sanitizedItem,
      writable: true,
    });
  }
  return sanitized;
}

function sanitizeSerializedLog(line: string): string {
  const lineEnding = line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : '';
  const serialized = lineEnding ? line.slice(0, -lineEnding.length) : line;
  return `${JSON.stringify(sanitizeLogValue(JSON.parse(serialized)))}${lineEnding}`;
}

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
    hooks: { streamWrite: sanitizeSerializedLog },
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
