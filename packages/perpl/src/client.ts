import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import type { ObservationQuality, ObservationSource } from '@nerva/domain';

export type PerplScope = 'read';
export interface ReadOnlyCredentials {
  readonly apiKey: string;
  readonly keySecretHex: string;
  readonly scope: PerplScope;
}

export interface PerplReadOptions {
  readonly apiUrl: string;
  readonly wsUrl: string;
  readonly chainId: 143 | 10_143;
  readonly credentials?: ReadOnlyCredentials;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly fetcher?: typeof fetch;
  readonly now?: () => number;
  readonly nonce?: () => string;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
}

export type RestStatus =
  | 'OK'
  | 'RATE_LIMITED'
  | 'DEGRADED'
  | 'AUTHENTICATION_FAILED'
  | 'SCOPE_REFUSED'
  | 'NO_ACCOUNT'
  | 'NOT_FOUND'
  | 'HTTP_ERROR';
export class PerplReadError extends Error {
  constructor(
    readonly status: RestStatus,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'PerplReadError';
  }
}

const privateSeedPrefix = Buffer.from('302e020100300506032b657004220420', 'hex');
const emptyBodyHash = createHash('sha256').update('').digest('hex');

function keyObject(keySecretHex: string) {
  const seed = keySecretHex.replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(seed))
    throw new TypeError('Read-only API key secret must be exactly 32 bytes of hex');
  return createPrivateKey({
    key: Buffer.concat([privateSeedPrefix, Buffer.from(seed, 'hex')]),
    format: 'der',
    type: 'pkcs8',
  });
}

function signCanonical(canonical: string, keySecretHex: string): string {
  return sign(null, Buffer.from(canonical, 'utf8'), keyObject(keySecretHex)).toString('base64url');
}

/** Perpl REST signing is limited to GET requests and empty request bodies. */
export function createRestAuthHeaders(input: {
  readonly chainId: 143 | 10_143;
  readonly apiKey: string;
  readonly keySecretHex: string;
  readonly method: 'GET';
  readonly target: string;
  readonly timestamp?: string;
  readonly nonce?: string;
  readonly body?: '';
}): Readonly<Record<string, string>> {
  if (input.method !== 'GET' || (input.body !== undefined && input.body !== ''))
    throw new TypeError('M02 Perpl authentication only permits empty-body GET requests');
  if (!input.apiKey || input.apiKey.trim() !== input.apiKey)
    throw new TypeError('Read-only API key is invalid');
  if (!input.target.startsWith('/') || input.target.startsWith('//') || input.target.includes('#'))
    throw new TypeError('Perpl request target must be an exact absolute path and query');
  const timestamp = input.timestamp ?? Date.now().toString();
  const nonce = input.nonce ?? randomBytes(16).toString('base64url');
  if (!/^\d{10,16}$/.test(timestamp) || !/^[A-Za-z0-9_-]{1,128}$/.test(nonce))
    throw new TypeError('Perpl authentication timestamp or nonce is invalid');
  const canonical = [input.chainId, 'GET', input.target, timestamp, nonce, emptyBodyHash].join(
    '\n',
  );
  return Object.freeze({
    'X-API-Key': input.apiKey,
    'X-API-Timestamp': timestamp,
    'X-API-Nonce': nonce,
    'X-API-Signature': signCanonical(canonical, input.keySecretHex),
  });
}

export function createReadOnlySignInFrame(input: {
  readonly chainId: 143 | 10_143;
  readonly apiKey: string;
  readonly keySecretHex: string;
  readonly timestamp?: string;
  readonly nonce?: string;
}): Readonly<{
  mt: 29;
  chain_id: number;
  api_key: string;
  timestamp: string;
  nonce: string;
  signature: string;
}> {
  if (!input.apiKey || input.apiKey.trim() !== input.apiKey)
    throw new TypeError('Read-only API key is invalid');
  const timestamp = input.timestamp ?? Date.now().toString();
  const nonce = input.nonce ?? randomBytes(16).toString('base64url');
  if (!/^\d{10,16}$/.test(timestamp) || !/^[A-Za-z0-9_-]{1,128}$/.test(nonce))
    throw new TypeError('Perpl authentication timestamp or nonce is invalid');
  const canonical = [input.chainId, 'trading-ws-signin', timestamp, nonce].join('\n');
  return Object.freeze({
    mt: 29,
    chain_id: input.chainId,
    api_key: input.apiKey,
    timestamp,
    nonce,
    signature: signCanonical(canonical, input.keySecretHex),
  });
}

/** Preserve provider integer lexemes before normalization; reject malformed JSON at the boundary. */
export function parseLosslessJson<T = unknown>(text: string): T {
  return JSON.parse(
    text,
    function preserveNumberSource(_key, value, ...context: { readonly source?: string }[]) {
      if (typeof value !== 'number') return value;
      return context[0]?.source ?? value;
    },
  ) as T;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function integerLexeme(value: unknown, label: string, positive = false): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? String(value)
        : '';
  if (!(positive ? /^[1-9][0-9]*$/ : /^(?:0|[1-9][0-9]*)$/).test(text))
    throw new TypeError(`${label} must be an exact ${positive ? 'positive ' : ''}integer`);
  return text;
}

function signedIntegerLexeme(value: unknown, label: string): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? String(value)
        : '';
  if (!/^(?:0|-?[1-9][0-9]*)$/.test(text))
    throw new TypeError(`${label} must be an exact signed integer`);
  return text;
}

function endpoint(base: string, target: string): string {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol))
    throw new TypeError('Perpl REST URL must use HTTP(S)');
  return `${url.toString().replace(/\/$/, '')}${target}`;
}

function restStatus(status: number): RestStatus {
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'DEGRADED';
  if (status === 401) return 'AUTHENTICATION_FAILED';
  if (status === 403) return 'SCOPE_REFUSED';
  if (status === 404) return 'NOT_FOUND';
  return 'HTTP_ERROR';
}

function responseDelay(response: Response, attempt: number, random: () => number): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  const retryMs =
    Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.min(retryAfter * 1_000, 10_000) : 0;
  const jitter = Math.max(0, Math.min(1, random()));
  return Math.min(10_000, Math.max(retryMs, 250 * 2 ** attempt) + Math.floor(jitter * 100));
}

export class PerplReadClient {
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;
  private readonly nonce: () => string;
  private readonly random: () => number;

  constructor(private readonly options: PerplReadOptions) {
    const api = new URL(options.apiUrl);
    const ws = new URL(options.wsUrl);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
    if (
      api.protocol !== (localHost ? 'http:' : 'https:') ||
      ws.protocol !== (localHost ? 'ws:' : 'wss:')
    )
      throw new TypeError(
        'Perpl URLs must use secure REST and WebSocket schemes outside local development',
      );
    if (api.hostname !== ws.hostname)
      throw new TypeError('Perpl REST and WebSocket hosts must match');
    if (options.credentials && options.credentials.scope !== 'read')
      throw new TypeError('Only exact read scope is admitted');
    if (options.credentials) {
      if (!options.credentials.apiKey || !options.credentials.keySecretHex)
        throw new TypeError('Both read-only API credential values are required');
      keyObject(options.credentials.keySecretHex);
    }
    this.fetcher = options.fetcher ?? fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? Date.now;
    this.nonce = options.nonce ?? (() => randomBytes(16).toString('base64url'));
    this.random = options.random ?? Math.random;
  }

  get hasReadCredentials(): boolean {
    return this.options.credentials?.scope === 'read';
  }

  async getPublicContext(): Promise<Record<string, unknown>> {
    const value = record(await this.get('/v1/pub/context'), 'Perpl context');
    const chain = record(value.chain, 'Perpl context chain');
    const chainId = integerLexeme(chain.chain_id, 'Perpl chain id', true);
    if (Number(chainId) !== this.options.chainId)
      throw new PerplReadError(
        'HTTP_ERROR',
        'Perpl context network does not match configured chain',
      );
    if (!Array.isArray(value.markets) || !Array.isArray(value.tokens))
      throw new TypeError('Perpl context markets or tokens have an incompatible shape');
    return value;
  }

  async getMarketTicker(): Promise<Record<string, unknown>> {
    const value = record(await this.get('/v1/market-data/ticker'), 'Perpl ticker');
    if (!('d' in value))
      throw new TypeError('Perpl ticker response is missing its market data map');
    record(value.d, 'Perpl ticker market map');
    return value;
  }

  async getPositions(): Promise<{
    readonly status: 'AVAILABLE' | 'NO_ACCOUNT' | 'UNAVAILABLE';
    readonly payload?: Record<string, unknown>;
  }> {
    if (!this.hasReadCredentials) return { status: 'UNAVAILABLE' };
    try {
      const value = record(await this.get('/v1/trading/positions', true), 'Perpl positions');
      if (!Array.isArray(value.d))
        throw new TypeError('Perpl positions response is missing its position list');
      for (const item of value.d) record(item, 'Perpl position');
      return { status: 'AVAILABLE', payload: value };
    } catch (error) {
      if (error instanceof PerplReadError && error.httpStatus === 404)
        return { status: 'NO_ACCOUNT' };
      throw error;
    }
  }

  async getWallet(): Promise<{
    readonly status: 'AVAILABLE' | 'NO_ACCOUNT' | 'UNAVAILABLE';
    readonly payload?: Record<string, unknown>;
  }> {
    if (!this.hasReadCredentials) return { status: 'UNAVAILABLE' };
    try {
      return {
        status: 'AVAILABLE',
        payload: record(await this.get('/v1/trading/wallet', true), 'Perpl wallet'),
      };
    } catch (error) {
      if (error instanceof PerplReadError && error.httpStatus === 404)
        return { status: 'NO_ACCOUNT' };
      throw error;
    }
  }

  async getPortfolio(period: 'day' = 'day'): Promise<{
    readonly status: 'AVAILABLE' | 'NO_ACCOUNT' | 'UNAVAILABLE';
    readonly payload?: Record<string, unknown>;
  }> {
    if (!this.hasReadCredentials) return { status: 'UNAVAILABLE' };
    try {
      const value = record(
        await this.get(`/v1/trading/portfolio/equity/${period}`, true),
        'Perpl portfolio',
      );
      if (!Array.isArray(value.chart))
        throw new TypeError('Perpl portfolio response is missing its chart');
      return { status: 'AVAILABLE', payload: value };
    } catch (error) {
      if (error instanceof PerplReadError && error.httpStatus === 404)
        return { status: 'NO_ACCOUNT' };
      throw error;
    }
  }

  private async get(target: string, authenticated = false): Promise<unknown> {
    const credentials = authenticated ? this.options.credentials : undefined;
    if (authenticated && !credentials)
      throw new PerplReadError(
        'AUTHENTICATION_FAILED',
        'Read-only Perpl credentials are unavailable',
      );
    const maximumRetries = Math.max(0, Math.min(3, this.options.maxRetries ?? 2));
    for (let attempt = 0; ; attempt += 1) {
      const timestamp = String(this.now());
      const headers = credentials
        ? createRestAuthHeaders({
            chainId: this.options.chainId,
            apiKey: credentials.apiKey,
            keySecretHex: credentials.keySecretHex,
            method: 'GET',
            target,
            timestamp,
            nonce: this.nonce(),
          })
        : undefined;
      let response: Response;
      try {
        response = await this.fetcher(endpoint(this.options.apiUrl, target), {
          method: 'GET',
          ...(headers ? { headers } : {}),
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 5_000),
          cache: 'no-store',
        });
      } catch (error) {
        if (attempt < maximumRetries) {
          await this.sleep(Math.min(10_000, 250 * 2 ** attempt));
          continue;
        }
        throw new PerplReadError(
          'DEGRADED',
          error instanceof Error ? error.message : 'Perpl transport failed',
        );
      }
      if (response.ok) {
        const text = await response.text();
        try {
          return parseLosslessJson(text);
        } catch {
          throw new PerplReadError(
            'HTTP_ERROR',
            'Perpl response is not valid JSON',
            response.status,
          );
        }
      }
      if ((response.status === 429 || response.status === 503) && attempt < maximumRetries) {
        await this.sleep(responseDelay(response, attempt, this.random));
        continue;
      }
      const status = restStatus(response.status);
      throw new PerplReadError(
        status,
        `Perpl read failed with HTTP ${response.status}`,
        response.status,
      );
    }
  }
}

export type SequenceDecision = 'ACCEPT' | 'RECONNECT_STALE';
export function sequenceDecision(
  previous: { readonly sessionId?: string; readonly previous?: number },
  next: { readonly sessionId?: string; readonly sequence: number },
): SequenceDecision {
  if (!Number.isSafeInteger(next.sequence) || next.sequence < 0) return 'RECONNECT_STALE';
  if (
    previous.sessionId !== undefined &&
    next.sessionId !== undefined &&
    previous.sessionId !== next.sessionId
  )
    return 'RECONNECT_STALE';
  if (previous.previous === undefined) return 'ACCEPT';
  return next.sequence === previous.previous + 1 ? 'ACCEPT' : 'RECONNECT_STALE';
}

export interface FundingInterval {
  readonly marketId?: string;
  readonly intervalId: string;
  readonly appliedAt: string;
  readonly rateMicros: string;
  readonly paymentPerLotScaled?: string;
}

export function normalizePerplFundingFrame(
  frameValue: unknown,
): readonly (FundingInterval & { readonly marketId: string })[] {
  const frame = record(frameValue, 'Perpl funding frame');
  if (Number(frame.mt) !== 10) throw new TypeError('Perpl funding frame message type must be 10');
  const body = frame.d ?? frame;
  const entries: Array<readonly [string | undefined, unknown]> = Array.isArray(body)
    ? body.map((event) => [undefined, event] as const)
    : Object.hasOwn(record(body, 'Perpl funding payload'), 'feb')
      ? [[undefined, body] as const]
      : Object.entries(record(body, 'Perpl funding market map'));
  const normalized = entries.map(([mapMarketId, rawEvent]) => {
    const event = record(rawEvent, 'Perpl funding event');
    const marketId = integerLexeme(
      event.m ?? frame.m ?? mapMarketId,
      'Perpl funding market id',
      true,
    );
    const intervalBlock = integerLexeme(event.feb, 'Perpl funding interval', true);
    const at = record(event.at, 'Perpl funding timestamp');
    const timestamp = BigInt(integerLexeme(at.t, 'Perpl funding timestamp', true));
    if (timestamp > BigInt(Number.MAX_SAFE_INTEGER))
      throw new TypeError('Perpl funding timestamp is outside the safe millisecond range');
    const appliedAt = new Date(Number(timestamp)).toISOString();
    const rateMicros = signedIntegerLexeme(event.rate, 'Perpl funding rate');
    const paymentPerLotScaled = signedIntegerLexeme(event.ppl, 'Perpl funding payment per lot');
    return Object.freeze({
      marketId,
      intervalId: `${marketId}:${intervalBlock}`,
      appliedAt,
      rateMicros,
      paymentPerLotScaled,
    });
  });
  return Object.freeze(
    normalized.sort((left, right) =>
      left.marketId < right.marketId ? -1 : left.marketId > right.marketId ? 1 : 0,
    ),
  );
}

export function upsertFundingInterval<T extends FundingInterval>(
  current: readonly T[],
  next: T,
): readonly T[] {
  if (
    !next.intervalId ||
    !/^(?:0|-?[1-9][0-9]*)$/.test(next.rateMicros) ||
    !Number.isFinite(Date.parse(next.appliedAt))
  )
    throw new TypeError('Funding interval update is malformed');
  const index = current.findIndex((entry) => entry.intervalId === next.intervalId);
  if (index < 0)
    return Object.freeze(
      [...current, Object.freeze({ ...next })].sort((left, right) =>
        left.intervalId < right.intervalId ? -1 : left.intervalId > right.intervalId ? 1 : 0,
      ),
    );
  const updated = [...current];
  updated[index] = Object.freeze({ ...next });
  return Object.freeze(updated);
}

export function publicMarketSubscriptions(
  chainId: 143 | 10_143,
  marketIds: readonly string[] = [],
): readonly string[] {
  const uniqueMarkets = [...new Set(marketIds)];
  if (uniqueMarkets.some((id) => !/^[1-9][0-9]*$/.test(id)))
    throw new TypeError('Perpl market IDs must be positive integers');
  const subscriptions = [
    `heartbeat@${chainId}`,
    `market-config@${chainId}`,
    `market-state@${chainId}`,
    `funding@${chainId}`,
  ];
  if (subscriptions.length + uniqueMarkets.length > 16)
    throw new RangeError('Perpl public stream exceeds the documented 16-subscription limit');
  return Object.freeze(subscriptions);
}

export function marketSubscriptionFrame(chainId: 143 | 10_143, marketIds: readonly string[] = []) {
  return Object.freeze({
    mt: 5,
    subs: publicMarketSubscriptions(chainId, marketIds).map((stream) =>
      Object.freeze({ stream, subscribe: true }),
    ),
  });
}

export class MarketStreamIntegrity {
  private sequence?: number;
  private sessionId?: string;
  private fresh = false;
  private reconnects = 0;
  private funding: readonly FundingInterval[] = Object.freeze([]);

  beginSession(sessionId?: string): void {
    this.sequence = undefined;
    this.sessionId = sessionId;
    this.fresh = false;
  }

  acceptHeartbeat(input: {
    readonly sequence: number;
    readonly sessionId?: string;
  }): SequenceDecision {
    const decision = sequenceDecision(
      { sessionId: this.sessionId, previous: this.sequence },
      input,
    );
    if (decision === 'RECONNECT_STALE') {
      this.fresh = false;
      this.reconnects += 1;
      return decision;
    }
    this.sessionId ??= input.sessionId;
    this.sequence = input.sequence;
    this.fresh = true;
    return decision;
  }

  acceptFunding(update: FundingInterval): readonly FundingInterval[] {
    this.funding = upsertFundingInterval(this.funding, update);
    return this.funding;
  }

  markDisconnected(): void {
    this.fresh = false;
  }
  get isFresh(): boolean {
    return this.fresh;
  }
  get reconnectCount(): number {
    return this.reconnects;
  }
  get fundingIntervals(): readonly FundingInterval[] {
    return this.funding;
  }
  get checkpoint(): Readonly<{ sessionId?: string; sequence?: number }> {
    return Object.freeze({
      ...(this.sessionId ? { sessionId: this.sessionId } : {}),
      ...(this.sequence !== undefined ? { sequence: this.sequence } : {}),
    });
  }
}

export function createObservationSource(input: {
  readonly network: 'monad-mainnet' | 'monad-testnet' | 'local';
  readonly chainId: 143 | 10_143;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly correlationId: string;
  readonly contentHash: string;
  readonly sequence?: string;
  readonly sessionId?: string;
  readonly quality?: ObservationQuality;
}): ObservationSource {
  if (!/^[0-9a-f]{64}$/.test(input.contentHash))
    throw new TypeError('Observation content hash must be SHA-256 hex');
  if (
    (input.network === 'monad-mainnet' && input.chainId !== 143) ||
    (input.network === 'monad-testnet' && input.chainId !== 10_143)
  )
    throw new TypeError('Observation network does not match its chain ID');
  if (
    !Number.isFinite(Date.parse(input.observedAt)) ||
    !Number.isFinite(Date.parse(input.receivedAt))
  )
    throw new TypeError('Observation timestamps are invalid');
  return Object.freeze({ source: 'perpl', ...input, quality: input.quality ?? 'FRESH' });
}

export interface MarketStreamCallbacks {
  readonly onMessage: (message: Readonly<Record<string, unknown>>) => void;
  readonly onIntegrity: (
    state: Readonly<{ fresh: boolean; reconnectCount: number; reason: string }>,
  ) => void;
}

/** Native Node WebSocket observer: public streams only, bounded reconnect, stale on disconnect/gap. */
export async function runPublicMarketStream(input: {
  readonly wsUrl: string;
  readonly chainId: 143 | 10_143;
  readonly marketIds?: readonly string[];
  readonly callbacks: MarketStreamCallbacks;
  readonly signal: AbortSignal;
  readonly minReconnectDelayMs?: number;
  readonly maxReconnectDelayMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
  readonly socketFactory?: (url: string) => WebSocket;
}): Promise<void> {
  const target = new URL('/ws/v1/market-data', input.wsUrl).toString();
  const makeSocket = input.socketFactory ?? ((url) => new WebSocket(url));
  const sleep =
    input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = input.random ?? Math.random;
  const minDelay = Math.max(100, Math.min(30_000, input.minReconnectDelayMs ?? 250));
  const maxDelay = Math.max(minDelay, Math.min(60_000, input.maxReconnectDelayMs ?? 30_000));
  const integrity = new MarketStreamIntegrity();
  let attempt = 0;
  let connectionCount = 0;
  while (!input.signal.aborted) {
    connectionCount += 1;
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = makeSocket(target);
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error('Perpl WebSocket open timed out'));
        }, 10_000);
        let subscriptionTimer: ReturnType<typeof setTimeout> | undefined;
        let subscribed = false;
        const close = () => {
          clearTimeout(timer);
          if (subscriptionTimer) clearTimeout(subscriptionTimer);
          integrity.markDisconnected();
          input.callbacks.onIntegrity({
            fresh: false,
            reconnectCount: Math.max(
              input.signal.aborted ? connectionCount - 1 : connectionCount,
              integrity.reconnectCount,
            ),
            reason: 'DISCONNECTED',
          });
          resolve();
        };
        socket.addEventListener(
          'open',
          () => {
            clearTimeout(timer);
            integrity.beginSession();
            socket.send(JSON.stringify(marketSubscriptionFrame(input.chainId, input.marketIds)));
            subscriptionTimer = setTimeout(() => {
              integrity.markDisconnected();
              socket.close(1002, 'subscription acknowledgement timed out');
            }, 10_000);
          },
          { once: true },
        );
        socket.addEventListener('message', (event) => {
          if (typeof event.data !== 'string') {
            integrity.markDisconnected();
            socket.close(1002, 'invalid frame');
            return;
          }
          let message: Record<string, unknown>;
          try {
            message = record(parseLosslessJson(event.data), 'Perpl WebSocket frame');
          } catch {
            integrity.markDisconnected();
            socket.close(1002, 'invalid JSON');
            return;
          }
          if (Number(message.mt) === 6) {
            const subs = Array.isArray(message.subs) ? message.subs : [];
            if (
              subs.length !== 4 ||
              subs.some((entry) => {
                const result = record(entry, 'subscription result');
                if (!result.status) return true;
                const status = record(result.status, 'subscription status');
                return status.code !== '0' && status.code !== 0;
              })
            ) {
              integrity.markDisconnected();
              socket.close(1008, 'subscription refused');
              return;
            }
            if (subscriptionTimer) clearTimeout(subscriptionTimer);
            subscribed = true;
            return;
          }
          if (Number(message.mt) === 100) {
            const sequence = Number(integerLexeme(message.sn, 'heartbeat sequence'));
            const decision = integrity.acceptHeartbeat({
              sequence,
              ...(typeof message.ses === 'string' ? { sessionId: message.ses } : {}),
            });
            input.callbacks.onIntegrity({
              fresh: decision === 'ACCEPT',
              reconnectCount: Math.max(connectionCount - 1, integrity.reconnectCount),
              reason: decision,
            });
            if (decision !== 'ACCEPT') socket.close(1002, 'sequence gap');
            else input.callbacks.onMessage(Object.freeze({ ...message }));
            return;
          }
          if (!subscribed || ![8, 9, 10].includes(Number(message.mt))) return;
          input.callbacks.onMessage(Object.freeze({ ...message }));
        });
        socket.addEventListener(
          'error',
          () => reject(new Error('Perpl WebSocket transport error')),
          { once: true },
        );
        socket.addEventListener('close', close, { once: true });
        input.signal.addEventListener('abort', () => socket.close(1000, 'observer shutdown'), {
          once: true,
        });
      });
    } catch {
      integrity.markDisconnected();
      input.callbacks.onIntegrity({
        fresh: false,
        reconnectCount: Math.max(connectionCount, integrity.reconnectCount),
        reason: 'TRANSPORT_FAILURE',
      });
    }
    if (input.signal.aborted) break;
    const jitter = Math.max(0, Math.min(1, random()));
    await sleep(
      Math.floor(Math.min(maxDelay, minDelay * 2 ** Math.min(attempt, 8)) * (0.75 + jitter * 0.5)),
    );
    attempt = Math.min(attempt + 1, 8);
  }
}

export interface AccountStreamCallbacks {
  readonly onMessage: (message: Readonly<Record<string, unknown>>) => void;
  readonly onIntegrity: (
    state: Readonly<{ fresh: boolean; reconnectCount: number; reason: string }>,
  ) => void;
}

/** Authenticated account observer consumes read frames only and sends only API-key sign-in. */
export async function runReadOnlyAccountStream(input: {
  readonly wsUrl: string;
  readonly chainId: 143 | 10_143;
  readonly credentials: ReadOnlyCredentials;
  readonly callbacks: AccountStreamCallbacks;
  readonly signal: AbortSignal;
  readonly minReconnectDelayMs?: number;
  readonly maxReconnectDelayMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
  readonly socketFactory?: (url: string) => WebSocket;
}): Promise<void> {
  if (input.credentials.scope !== 'read')
    throw new TypeError('Only exact read scope is admitted for the account stream');
  const target = new URL('/ws/v1/trading', input.wsUrl).toString();
  const makeSocket = input.socketFactory ?? ((url) => new WebSocket(url));
  const sleep =
    input.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = input.random ?? Math.random;
  const minDelay = Math.max(100, Math.min(30_000, input.minReconnectDelayMs ?? 250));
  const maxDelay = Math.max(minDelay, Math.min(60_000, input.maxReconnectDelayMs ?? 30_000));
  const integrity = new MarketStreamIntegrity();
  let attempt = 0;
  let connectionCount = 0;
  while (!input.signal.aborted) {
    connectionCount += 1;
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = makeSocket(target);
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error('Perpl account WebSocket open timed out'));
        }, 10_000);
        let baselineTimer: ReturnType<typeof setTimeout> | undefined;
        let baselineEstablished = false;
        const close = () => {
          clearTimeout(timer);
          if (baselineTimer) clearTimeout(baselineTimer);
          integrity.markDisconnected();
          input.callbacks.onIntegrity({
            fresh: false,
            reconnectCount: Math.max(
              input.signal.aborted ? connectionCount - 1 : connectionCount,
              integrity.reconnectCount,
            ),
            reason: 'DISCONNECTED',
          });
          resolve();
        };
        socket.addEventListener(
          'open',
          () => {
            clearTimeout(timer);
            integrity.beginSession();
            baselineTimer = setTimeout(() => {
              integrity.markDisconnected();
              socket.close(1002, 'account snapshot baseline timed out');
            }, 10_000);
            socket.send(
              JSON.stringify(
                createReadOnlySignInFrame({
                  chainId: input.chainId,
                  apiKey: input.credentials.apiKey,
                  keySecretHex: input.credentials.keySecretHex,
                }),
              ),
            );
          },
          { once: true },
        );
        socket.addEventListener('message', (event) => {
          if (typeof event.data !== 'string') {
            integrity.markDisconnected();
            socket.close(1002, 'invalid frame');
            return;
          }
          let message: Record<string, unknown>;
          try {
            message = record(parseLosslessJson(event.data), 'Perpl account WebSocket frame');
          } catch {
            integrity.markDisconnected();
            socket.close(1002, 'invalid JSON');
            return;
          }
          if (Number(message.mt) === 19 && !baselineEstablished) {
            const sequence = Number(integerLexeme(message.sn, 'wallet snapshot sequence'));
            const decision = integrity.acceptHeartbeat({
              sequence,
              ...(typeof message.ses === 'string' ? { sessionId: message.ses } : {}),
            });
            if (decision !== 'ACCEPT') {
              socket.close(1002, 'invalid account snapshot baseline');
              return;
            }
            baselineEstablished = true;
            if (baselineTimer) clearTimeout(baselineTimer);
            input.callbacks.onIntegrity({
              fresh: true,
              reconnectCount: integrity.reconnectCount,
              reason: 'SNAPSHOT_BASELINE',
            });
            input.callbacks.onMessage(Object.freeze({ ...message }));
            return;
          }
          if (Number(message.mt) === 100) {
            if (!baselineEstablished) {
              integrity.markDisconnected();
              socket.close(1002, 'heartbeat before account snapshot');
              return;
            }
            const sequence = Number(integerLexeme(message.sn, 'account heartbeat sequence'));
            const decision = integrity.acceptHeartbeat({
              sequence,
              ...(typeof message.ses === 'string' ? { sessionId: message.ses } : {}),
            });
            input.callbacks.onIntegrity({
              fresh: decision === 'ACCEPT',
              reconnectCount: Math.max(connectionCount - 1, integrity.reconnectCount),
              reason: decision,
            });
            if (decision !== 'ACCEPT') socket.close(1002, 'account sequence gap');
            else input.callbacks.onMessage(Object.freeze({ ...message }));
            return;
          }
          if (baselineEstablished && [20, 21, 26, 27].includes(Number(message.mt)))
            input.callbacks.onMessage(Object.freeze({ ...message }));
        });
        socket.addEventListener(
          'error',
          () => reject(new Error('Perpl account WebSocket transport error')),
          { once: true },
        );
        socket.addEventListener('close', close, { once: true });
        input.signal.addEventListener('abort', () => socket.close(1000, 'observer shutdown'), {
          once: true,
        });
      });
    } catch {
      integrity.markDisconnected();
      input.callbacks.onIntegrity({
        fresh: false,
        reconnectCount: Math.max(connectionCount, integrity.reconnectCount),
        reason: 'AUTH_OR_TRANSPORT_FAILURE',
      });
    }
    if (input.signal.aborted) break;
    const jitter = Math.max(0, Math.min(1, random()));
    await sleep(
      Math.floor(Math.min(maxDelay, minDelay * 2 ** Math.min(attempt, 8)) * (0.75 + jitter * 0.5)),
    );
    attempt = Math.min(attempt + 1, 8);
  }
}
