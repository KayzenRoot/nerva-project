import type { DelegationReadPort } from '@nerva/permissions';

const ENDPOINT = 'https://testnet-rpc.monad.xyz';
const REQUEST_TIMEOUT_MS = 3_000;
const MAX_BODY = 64_000;

async function rpc(method: string, params: readonly unknown[]): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'nerva-m04-read-only', method, params }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('RPC_HTTP_STATUS_INVALID');
  const text = await response.text();
  if (text.length > MAX_BODY) throw new Error('RPC_RESPONSE_TOO_LARGE');
  const envelope: unknown = JSON.parse(text);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope))
    throw new Error('RPC_ENVELOPE_INVALID');
  const record = envelope as Record<string, unknown>;
  if (
    record.jsonrpc !== '2.0' ||
    record.id !== 'nerva-m04-read-only' ||
    record.error ||
    !('result' in record)
  )
    throw new Error('RPC_RESULT_UNVERIFIED');
  return record.result;
}

export function createMonadTestnetDelegationReadPort(): DelegationReadPort {
  return Object.freeze({
    async chainId() {
      const result = await rpc('eth_chainId', []);
      if (typeof result !== 'string' || !/^0x[0-9a-f]+$/i.test(result))
        throw new Error('RPC_CHAIN_ID_INVALID');
      return Number(BigInt(result));
    },
    async finalizedBlock() {
      const result = await rpc('eth_getBlockByNumber', ['finalized', false]);
      if (!result || typeof result !== 'object' || Array.isArray(result))
        throw new Error('RPC_FINALIZED_BLOCK_INVALID');
      const block = result as Record<string, unknown>;
      if (typeof block.number !== 'string' || typeof block.hash !== 'string')
        throw new Error('RPC_FINALIZED_BLOCK_INVALID');
      return { number: BigInt(block.number).toString(), hash: block.hash };
    },
    async codeAtBlockHash(account: string, blockHash: string) {
      const result = await rpc('eth_getCode', [account, { blockHash, requireCanonical: true }]);
      if (typeof result !== 'string') throw new Error('RPC_CODE_INVALID');
      return result;
    },
  });
}
