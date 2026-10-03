const chainId = Number(process.env.PERPL_CHAIN_ID ?? '143');
if (chainId !== 143 && chainId !== 10_143) throw new Error('PERPL_CHAIN_ID must be 143 or 10143');
const expectedHost = chainId === 143 ? 'app.perpl.xyz' : 'testnet.perpl.xyz';
const api = new URL(process.env.PERPL_API_URL ?? `https://${expectedHost}/api`);
if (
  api.protocol !== 'https:' ||
  api.hostname !== expectedHost ||
  api.pathname.replace(/\/$/, '') !== '/api'
)
  throw new Error('Public smoke URL does not match the selected Perpl network');

async function get(target) {
  const response = await fetch(new URL(target, `${api.origin}/`), {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Public Perpl ${target} returned HTTP ${response.status}`);
  return response.json();
}
const context = await get('/api/v1/pub/context');
const ticker = await get('/api/v1/market-data/ticker');
if (
  Number(context?.chain?.chain_id) !== chainId ||
  !Array.isArray(context.markets) ||
  !Array.isArray(context.tokens)
)
  throw new Error('Public Perpl context did not match the requested chain or documented schema');
if (
  !ticker?.d ||
  typeof ticker.d !== 'object' ||
  Array.isArray(ticker.d) ||
  Object.keys(ticker.d).length === 0
)
  throw new Error('Public Perpl ticker did not include market data');
console.log(
  JSON.stringify({
    ok: true,
    authenticated: false,
    chainId,
    apiHost: api.hostname,
    marketCount: context.markets.length,
    tickerMarketCount: Object.keys(ticker.d).length,
    endpoints: ['/v1/pub/context', '/v1/market-data/ticker'],
  }),
);
