import { canonicalHash, canonicalSerialize } from '@nerva/domain';
import {
  getAddress,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';

export type M04Action = 'REDUCE_POSITION' | 'CLOSE_POSITION' | 'NO_ACTION';
export type M04DelegateStatus = 'ABSENT' | 'ACTIVE' | 'CHANGED' | 'REVOKED' | 'UNKNOWN';
export const MONAD_TESTNET_CHAIN_ID = 10_143;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO_HASH = `0x${'0'.repeat(64)}` as Hex;
const MAX_GRANT_SECONDS = 7 * 24 * 60 * 60;
const MAX_SESSION_SECONDS = 24 * 60 * 60;

type PlainRecord = Record<string, unknown>;
function exactRecord(value: unknown, keys: readonly string[]): PlainRecord | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as PlainRecord;
  const prototype = Object.getPrototypeOf(item);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  if (Object.getOwnPropertySymbols(item).length) return undefined;
  const actual = Object.keys(item);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(item, key)))
    return undefined;
  if (actual.some((key) => !keys.includes(key))) return undefined;
  if (actual.some((key) => !('value' in Object.getOwnPropertyDescriptor(item, key)!)))
    return undefined;
  return item;
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function requiredAddress(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !ADDRESS_PATTERN.test(value))
    throw new TypeError(`${label} must be a 20-byte EVM address`);
  return getAddress(value);
}

function actionCode(action: unknown): number {
  if (action === 'REDUCE_POSITION') return 1;
  if (action === 'CLOSE_POSITION') return 2;
  if (action === 'NO_ACTION') return 3;
  throw new TypeError('Unsupported M03 action');
}

function isSubsetNumber(value: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

const walletIdentityBrands = new WeakSet<object>();
const agentIdentityBrands = new WeakSet<object>();

export interface WalletIdentity {
  readonly schemaVersion: '0.1';
  readonly accountId: string;
  readonly address: Address;
  readonly chainId: 10_143;
  readonly network: 'monad-testnet';
  readonly providerId: 'eip712-compatible-wallet';
  readonly provenanceHash: string;
  readonly verifiedAt: string;
}

export interface AgentIdentity {
  readonly schemaVersion: '0.1';
  readonly agentId: string;
  readonly version: number;
  readonly issuerId: string;
  readonly provenanceHash: string;
  readonly walletAddress: Address;
  readonly chainId: 10_143;
}

const WALLET_BINDING_TYPES = {
  WalletBinding: [
    { name: 'account', type: 'address' },
    { name: 'accountIdHash', type: 'bytes32' },
    { name: 'providerIdHash', type: 'bytes32' },
    { name: 'chainId', type: 'uint256' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'validUntil', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export type WalletBindingTypedData = Readonly<{
  domain: Readonly<{ name: 'NERVA Wallet Binding'; version: '1'; chainId: number; salt: Hex }>;
  types: typeof WALLET_BINDING_TYPES;
  primaryType: 'WalletBinding';
  message: Readonly<{
    account: Address;
    accountIdHash: Hex;
    providerIdHash: Hex;
    chainId: bigint;
    issuedAt: bigint;
    validUntil: bigint;
    nonce: Hex;
  }>;
}>;

export function buildWalletBindingTypedData(input: {
  readonly accountId: string;
  readonly address: string;
  readonly issuedAt: string;
  readonly validUntil: string;
  readonly nonce: string;
}): WalletBindingTypedData {
  const accountId = input.accountId.trim();
  const address = requiredAddress(input.address, 'wallet.address');
  if (!accountId || accountId.length > 200)
    throw new TypeError('Wallet account identity is invalid');
  if (!validTimestamp(input.issuedAt) || !validTimestamp(input.validUntil))
    throw new TypeError('Wallet binding timestamps must be UTC ISO timestamps');
  const issuedAt = Date.parse(input.issuedAt) / 1_000;
  const validUntil = Date.parse(input.validUntil) / 1_000;
  if (
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(validUntil) ||
    validUntil <= issuedAt ||
    validUntil - issuedAt > 300
  )
    throw new TypeError('Wallet binding timestamp range is invalid');
  if (typeof input.nonce !== 'string' || !/^0x[0-9a-f]{64}$/.test(input.nonce))
    throw new TypeError('Wallet binding nonce must be 32 bytes');
  return {
    domain: {
      name: 'NERVA Wallet Binding',
      version: '1',
      chainId: MONAD_TESTNET_CHAIN_ID,
      salt: keccak256(stringToHex(`nerva-wallet-binding:${accountId}`)),
    },
    types: WALLET_BINDING_TYPES,
    primaryType: 'WalletBinding',
    message: {
      account: address,
      accountIdHash: keccak256(stringToHex(accountId)),
      providerIdHash: keccak256(stringToHex('eip712-compatible-wallet')),
      chainId: BigInt(MONAD_TESTNET_CHAIN_ID),
      issuedAt: BigInt(issuedAt),
      validUntil: BigInt(validUntil),
      nonce: input.nonce as Hex,
    },
  };
}

export function hashWalletBindingTypedData(typedData: WalletBindingTypedData): string {
  return hashTypedData(typedData).slice(2);
}

const WALLET_READ_TYPES = {
  WalletReadAccess: [
    { name: 'account', type: 'address' },
    { name: 'accountIdHash', type: 'bytes32' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'validUntil', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export type WalletReadAuthorizationTypedData = Readonly<{
  domain: Readonly<{ name: 'NERVA Permission Read'; version: '1'; chainId: number; salt: Hex }>;
  types: typeof WALLET_READ_TYPES;
  primaryType: 'WalletReadAccess';
  message: Readonly<{
    account: Address;
    accountIdHash: Hex;
    issuedAt: bigint;
    validUntil: bigint;
    nonce: Hex;
  }>;
}>;

export function buildWalletReadAuthorizationTypedData(input: {
  accountId: string;
  address: string;
  issuedAt: string;
  validUntil: string;
  nonce: string;
}): WalletReadAuthorizationTypedData {
  const issuedAt = Date.parse(input.issuedAt);
  const validUntil = Date.parse(input.validUntil);
  if (
    !input.accountId ||
    input.accountId.length > 200 ||
    !validTimestamp(input.issuedAt) ||
    !validTimestamp(input.validUntil) ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(validUntil) ||
    validUntil <= issuedAt ||
    validUntil - issuedAt > 120_000 ||
    !/^0x[0-9a-f]{64}$/.test(input.nonce)
  )
    throw new TypeError('Permission read challenge must be exact, short-lived and nonce-bound');
  return {
    domain: {
      name: 'NERVA Permission Read',
      version: '1',
      chainId: MONAD_TESTNET_CHAIN_ID,
      salt: keccak256(stringToHex(`nerva-permission-read:${input.accountId}`)),
    },
    types: WALLET_READ_TYPES,
    primaryType: 'WalletReadAccess',
    message: {
      account: requiredAddress(input.address, 'permission read wallet'),
      accountIdHash: keccak256(stringToHex(input.accountId)),
      issuedAt: BigInt(issuedAt / 1_000),
      validUntil: BigInt(validUntil / 1_000),
      nonce: input.nonce as Hex,
    },
  };
}

export async function verifyWalletReadAuthorization(input: {
  accountId: string;
  address: string;
  typedData: WalletReadAuthorizationTypedData;
  signature: string;
  now: string;
}): Promise<Readonly<{ address: Address; nonceHash: string; domainHash: string }> | undefined> {
  try {
    const { typedData } = input;
    const now = Date.parse(input.now);
    const issuedAt = Number(typedData.message.issuedAt) * 1_000;
    const validUntil = Number(typedData.message.validUntil) * 1_000;
    const address = requiredAddress(input.address, 'permission read wallet');
    if (
      !Number.isFinite(now) ||
      !validTimestamp(input.now) ||
      !exactRecord(typedData, ['domain', 'types', 'primaryType', 'message']) ||
      !exactRecord(typedData.message, [
        'account',
        'accountIdHash',
        'issuedAt',
        'validUntil',
        'nonce',
      ]) ||
      !exactRecord(typedData.domain, ['name', 'version', 'chainId', 'salt']) ||
      typedData.domain.name !== 'NERVA Permission Read' ||
      typedData.domain.version !== '1' ||
      typedData.domain.chainId !== MONAD_TESTNET_CHAIN_ID ||
      typedData.domain.salt !==
        keccak256(stringToHex(`nerva-permission-read:${input.accountId}`)) ||
      typedData.primaryType !== 'WalletReadAccess' ||
      canonicalSerialize(typedData.types) !== canonicalSerialize(WALLET_READ_TYPES) ||
      typedData.message.account.toLowerCase() !== address.toLowerCase() ||
      typedData.message.accountIdHash !== keccak256(stringToHex(input.accountId)) ||
      !/^0x[0-9a-f]{64}$/.test(typedData.message.nonce) ||
      issuedAt > now ||
      now - issuedAt > 120_000 ||
      validUntil <= now ||
      validUntil <= issuedAt ||
      validUntil - issuedAt > 120_000
    )
      return undefined;
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature: input.signature as Hex,
    });
    if (signer.toLowerCase() !== address.toLowerCase()) return undefined;
    return Object.freeze({
      address,
      nonceHash: await canonicalHash(typedData.message.nonce),
      domainHash: hashTypedData(typedData).slice(2),
    });
  } catch {
    return undefined;
  }
}

export async function verifyWalletIdentityBinding(input: {
  readonly typedData: WalletBindingTypedData;
  readonly signature: string;
  readonly expected: Readonly<{ accountId: string; address: string; now: string }>;
}): Promise<WalletIdentity | undefined> {
  try {
    const { domain, message } = input.typedData;
    const address = requiredAddress(input.expected.address, 'wallet.address');
    const now = Date.parse(input.expected.now);
    const issuedAt = Number(message.issuedAt) * 1_000;
    const validUntil = Number(message.validUntil) * 1_000;
    if (
      !exactRecord(input.typedData, ['domain', 'types', 'primaryType', 'message']) ||
      !exactRecord(message, [
        'account',
        'accountIdHash',
        'providerIdHash',
        'chainId',
        'issuedAt',
        'validUntil',
        'nonce',
      ]) ||
      !Number.isFinite(now) ||
      !exactRecord(domain, ['name', 'version', 'chainId', 'salt']) ||
      domain.name !== 'NERVA Wallet Binding' ||
      domain.version !== '1' ||
      domain.chainId !== MONAD_TESTNET_CHAIN_ID ||
      domain.salt !== keccak256(stringToHex(`nerva-wallet-binding:${input.expected.accountId}`)) ||
      message.account.toLowerCase() !== address.toLowerCase() ||
      message.accountIdHash !== keccak256(stringToHex(input.expected.accountId)) ||
      message.providerIdHash !== keccak256(stringToHex('eip712-compatible-wallet')) ||
      Number(message.chainId) !== MONAD_TESTNET_CHAIN_ID ||
      issuedAt > now ||
      validUntil <= now ||
      validUntil - issuedAt > 300_000
    )
      return undefined;
    const recovered = await recoverTypedDataAddress({
      ...input.typedData,
      signature: input.signature as Hex,
    });
    if (recovered.toLowerCase() !== address.toLowerCase()) return undefined;
    const identity = Object.freeze({
      schemaVersion: '0.1' as const,
      accountId: input.expected.accountId,
      address,
      chainId: MONAD_TESTNET_CHAIN_ID as 10_143,
      network: 'monad-testnet' as const,
      providerId: 'eip712-compatible-wallet' as const,
      provenanceHash: keccak256(input.signature as Hex).slice(2),
      verifiedAt: new Date(now).toISOString(),
    });
    walletIdentityBrands.add(identity);
    return identity;
  } catch {
    return undefined;
  }
}

const WALLET_UNBINDING_TYPES = {
  WalletUnbinding: [
    { name: 'account', type: 'address' },
    { name: 'accountIdHash', type: 'bytes32' },
    { name: 'bindingGeneration', type: 'uint64' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'validUntil', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export type WalletUnbindingTypedData = Readonly<{
  domain: Readonly<{ name: 'NERVA Wallet Unbinding'; version: '1'; chainId: number; salt: Hex }>;
  types: typeof WALLET_UNBINDING_TYPES;
  primaryType: 'WalletUnbinding';
  message: Readonly<{
    account: Address;
    accountIdHash: Hex;
    bindingGeneration: bigint;
    issuedAt: bigint;
    validUntil: bigint;
    nonce: Hex;
  }>;
}>;

export function buildWalletUnbindingTypedData(input: {
  accountId: string;
  address: string;
  bindingGeneration: number;
  issuedAt: string;
  validUntil: string;
  nonce: string;
}): WalletUnbindingTypedData {
  const issuedAt = Date.parse(input.issuedAt);
  const validUntil = Date.parse(input.validUntil);
  if (
    !input.accountId ||
    input.accountId.length > 200 ||
    !Number.isSafeInteger(input.bindingGeneration) ||
    input.bindingGeneration < 1 ||
    !validTimestamp(input.issuedAt) ||
    !validTimestamp(input.validUntil) ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(validUntil) ||
    validUntil <= issuedAt ||
    validUntil - issuedAt > 300_000 ||
    !/^0x[0-9a-f]{64}$/.test(input.nonce)
  )
    throw new TypeError('Wallet-unbinding proof must be exact, fresh and nonce-bound');
  return {
    domain: {
      name: 'NERVA Wallet Unbinding',
      version: '1',
      chainId: MONAD_TESTNET_CHAIN_ID,
      salt: keccak256(stringToHex(`nerva-wallet-binding:${input.accountId}`)),
    },
    types: WALLET_UNBINDING_TYPES,
    primaryType: 'WalletUnbinding',
    message: {
      account: requiredAddress(input.address, 'wallet.address'),
      accountIdHash: keccak256(stringToHex(input.accountId)),
      bindingGeneration: BigInt(input.bindingGeneration),
      issuedAt: BigInt(issuedAt / 1_000),
      validUntil: BigInt(validUntil / 1_000),
      nonce: input.nonce as Hex,
    },
  };
}

export async function verifyWalletUnbinding(input: {
  accountId: string;
  address: string;
  bindingGeneration: number;
  typedData: WalletUnbindingTypedData;
  signature: string;
  now: string;
}): Promise<
  Readonly<{ signer: Address; proofRefHash: string; digest: string; nonceHash: string }> | undefined
> {
  try {
    const { typedData } = input;
    const now = Date.parse(input.now);
    const issuedAt = Number(typedData.message.issuedAt) * 1_000;
    const validUntil = Number(typedData.message.validUntil) * 1_000;
    if (
      !exactRecord(typedData, ['domain', 'types', 'primaryType', 'message']) ||
      !exactRecord(typedData.message, [
        'account',
        'accountIdHash',
        'bindingGeneration',
        'issuedAt',
        'validUntil',
        'nonce',
      ]) ||
      !Number.isFinite(now) ||
      !exactRecord(typedData.domain, ['name', 'version', 'chainId', 'salt']) ||
      typedData.domain.name !== 'NERVA Wallet Unbinding' ||
      typedData.domain.version !== '1' ||
      typedData.domain.chainId !== MONAD_TESTNET_CHAIN_ID ||
      typedData.domain.salt !== keccak256(stringToHex(`nerva-wallet-binding:${input.accountId}`)) ||
      typedData.primaryType !== 'WalletUnbinding' ||
      canonicalSerialize(typedData.types) !== canonicalSerialize(WALLET_UNBINDING_TYPES) ||
      typedData.message.account.toLowerCase() !== input.address.toLowerCase() ||
      typedData.message.accountIdHash !== keccak256(stringToHex(input.accountId)) ||
      typedData.message.bindingGeneration !== BigInt(input.bindingGeneration) ||
      issuedAt > now ||
      now - issuedAt > 300_000 ||
      validUntil <= now ||
      validUntil <= issuedAt ||
      validUntil - issuedAt > 300_000 ||
      !/^0x[0-9a-f]{64}$/.test(typedData.message.nonce)
    )
      return undefined;
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature: input.signature as Hex,
    });
    if (signer.toLowerCase() !== input.address.toLowerCase()) return undefined;
    return Object.freeze({
      signer,
      proofRefHash: keccak256(input.signature as Hex).slice(2),
      digest: hashTypedData(typedData).slice(2),
      nonceHash: await canonicalHash(typedData.message.nonce),
    });
  } catch {
    return undefined;
  }
}

export async function verifyAgentIdentity(input: {
  readonly identity: Readonly<{
    agentId: string;
    version: number;
    issuerId: string;
    provenanceHash: string;
    walletAddress: string;
    chainId: number;
  }>;
  readonly verifyIssuer: (identity: Readonly<Record<string, unknown>>) => Promise<boolean>;
}): Promise<AgentIdentity | undefined> {
  const value = input.identity;
  if (
    !value ||
    !exactRecord(value, [
      'agentId',
      'version',
      'issuerId',
      'provenanceHash',
      'walletAddress',
      'chainId',
    ]) ||
    typeof value.agentId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value.agentId) ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    typeof value.issuerId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value.issuerId) ||
    !HASH_PATTERN.test(value.provenanceHash) ||
    value.chainId !== MONAD_TESTNET_CHAIN_ID
  )
    return undefined;
  try {
    const walletAddress = requiredAddress(value.walletAddress, 'agent.walletAddress');
    if (!(await input.verifyIssuer(Object.freeze({ ...value, walletAddress })))) return undefined;
    const identity = Object.freeze({
      schemaVersion: '0.1' as const,
      ...value,
      walletAddress,
      chainId: MONAD_TESTNET_CHAIN_ID as 10_143,
    });
    agentIdentityBrands.add(identity);
    return identity;
  } catch {
    return undefined;
  }
}

/** Rehydrate only public identities loaded from the verified M04 persistence layer. */
export function restorePersistedWalletIdentity(input: WalletIdentity): WalletIdentity {
  if (
    !input ||
    input.schemaVersion !== '0.1' ||
    input.chainId !== MONAD_TESTNET_CHAIN_ID ||
    input.network !== 'monad-testnet' ||
    input.providerId !== 'eip712-compatible-wallet' ||
    !HASH_PATTERN.test(input.provenanceHash) ||
    !validTimestamp(input.verifiedAt)
  )
    throw new TypeError('Persisted wallet identity is invalid');
  const identity = Object.freeze({
    ...input,
    address: requiredAddress(input.address, 'wallet.address'),
  });
  walletIdentityBrands.add(identity);
  return identity;
}

/** Rehydrate a versioned identity only after the trusted issuer row has been loaded from storage. */
export function restorePersistedAgentIdentity(input: AgentIdentity): AgentIdentity {
  if (
    !input ||
    input.schemaVersion !== '0.1' ||
    input.chainId !== MONAD_TESTNET_CHAIN_ID ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    !HASH_PATTERN.test(input.provenanceHash)
  )
    throw new TypeError('Persisted agent identity is invalid');
  const identity = Object.freeze({
    ...input,
    walletAddress: requiredAddress(input.walletAddress, 'agent.walletAddress'),
  });
  agentIdentityBrands.add(identity);
  return identity;
}

export interface CapabilityGrantCandidate {
  readonly schemaVersion: '0.1';
  readonly grantId: string;
  readonly wallet: WalletIdentity;
  readonly agent: AgentIdentity;
  readonly policyHash: string;
  readonly scope: Readonly<{ positionId: string; marketSelector: string }>;
  readonly actions: readonly M04Action[];
  readonly limits: Readonly<{
    maxActionFractionBps: number;
    maxNotionalMicros: string;
    maxSlippageBps: number;
  }>;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revocationGeneration: number;
  readonly nonceDomain: string;
  readonly delegation: Readonly<{
    status: 'ABSENT' | 'ACTIVE';
    observationHash: string;
    delegateAddress?: string;
    delegateCodeHash?: string;
  }>;
}

export interface CompiledCapabilityGrant {
  readonly schemaVersion: '0.1';
  readonly grantId: string;
  readonly chainId: 10_143;
  readonly accountId: string;
  readonly walletAddress: Address;
  readonly agentId: string;
  readonly agentVersion: number;
  readonly policyHash: string;
  readonly scope: CapabilityGrantCandidate['scope'];
  readonly actions: readonly M04Action[];
  readonly limits: CapabilityGrantCandidate['limits'];
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revocationGeneration: number;
  readonly nonceDomain: string;
  readonly delegation: CapabilityGrantCandidate['delegation'];
  readonly digest: string;
  readonly source: CapabilityGrantCandidate;
}

export async function compileCapabilityGrant(
  input: CapabilityGrantCandidate,
): Promise<CompiledCapabilityGrant> {
  const root = exactRecord(input, [
    'schemaVersion',
    'grantId',
    'wallet',
    'agent',
    'policyHash',
    'scope',
    'actions',
    'limits',
    'issuedAt',
    'expiresAt',
    'revocationGeneration',
    'nonceDomain',
    'delegation',
  ]);
  const scope = exactRecord(input?.scope, ['positionId', 'marketSelector']);
  const limits = exactRecord(input?.limits, [
    'maxActionFractionBps',
    'maxNotionalMicros',
    'maxSlippageBps',
  ]);
  const delegation = input?.delegation;
  const delegationKeys =
    delegation?.status === 'ACTIVE'
      ? ['status', 'observationHash', 'delegateAddress', 'delegateCodeHash']
      : ['status', 'observationHash'];
  if (
    !root ||
    root.schemaVersion !== '0.1' ||
    typeof root.grantId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(root.grantId) ||
    !walletIdentityBrands.has(input.wallet) ||
    !agentIdentityBrands.has(input.agent) ||
    input.wallet.chainId !== MONAD_TESTNET_CHAIN_ID ||
    input.wallet.network !== 'monad-testnet' ||
    input.agent.chainId !== MONAD_TESTNET_CHAIN_ID ||
    input.wallet.address.toLowerCase() !== input.agent.walletAddress.toLowerCase() ||
    typeof root.policyHash !== 'string' ||
    !HASH_PATTERN.test(root.policyHash) ||
    !scope ||
    typeof scope.positionId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(scope.positionId) ||
    typeof scope.marketSelector !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(scope.marketSelector) ||
    !Array.isArray(input.actions) ||
    input.actions.length < 1 ||
    input.actions.length > 3 ||
    input.actions.some(
      (action) => !['REDUCE_POSITION', 'CLOSE_POSITION', 'NO_ACTION'].includes(action),
    ) ||
    new Set(input.actions).size !== input.actions.length ||
    !limits ||
    !Number.isSafeInteger(limits.maxActionFractionBps) ||
    Number(limits.maxActionFractionBps) < 1 ||
    Number(limits.maxActionFractionBps) > 10_000 ||
    typeof limits.maxNotionalMicros !== 'string' ||
    !/^[1-9][0-9]{0,37}$/.test(limits.maxNotionalMicros) ||
    !Number.isSafeInteger(limits.maxSlippageBps) ||
    Number(limits.maxSlippageBps) < 0 ||
    Number(limits.maxSlippageBps) > 2_000 ||
    !validTimestamp(root.issuedAt) ||
    !validTimestamp(root.expiresAt) ||
    Date.parse(root.expiresAt) <= Date.parse(root.issuedAt) ||
    (Date.parse(root.expiresAt) - Date.parse(root.issuedAt)) / 1_000 > MAX_GRANT_SECONDS ||
    !Number.isSafeInteger(root.revocationGeneration) ||
    Number(root.revocationGeneration) < 0 ||
    typeof root.nonceDomain !== 'string' ||
    !/^nerva:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(root.nonceDomain) ||
    !exactRecord(delegation, delegationKeys) ||
    !['ABSENT', 'ACTIVE'].includes(String(delegation?.status)) ||
    typeof delegation?.observationHash !== 'string' ||
    !HASH_PATTERN.test(delegation.observationHash) ||
    (delegation?.status === 'ACTIVE' &&
      (typeof delegation.delegateAddress !== 'string' ||
        !ADDRESS_PATTERN.test(delegation.delegateAddress) ||
        typeof delegation.delegateCodeHash !== 'string' ||
        !HASH_PATTERN.test(delegation.delegateCodeHash)))
  )
    throw new TypeError('Capability grant is invalid, unverified, unbounded or outside M04 scope');
  const canonicalActions = Object.freeze(
    (['CLOSE_POSITION', 'NO_ACTION', 'REDUCE_POSITION'] as const).filter((action) =>
      input.actions.includes(action),
    ),
  );
  const normalized = Object.freeze({
    schemaVersion: '0.1' as const,
    grantId: input.grantId,
    wallet: input.wallet,
    agent: input.agent,
    policyHash: input.policyHash,
    scope: Object.freeze({ positionId: scope.positionId, marketSelector: scope.marketSelector }),
    actions: canonicalActions,
    limits: Object.freeze({
      maxActionFractionBps: Number(limits.maxActionFractionBps),
      maxNotionalMicros: limits.maxNotionalMicros,
      maxSlippageBps: Number(limits.maxSlippageBps),
    }),
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    revocationGeneration: Number(input.revocationGeneration),
    nonceDomain: input.nonceDomain,
    delegation: Object.freeze({
      status: input.delegation.status,
      observationHash: input.delegation.observationHash,
      ...(input.delegation.status === 'ACTIVE'
        ? {
            delegateAddress: getAddress(input.delegation.delegateAddress!),
            delegateCodeHash: input.delegation.delegateCodeHash,
          }
        : {}),
    }),
  });
  const digest = await canonicalHash({
    schemaVersion: normalized.schemaVersion,
    grantId: normalized.grantId,
    chainId: input.wallet.chainId,
    accountId: input.wallet.accountId,
    walletAddress: input.wallet.address.toLowerCase(),
    agentId: input.agent.agentId,
    agentVersion: input.agent.version,
    issuerId: input.agent.issuerId,
    agentProvenanceHash: input.agent.provenanceHash,
    policyHash: normalized.policyHash,
    scope: normalized.scope,
    actions: normalized.actions,
    limits: normalized.limits,
    issuedAt: normalized.issuedAt,
    expiresAt: normalized.expiresAt,
    revocationGeneration: normalized.revocationGeneration,
    nonceDomain: normalized.nonceDomain,
    delegation: normalized.delegation,
  });
  return Object.freeze({
    schemaVersion: '0.1',
    grantId: normalized.grantId,
    chainId: MONAD_TESTNET_CHAIN_ID,
    accountId: input.wallet.accountId,
    walletAddress: input.wallet.address,
    agentId: input.agent.agentId,
    agentVersion: input.agent.version,
    policyHash: normalized.policyHash,
    scope: normalized.scope,
    actions: normalized.actions,
    limits: normalized.limits,
    issuedAt: normalized.issuedAt,
    expiresAt: normalized.expiresAt,
    revocationGeneration: normalized.revocationGeneration,
    nonceDomain: normalized.nonceDomain,
    delegation: normalized.delegation,
    digest,
    source: normalized as CapabilityGrantCandidate,
  });
}

/** Rehydrates a public persisted grant; signatures and secret material are never part of it. */
export async function restoreCompiledCapabilityGrant(input: {
  readonly source: CapabilityGrantCandidate;
  readonly wallet: WalletIdentity;
  readonly agent: AgentIdentity;
}): Promise<CompiledCapabilityGrant> {
  const wallet = restorePersistedWalletIdentity(input.wallet);
  const agent = restorePersistedAgentIdentity(input.agent);
  return compileCapabilityGrant({ ...input.source, wallet, agent });
}

const AUTHORIZATION_TYPES = {
  M04Authorization: [
    { name: 'account', type: 'address' },
    { name: 'agentIdHash', type: 'bytes32' },
    { name: 'grantHash', type: 'bytes32' },
    { name: 'policyHash', type: 'bytes32' },
    { name: 'planDigest', type: 'bytes32' },
    { name: 'action', type: 'uint8' },
    { name: 'validUntil', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'nonceDomainHash', type: 'bytes32' },
    { name: 'revocationGeneration', type: 'uint64' },
    { name: 'delegationHash', type: 'bytes32' },
  ],
} as const;

export type AuthorizationTypedData = Readonly<{
  domain: Readonly<{
    name: 'NERVA Permission Authorization';
    version: '1';
    chainId: number;
    salt: Hex;
  }>;
  types: typeof AUTHORIZATION_TYPES;
  primaryType: 'M04Authorization';
  message: Readonly<{
    account: Address;
    agentIdHash: Hex;
    grantHash: Hex;
    policyHash: Hex;
    planDigest: Hex;
    action: number;
    validUntil: bigint;
    nonce: Hex;
    nonceDomainHash: Hex;
    revocationGeneration: bigint;
    delegationHash: Hex;
  }>;
}>;

const GRANT_APPROVAL_TYPES = {
  CapabilityGrantApproval: [
    { name: 'account', type: 'address' },
    { name: 'agentIdHash', type: 'bytes32' },
    { name: 'grantHash', type: 'bytes32' },
    { name: 'policyHash', type: 'bytes32' },
    { name: 'grantExpiresAt', type: 'uint64' },
    { name: 'authorizationExpiresAt', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'nonceDomainHash', type: 'bytes32' },
    { name: 'revocationGeneration', type: 'uint64' },
  ],
} as const;

export type GrantApprovalTypedData = Readonly<{
  domain: Readonly<{
    name: 'NERVA Capability Grant Approval';
    version: '1';
    chainId: number;
    salt: Hex;
  }>;
  types: typeof GRANT_APPROVAL_TYPES;
  primaryType: 'CapabilityGrantApproval';
  message: Readonly<{
    account: Address;
    agentIdHash: Hex;
    grantHash: Hex;
    policyHash: Hex;
    grantExpiresAt: bigint;
    authorizationExpiresAt: bigint;
    nonce: Hex;
    nonceDomainHash: Hex;
    revocationGeneration: bigint;
  }>;
}>;

export function buildGrantApprovalTypedData(input: {
  readonly grant: CompiledCapabilityGrant;
  readonly authorizationExpiresAt: string;
  readonly nonce: string;
  readonly now: string;
}): GrantApprovalTypedData {
  const now = Date.parse(input.now);
  const authExpires = Date.parse(input.authorizationExpiresAt);
  if (
    input.grant.chainId !== MONAD_TESTNET_CHAIN_ID ||
    !validTimestamp(input.now) ||
    !validTimestamp(input.authorizationExpiresAt) ||
    !Number.isSafeInteger(authExpires) ||
    !Number.isFinite(now) ||
    authExpires <= now ||
    authExpires - now > 300_000 ||
    !/^0x[0-9a-f]{64}$/.test(input.nonce)
  )
    throw new TypeError('Grant approval signature must be fresh and nonce-bound');
  return {
    domain: {
      name: 'NERVA Capability Grant Approval',
      version: '1',
      chainId: MONAD_TESTNET_CHAIN_ID,
      salt: `0x${input.grant.digest}` as Hex,
    },
    types: GRANT_APPROVAL_TYPES,
    primaryType: 'CapabilityGrantApproval',
    message: {
      account: input.grant.walletAddress,
      agentIdHash: keccak256(stringToHex(`${input.grant.agentId}:${input.grant.agentVersion}`)),
      grantHash: `0x${input.grant.digest}` as Hex,
      policyHash: `0x${input.grant.policyHash}` as Hex,
      grantExpiresAt: BigInt(Date.parse(input.grant.expiresAt) / 1_000),
      authorizationExpiresAt: BigInt(authExpires / 1_000),
      nonce: input.nonce as Hex,
      nonceDomainHash: keccak256(stringToHex(input.grant.nonceDomain)),
      revocationGeneration: BigInt(input.grant.revocationGeneration),
    },
  };
}

export async function verifyGrantApproval(input: {
  readonly grant: CompiledCapabilityGrant;
  readonly typedData: GrantApprovalTypedData;
  readonly signature: string;
  readonly now: string;
}): Promise<
  Readonly<{ signer: Address; proofRefHash: string; digest: string; nonceHash: string }> | undefined
> {
  try {
    const { grant, typedData } = input;
    const message = typedData.message;
    const now = Date.parse(input.now);
    const authExpires = Number(message.authorizationExpiresAt) * 1_000;
    if (
      !Number.isFinite(now) ||
      !exactRecord(typedData, ['domain', 'types', 'primaryType', 'message']) ||
      !exactRecord(message, [
        'account',
        'agentIdHash',
        'grantHash',
        'policyHash',
        'grantExpiresAt',
        'authorizationExpiresAt',
        'nonce',
        'nonceDomainHash',
        'revocationGeneration',
      ]) ||
      !exactRecord(typedData.domain, ['name', 'version', 'chainId', 'salt']) ||
      typedData.domain.name !== 'NERVA Capability Grant Approval' ||
      typedData.domain.version !== '1' ||
      typedData.domain.chainId !== MONAD_TESTNET_CHAIN_ID ||
      typedData.domain.salt !== `0x${grant.digest}` ||
      typedData.primaryType !== 'CapabilityGrantApproval' ||
      canonicalSerialize(typedData.types) !== canonicalSerialize(GRANT_APPROVAL_TYPES) ||
      message.account.toLowerCase() !== grant.walletAddress.toLowerCase() ||
      message.agentIdHash !== keccak256(stringToHex(`${grant.agentId}:${grant.agentVersion}`)) ||
      message.grantHash !== `0x${grant.digest}` ||
      message.policyHash !== `0x${grant.policyHash}` ||
      message.grantExpiresAt !== BigInt(Date.parse(grant.expiresAt) / 1_000) ||
      message.nonceDomainHash !== keccak256(stringToHex(grant.nonceDomain)) ||
      message.revocationGeneration !== BigInt(grant.revocationGeneration) ||
      !/^0x[0-9a-f]{64}$/.test(message.nonce) ||
      authExpires <= now ||
      authExpires - now > 300_000
    )
      return undefined;
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature: input.signature as Hex,
    });
    if (signer.toLowerCase() !== grant.walletAddress.toLowerCase()) return undefined;
    return Object.freeze({
      signer,
      proofRefHash: keccak256(input.signature as Hex).slice(2),
      digest: hashTypedData(typedData).slice(2),
      nonceHash: await canonicalHash(message.nonce),
    });
  } catch {
    return undefined;
  }
}

export function hashGrantApprovalTypedData(typedData: GrantApprovalTypedData): string {
  return hashTypedData(typedData).slice(2);
}

const GRANT_REVOCATION_TYPES = {
  CapabilityGrantRevocation: [
    { name: 'account', type: 'address' },
    { name: 'grantHash', type: 'bytes32' },
    { name: 'reasonHash', type: 'bytes32' },
    { name: 'revocationGeneration', type: 'uint64' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'validUntil', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export type GrantRevocationTypedData = Readonly<{
  domain: Readonly<{
    name: 'NERVA Capability Grant Revocation';
    version: '1';
    chainId: number;
    salt: Hex;
  }>;
  types: typeof GRANT_REVOCATION_TYPES;
  primaryType: 'CapabilityGrantRevocation';
  message: Readonly<{
    account: Address;
    grantHash: Hex;
    reasonHash: Hex;
    revocationGeneration: bigint;
    issuedAt: bigint;
    validUntil: bigint;
    nonce: Hex;
  }>;
}>;

export function buildGrantRevocationTypedData(input: {
  readonly grant: CompiledCapabilityGrant;
  readonly reasonCode: string;
  readonly revocationGeneration: number;
  readonly issuedAt: string;
  readonly validUntil: string;
  readonly nonce: string;
}): GrantRevocationTypedData {
  const issuedAt = Date.parse(input.issuedAt);
  const validUntil = Date.parse(input.validUntil);
  if (
    input.grant.chainId !== MONAD_TESTNET_CHAIN_ID ||
    !/^[A-Z0-9_]{1,100}$/.test(input.reasonCode) ||
    !Number.isSafeInteger(input.revocationGeneration) ||
    input.revocationGeneration < 0 ||
    !validTimestamp(input.issuedAt) ||
    !validTimestamp(input.validUntil) ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(validUntil) ||
    validUntil <= issuedAt ||
    validUntil - issuedAt > 300_000 ||
    !/^0x[0-9a-f]{64}$/.test(input.nonce)
  )
    throw new TypeError('Grant revocation proof must be exact, fresh and nonce-bound');
  return {
    domain: {
      name: 'NERVA Capability Grant Revocation',
      version: '1',
      chainId: MONAD_TESTNET_CHAIN_ID,
      salt: `0x${input.grant.digest}` as Hex,
    },
    types: GRANT_REVOCATION_TYPES,
    primaryType: 'CapabilityGrantRevocation',
    message: {
      account: input.grant.walletAddress,
      grantHash: `0x${input.grant.digest}` as Hex,
      reasonHash: keccak256(stringToHex(input.reasonCode)),
      revocationGeneration: BigInt(input.revocationGeneration),
      issuedAt: BigInt(issuedAt / 1_000),
      validUntil: BigInt(validUntil / 1_000),
      nonce: input.nonce as Hex,
    },
  };
}

export async function verifyGrantRevocation(input: {
  readonly grant: CompiledCapabilityGrant;
  readonly reasonCode: string;
  readonly generation: number;
  readonly typedData: GrantRevocationTypedData;
  readonly signature: string;
  readonly now: string;
}): Promise<
  Readonly<{ signer: Address; proofRefHash: string; digest: string; nonceHash: string }> | undefined
> {
  try {
    const { grant, typedData } = input;
    const now = Date.parse(input.now);
    const issuedAt = Number(typedData.message.issuedAt) * 1_000;
    const validUntil = Number(typedData.message.validUntil) * 1_000;
    if (
      !Number.isFinite(now) ||
      !validTimestamp(input.now) ||
      !exactRecord(typedData, ['domain', 'types', 'primaryType', 'message']) ||
      !exactRecord(typedData.message, [
        'account',
        'grantHash',
        'reasonHash',
        'revocationGeneration',
        'issuedAt',
        'validUntil',
        'nonce',
      ]) ||
      !exactRecord(typedData.domain, ['name', 'version', 'chainId', 'salt']) ||
      typedData.domain.name !== 'NERVA Capability Grant Revocation' ||
      typedData.domain.version !== '1' ||
      typedData.domain.chainId !== MONAD_TESTNET_CHAIN_ID ||
      typedData.domain.salt !== `0x${grant.digest}` ||
      typedData.primaryType !== 'CapabilityGrantRevocation' ||
      canonicalSerialize(typedData.types) !== canonicalSerialize(GRANT_REVOCATION_TYPES) ||
      typedData.message.account.toLowerCase() !== grant.walletAddress.toLowerCase() ||
      typedData.message.grantHash !== `0x${grant.digest}` ||
      typedData.message.reasonHash !== keccak256(stringToHex(input.reasonCode)) ||
      typedData.message.revocationGeneration !== BigInt(input.generation) ||
      issuedAt > now ||
      now - issuedAt > 300_000 ||
      validUntil <= now ||
      validUntil <= issuedAt ||
      validUntil - issuedAt > 300_000 ||
      !/^0x[0-9a-f]{64}$/.test(typedData.message.nonce)
    )
      return undefined;
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature: input.signature as Hex,
    });
    if (signer.toLowerCase() !== grant.walletAddress.toLowerCase()) return undefined;
    return Object.freeze({
      signer,
      proofRefHash: keccak256(input.signature as Hex).slice(2),
      digest: hashTypedData(typedData).slice(2),
      nonceHash: await canonicalHash(typedData.message.nonce),
    });
  } catch {
    return undefined;
  }
}

export function hashAuthorizationTypedData(typedData: AuthorizationTypedData): string {
  return hashTypedData(typedData).slice(2);
}

export function buildAuthorizationTypedData(input: {
  readonly grant: CompiledCapabilityGrant;
  readonly planDigest: string;
  readonly action: M04Action;
  readonly validUntil: string;
  readonly nonce: string;
  readonly revocationGeneration: number;
}): AuthorizationTypedData {
  const grant = input.grant;
  const validUntil = Date.parse(input.validUntil) / 1_000;
  if (
    grant.chainId !== MONAD_TESTNET_CHAIN_ID ||
    !grant.actions.includes(input.action) ||
    !HASH_PATTERN.test(input.planDigest) ||
    !validTimestamp(input.validUntil) ||
    !Number.isSafeInteger(validUntil) ||
    validUntil > Date.parse(grant.expiresAt) / 1_000 ||
    !/^0x[0-9a-f]{64}$/.test(input.nonce) ||
    input.revocationGeneration !== grant.revocationGeneration
  )
    throw new TypeError('Authorization request does not fit its exact live grant');
  const delegationHash =
    grant.delegation.status === 'ABSENT'
      ? ZERO_HASH
      : keccak256(
          stringToHex(
            `${grant.delegation.delegateAddress!.toLowerCase()}:${grant.delegation.delegateCodeHash}`,
          ),
        );
  return {
    domain: {
      name: 'NERVA Permission Authorization',
      version: '1',
      chainId: MONAD_TESTNET_CHAIN_ID,
      salt: `0x${grant.digest}` as Hex,
    },
    types: AUTHORIZATION_TYPES,
    primaryType: 'M04Authorization',
    message: {
      account: grant.walletAddress,
      agentIdHash: keccak256(stringToHex(`${grant.agentId}:${grant.agentVersion}`)),
      grantHash: `0x${grant.digest}` as Hex,
      policyHash: `0x${grant.policyHash}` as Hex,
      planDigest: `0x${input.planDigest}` as Hex,
      action: actionCode(input.action),
      validUntil: BigInt(validUntil),
      nonce: input.nonce as Hex,
      nonceDomainHash: keccak256(stringToHex(grant.nonceDomain)),
      revocationGeneration: BigInt(input.revocationGeneration),
      delegationHash,
    },
  };
}

export interface VerifiedAuthorization {
  readonly signer: Address;
  readonly proofRefHash: string;
  readonly typedDataDigest: string;
  readonly grantHash: string;
  readonly planDigest: string;
  readonly action: M04Action;
  readonly expiresAt: string;
  readonly nonceHash: string;
}

export async function verifyAuthorization(input: {
  readonly grant: CompiledCapabilityGrant;
  readonly typedData: AuthorizationTypedData;
  readonly signature: string;
  readonly expected: Readonly<{
    planDigest: string;
    action: M04Action;
    now: string;
    signer: string;
    revocationGeneration: number;
    delegationObservationHash: string;
  }>;
}): Promise<VerifiedAuthorization | undefined> {
  try {
    const { grant, typedData, expected } = input;
    const message = typedData.message;
    const expectedSigner = requiredAddress(expected.signer, 'authorization signer');
    const validUntil = Number(message.validUntil) * 1_000;
    const now = Date.parse(expected.now);
    const expectedDelegationHash =
      grant.delegation.status === 'ABSENT'
        ? ZERO_HASH
        : keccak256(
            stringToHex(
              `${grant.delegation.delegateAddress!.toLowerCase()}:${grant.delegation.delegateCodeHash}`,
            ),
          );
    if (
      grant.chainId !== MONAD_TESTNET_CHAIN_ID ||
      !exactRecord(typedData, ['domain', 'types', 'primaryType', 'message']) ||
      !exactRecord(message, [
        'account',
        'agentIdHash',
        'grantHash',
        'policyHash',
        'planDigest',
        'action',
        'validUntil',
        'nonce',
        'nonceDomainHash',
        'revocationGeneration',
        'delegationHash',
      ]) ||
      !HASH_PATTERN.test(expected.planDigest) ||
      !HASH_PATTERN.test(expected.delegationObservationHash) ||
      !Number.isFinite(now) ||
      expected.revocationGeneration !== grant.revocationGeneration ||
      expected.delegationObservationHash !== grant.delegation.observationHash ||
      !exactRecord(typedData.domain, ['name', 'version', 'chainId', 'salt']) ||
      typedData.domain.name !== 'NERVA Permission Authorization' ||
      typedData.domain.version !== '1' ||
      typedData.domain.chainId !== MONAD_TESTNET_CHAIN_ID ||
      typedData.domain.salt !== `0x${grant.digest}` ||
      typedData.primaryType !== 'M04Authorization' ||
      canonicalSerialize(typedData.types) !== canonicalSerialize(AUTHORIZATION_TYPES) ||
      message.account.toLowerCase() !== grant.walletAddress.toLowerCase() ||
      message.agentIdHash !== keccak256(stringToHex(`${grant.agentId}:${grant.agentVersion}`)) ||
      message.grantHash !== `0x${grant.digest}` ||
      message.policyHash !== `0x${grant.policyHash}` ||
      message.planDigest !== `0x${expected.planDigest}` ||
      message.action !== actionCode(expected.action) ||
      !grant.actions.includes(expected.action) ||
      message.revocationGeneration !== BigInt(expected.revocationGeneration) ||
      message.delegationHash !== expectedDelegationHash ||
      validUntil <= now ||
      validUntil > Date.parse(grant.expiresAt) ||
      validUntil - now > 300_000 ||
      !/^0x[0-9a-f]{64}$/.test(message.nonce) ||
      message.nonceDomainHash !== keccak256(stringToHex(grant.nonceDomain))
    )
      return undefined;
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature: input.signature as Hex,
    });
    if (
      signer.toLowerCase() !== expectedSigner.toLowerCase() ||
      signer.toLowerCase() !== grant.walletAddress.toLowerCase()
    )
      return undefined;
    return Object.freeze({
      signer,
      proofRefHash: keccak256(input.signature as Hex).slice(2),
      typedDataDigest: hashTypedData(typedData).slice(2),
      grantHash: grant.digest,
      planDigest: expected.planDigest,
      action: expected.action,
      expiresAt: new Date(validUntil).toISOString(),
      nonceHash: await canonicalHash(message.nonce),
    });
  } catch {
    return undefined;
  }
}

export interface Eip7702Delegation {
  readonly status: M04DelegateStatus;
  readonly delegateAddress?: Address;
  readonly delegateCodeHash?: string;
  readonly observedAt?: string;
  readonly blockNumber?: string;
  readonly blockHash?: string;
  readonly reason?: string;
}

export function isCurrentM04DelegationObservation(input: {
  readonly expected: Readonly<{
    status: 'ABSENT' | 'ACTIVE';
    delegateAddress?: string;
    delegateCodeHash?: string;
  }>;
  readonly observation?: Eip7702Delegation;
  readonly observedAt?: string;
  readonly now: string;
}): boolean {
  const now = Date.parse(input.now);
  const observedAt = input.observedAt ? Date.parse(input.observedAt) : Number.NaN;
  const observation = input.observation;
  if (
    !Number.isFinite(now) ||
    !validTimestamp(input.now) ||
    !observation ||
    !validTimestamp(input.observedAt) ||
    observation.status !== input.expected.status ||
    !Number.isFinite(observedAt) ||
    observedAt > now ||
    now - observedAt > 30_000
  )
    return false;
  if (input.expected.status === 'ABSENT') return true;
  return (
    typeof input.expected.delegateAddress === 'string' &&
    typeof input.expected.delegateCodeHash === 'string' &&
    observation.delegateAddress?.toLowerCase() === input.expected.delegateAddress.toLowerCase() &&
    observation.delegateCodeHash === input.expected.delegateCodeHash
  );
}

export function classifyEip7702Code(code: string, previous?: Eip7702Delegation): Eip7702Delegation {
  if (typeof code !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(code))
    return Object.freeze({ status: 'UNKNOWN', reason: 'RPC_CODE_MALFORMED' });
  const normalized = code.toLowerCase();
  if (normalized === '0x') {
    if (previous?.status === 'ACTIVE' || previous?.status === 'CHANGED')
      return Object.freeze({ status: 'REVOKED', reason: 'DELEGATION_CLEARED' });
    return Object.freeze({ status: 'ABSENT' });
  }
  if (!normalized.startsWith('0xef0100'))
    return Object.freeze({ status: 'UNKNOWN', reason: 'UNSUPPORTED_NON_EMPTY_WALLET_CODE' });
  if (!/^0xef0100[0-9a-f]{40}$/.test(normalized))
    return Object.freeze({ status: 'UNKNOWN', reason: 'DELEGATION_INDICATOR_MALFORMED' });
  const delegateAddress = getAddress(`0x${normalized.slice(8)}`);
  const changed =
    (previous?.status === 'ACTIVE' || previous?.status === 'CHANGED') &&
    previous.delegateAddress?.toLowerCase() !== delegateAddress.toLowerCase();
  return Object.freeze({
    status: changed ? 'CHANGED' : 'ACTIVE',
    delegateAddress,
    ...(previous?.delegateAddress?.toLowerCase() === delegateAddress.toLowerCase() &&
    previous.delegateCodeHash
      ? { delegateCodeHash: previous.delegateCodeHash }
      : {}),
    ...(changed ? { reason: 'DELEGATION_TARGET_OR_CODE_CHANGED' } : {}),
  });
}

export interface DelegationReadPort {
  chainId(): Promise<number>;
  finalizedBlock(): Promise<Readonly<{ number: string; hash: string }>>;
  codeAtBlockHash(account: Address, blockHash: string): Promise<string>;
}

export async function observeEip7702Delegation(input: {
  readonly port: DelegationReadPort;
  readonly account: string;
  readonly expectedChainId: number;
  readonly now: string;
  readonly previous?: Eip7702Delegation;
}): Promise<Eip7702Delegation> {
  try {
    const account = requiredAddress(input.account, 'delegation account');
    if (input.expectedChainId !== MONAD_TESTNET_CHAIN_ID || !validTimestamp(input.now))
      return Object.freeze({ status: 'UNKNOWN', reason: 'CHAIN_OR_CLOCK_UNVERIFIED' });
    if ((await input.port.chainId()) !== input.expectedChainId)
      return Object.freeze({ status: 'UNKNOWN', reason: 'RPC_CHAIN_MISMATCH' });
    const before = await input.port.finalizedBlock();
    if (!/^(0|[1-9][0-9]*)$/.test(before.number) || !/^0x[0-9a-f]{64}$/.test(before.hash))
      return Object.freeze({ status: 'UNKNOWN', reason: 'FINALIZED_BLOCK_UNVERIFIED' });
    const code = await input.port.codeAtBlockHash(account, before.hash);
    let classified = classifyEip7702Code(code, input.previous);
    if (classified.status === 'ACTIVE' || classified.status === 'CHANGED') {
      const delegateCode = await input.port.codeAtBlockHash(
        classified.delegateAddress!,
        before.hash,
      );
      if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(delegateCode))
        return Object.freeze({ status: 'UNKNOWN', reason: 'DELEGATE_RUNTIME_CODE_UNAVAILABLE' });
      const delegateCodeHash = keccak256(delegateCode as Hex).slice(2);
      const priorActive =
        input.previous?.status === 'ACTIVE' || input.previous?.status === 'CHANGED';
      const runtimeChanged =
        priorActive &&
        input.previous?.delegateAddress?.toLowerCase() ===
          classified.delegateAddress!.toLowerCase() &&
        input.previous.delegateCodeHash !== delegateCodeHash;
      classified = Object.freeze({
        status: runtimeChanged ? 'CHANGED' : classified.status,
        delegateAddress: classified.delegateAddress,
        delegateCodeHash,
        ...(runtimeChanged ? { reason: 'DELEGATE_RUNTIME_CODE_CHANGED' } : {}),
      });
    }
    const after = await input.port.finalizedBlock();
    if (before.number !== after.number || before.hash !== after.hash)
      return Object.freeze({ status: 'UNKNOWN', reason: 'FINALIZED_BLOCK_CHANGED_DURING_READ' });
    const observedAt = new Date(input.now).toISOString();
    if (classified.status === 'UNKNOWN') return classified;
    return Object.freeze({
      ...classified,
      observedAt,
      blockNumber: before.number,
      blockHash: before.hash,
    });
  } catch {
    return Object.freeze({ status: 'UNKNOWN', reason: 'DELEGATION_READ_UNAVAILABLE' });
  }
}

export interface SessionAuthority {
  readonly schemaVersion: '0.1';
  readonly sessionId: string;
  readonly grantId: string;
  readonly grantHash: string;
  readonly chainId: 10_143;
  readonly accountId: string;
  readonly walletAddress: Address;
  readonly agentId: string;
  readonly policyHash: string;
  readonly actions: readonly M04Action[];
  readonly maxActionFractionBps: number;
  readonly maxNotionalMicros: string;
  readonly maxSlippageBps: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly nonceDomain: string;
  readonly revocationGeneration: number;
  readonly delegationObservationHash: string;
  readonly digest: string;
}

export async function deriveSessionAuthority(input: {
  readonly sessionId: string;
  readonly grant: CompiledCapabilityGrant;
  readonly actions: readonly M04Action[];
  readonly maxActionFractionBps: number;
  readonly maxNotionalMicros: string;
  readonly maxSlippageBps: number;
  readonly expiresAt: string;
  readonly nonceDomain: string;
  readonly now: string;
}): Promise<SessionAuthority> {
  const grant = input.grant;
  const now = Date.parse(input.now);
  const expiry = Date.parse(input.expiresAt);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(input.sessionId) ||
    grant.chainId !== MONAD_TESTNET_CHAIN_ID ||
    !validTimestamp(input.now) ||
    !validTimestamp(input.expiresAt) ||
    expiry <= now ||
    expiry > Date.parse(grant.expiresAt) ||
    (expiry - now) / 1_000 > MAX_SESSION_SECONDS ||
    !Array.isArray(input.actions) ||
    input.actions.length < 1 ||
    input.actions.some((action) => !grant.actions.includes(action)) ||
    new Set(input.actions).size !== input.actions.length ||
    !isSubsetNumber(input.maxActionFractionBps, grant.limits.maxActionFractionBps) ||
    input.maxActionFractionBps < 1 ||
    !/^[1-9][0-9]{0,37}$/.test(input.maxNotionalMicros) ||
    BigInt(input.maxNotionalMicros) > BigInt(grant.limits.maxNotionalMicros) ||
    !isSubsetNumber(input.maxSlippageBps, grant.limits.maxSlippageBps) ||
    !/^nerva:session:[A-Za-z0-9][A-Za-z0-9._:-]{0,150}$/.test(input.nonceDomain) ||
    input.nonceDomain === grant.nonceDomain
  )
    throw new TypeError('Session authority expands, outlives or is not bound to its live grant');
  const actions = Object.freeze(
    (['CLOSE_POSITION', 'NO_ACTION', 'REDUCE_POSITION'] as const).filter((action) =>
      input.actions.includes(action),
    ),
  );
  const canonical = {
    schemaVersion: '0.1' as const,
    sessionId: input.sessionId,
    grantId: grant.grantId,
    grantHash: grant.digest,
    chainId: grant.chainId,
    accountId: grant.accountId,
    walletAddress: grant.walletAddress,
    agentId: grant.agentId,
    policyHash: grant.policyHash,
    actions,
    maxActionFractionBps: input.maxActionFractionBps,
    maxNotionalMicros: input.maxNotionalMicros,
    maxSlippageBps: input.maxSlippageBps,
    issuedAt: new Date(now).toISOString(),
    expiresAt: input.expiresAt,
    nonceDomain: input.nonceDomain,
    revocationGeneration: grant.revocationGeneration,
    delegationObservationHash: grant.delegation.observationHash,
  };
  return Object.freeze({ ...canonical, digest: await canonicalHash(canonical) });
}

const SESSION_REVOCATION_TYPES = {
  SessionRevocation: [
    { name: 'account', type: 'address' },
    { name: 'sessionIdHash', type: 'bytes32' },
    { name: 'sessionHash', type: 'bytes32' },
    { name: 'grantHash', type: 'bytes32' },
    { name: 'revocationGeneration', type: 'uint64' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'validUntil', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export type SessionRevocationTypedData = Readonly<{
  domain: Readonly<{
    name: 'NERVA Session Revocation';
    version: '1';
    chainId: number;
    salt: Hex;
  }>;
  types: typeof SESSION_REVOCATION_TYPES;
  primaryType: 'SessionRevocation';
  message: Readonly<{
    account: Address;
    sessionIdHash: Hex;
    sessionHash: Hex;
    grantHash: Hex;
    revocationGeneration: bigint;
    issuedAt: bigint;
    validUntil: bigint;
    nonce: Hex;
  }>;
}>;

export function buildSessionRevocationTypedData(input: {
  readonly sessionId: string;
  readonly sessionHash: string;
  readonly grant: CompiledCapabilityGrant;
  readonly revocationGeneration: number;
  readonly issuedAt: string;
  readonly validUntil: string;
  readonly nonce: string;
}): SessionRevocationTypedData {
  const issuedAt = Date.parse(input.issuedAt);
  const validUntil = Date.parse(input.validUntil);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(input.sessionId) ||
    !HASH_PATTERN.test(input.sessionHash) ||
    input.grant.chainId !== MONAD_TESTNET_CHAIN_ID ||
    !Number.isSafeInteger(input.revocationGeneration) ||
    input.revocationGeneration < 0 ||
    !validTimestamp(input.issuedAt) ||
    !validTimestamp(input.validUntil) ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(validUntil) ||
    validUntil <= issuedAt ||
    validUntil - issuedAt > 300_000 ||
    !/^0x[0-9a-f]{64}$/.test(input.nonce)
  )
    throw new TypeError('Session revocation proof must be exact, fresh and nonce-bound');
  return {
    domain: {
      name: 'NERVA Session Revocation',
      version: '1',
      chainId: MONAD_TESTNET_CHAIN_ID,
      salt: keccak256(stringToHex(`${input.grant.digest}:${input.sessionId}`)),
    },
    types: SESSION_REVOCATION_TYPES,
    primaryType: 'SessionRevocation',
    message: {
      account: input.grant.walletAddress,
      sessionIdHash: keccak256(stringToHex(input.sessionId)),
      sessionHash: `0x${input.sessionHash}` as Hex,
      grantHash: `0x${input.grant.digest}` as Hex,
      revocationGeneration: BigInt(input.revocationGeneration),
      issuedAt: BigInt(issuedAt / 1_000),
      validUntil: BigInt(validUntil / 1_000),
      nonce: input.nonce as Hex,
    },
  };
}

export async function verifySessionRevocation(input: {
  readonly sessionId: string;
  readonly sessionHash: string;
  readonly grant: CompiledCapabilityGrant;
  readonly generation: number;
  readonly typedData: SessionRevocationTypedData;
  readonly signature: string;
  readonly now: string;
}): Promise<
  Readonly<{ signer: Address; proofRefHash: string; digest: string; nonceHash: string }> | undefined
> {
  try {
    const { grant, typedData } = input;
    const now = Date.parse(input.now);
    const issuedAt = Number(typedData.message.issuedAt) * 1_000;
    const validUntil = Number(typedData.message.validUntil) * 1_000;
    const expectedSalt = keccak256(stringToHex(`${grant.digest}:${input.sessionId}`));
    if (
      !Number.isFinite(now) ||
      !validTimestamp(input.now) ||
      grant.chainId !== MONAD_TESTNET_CHAIN_ID ||
      !HASH_PATTERN.test(input.sessionHash) ||
      !exactRecord(typedData, ['domain', 'types', 'primaryType', 'message']) ||
      !exactRecord(typedData.message, [
        'account',
        'sessionIdHash',
        'sessionHash',
        'grantHash',
        'revocationGeneration',
        'issuedAt',
        'validUntil',
        'nonce',
      ]) ||
      !exactRecord(typedData.domain, ['name', 'version', 'chainId', 'salt']) ||
      typedData.domain.name !== 'NERVA Session Revocation' ||
      typedData.domain.version !== '1' ||
      typedData.domain.chainId !== MONAD_TESTNET_CHAIN_ID ||
      typedData.domain.salt !== expectedSalt ||
      typedData.primaryType !== 'SessionRevocation' ||
      canonicalSerialize(typedData.types) !== canonicalSerialize(SESSION_REVOCATION_TYPES) ||
      typedData.message.account.toLowerCase() !== grant.walletAddress.toLowerCase() ||
      typedData.message.sessionIdHash !== keccak256(stringToHex(input.sessionId)) ||
      typedData.message.sessionHash !== `0x${input.sessionHash}` ||
      typedData.message.grantHash !== `0x${grant.digest}` ||
      typedData.message.revocationGeneration !== BigInt(input.generation) ||
      issuedAt > now ||
      now - issuedAt > 300_000 ||
      validUntil <= now ||
      validUntil <= issuedAt ||
      validUntil - issuedAt > 300_000 ||
      !/^0x[0-9a-f]{64}$/.test(typedData.message.nonce)
    )
      return undefined;
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature: input.signature as Hex,
    });
    if (signer.toLowerCase() !== grant.walletAddress.toLowerCase()) return undefined;
    return Object.freeze({
      signer,
      proofRefHash: keccak256(input.signature as Hex).slice(2),
      digest: hashTypedData(typedData).slice(2),
      nonceHash: await canonicalHash(typedData.message.nonce),
    });
  } catch {
    return undefined;
  }
}

export type PermissionEvidenceKind =
  | 'WALLET_BOUND'
  | 'AGENT_VERIFIED'
  | 'GRANT_COMPILED'
  | 'AUTHORIZATION_VERIFIED'
  | 'DELEGATION_OBSERVED'
  | 'SESSION_ISSUED'
  | 'SESSION_REVOKED'
  | 'NONCE_CONSUMED'
  | 'AUTHORITY_REVOKED'
  | 'M03_DECISION'
  | 'AUTHORIZATION_REFUSED';
export interface PermissionEvidenceInput {
  readonly kind: PermissionEvidenceKind;
  readonly subjectRef: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly result: 'PASS' | 'REFUSED' | 'UNKNOWN';
  readonly reasonCode: string;
}
export interface PermissionEvidenceRecord extends PermissionEvidenceInput {
  readonly schemaVersion: '0.1';
  readonly sequence: number;
  readonly previousHash: string;
  readonly hash: string;
}

export async function appendPermissionEvidence(
  previous: PermissionEvidenceRecord | undefined,
  input: PermissionEvidenceInput,
): Promise<PermissionEvidenceRecord> {
  if (
    !input ||
    !exactRecord(input, [
      'kind',
      'subjectRef',
      'correlationId',
      'occurredAt',
      'result',
      'reasonCode',
    ]) ||
    ![
      'WALLET_BOUND',
      'AGENT_VERIFIED',
      'GRANT_COMPILED',
      'AUTHORIZATION_VERIFIED',
      'DELEGATION_OBSERVED',
      'SESSION_ISSUED',
      'SESSION_REVOKED',
      'NONCE_CONSUMED',
      'AUTHORITY_REVOKED',
      'M03_DECISION',
      'AUTHORIZATION_REFUSED',
    ].includes(input.kind) ||
    typeof input.subjectRef !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(input.subjectRef) ||
    typeof input.correlationId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(input.correlationId) ||
    !validTimestamp(input.occurredAt) ||
    !['PASS', 'REFUSED', 'UNKNOWN'].includes(input.result) ||
    typeof input.reasonCode !== 'string' ||
    !/^[A-Z0-9_]{1,100}$/.test(input.reasonCode)
  )
    throw new TypeError('Permission evidence record is invalid or contains unapproved fields');
  const body = {
    schemaVersion: '0.1' as const,
    sequence: previous ? previous.sequence + 1 : 1,
    previousHash: previous?.hash ?? '0'.repeat(64),
    ...input,
  };
  return Object.freeze({ ...body, hash: await canonicalHash(body) });
}

export async function verifyPermissionEvidenceChain(
  records: readonly PermissionEvidenceRecord[],
): Promise<boolean> {
  try {
    let previous: PermissionEvidenceRecord | undefined;
    for (const record of records) {
      if (
        !exactRecord(record, [
          'schemaVersion',
          'sequence',
          'previousHash',
          'kind',
          'subjectRef',
          'correlationId',
          'occurredAt',
          'result',
          'reasonCode',
          'hash',
        ])
      )
        return false;
      const expected = await appendPermissionEvidence(previous, {
        kind: record.kind,
        subjectRef: record.subjectRef,
        correlationId: record.correlationId,
        occurredAt: record.occurredAt,
        result: record.result,
        reasonCode: record.reasonCode,
      });
      if (
        record.schemaVersion !== expected.schemaVersion ||
        record.sequence !== expected.sequence ||
        record.previousHash !== expected.previousHash ||
        record.hash !== expected.hash
      )
        return false;
      previous = record;
    }
    return true;
  } catch {
    return false;
  }
}
