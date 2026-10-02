# M02 observation and risk operations

M02 observes Perpl through public REST/market WebSocket streams and, when configured, API-key reads with exact `read` scope. The adapter signs those API read requests as documented by Perpl. NERVA does not accept wallet keys and has no transaction, order, or financial execution path.

## Configuration

The worker starts safely with observation disabled. Configure the following on the server only:

| Variable                                                       | Meaning                                                        | Default                        |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------ |
| `PERPL_OBSERVATION_ENABLED`                                    | Enable read-only collection when PostgreSQL is configured      | `false`                        |
| `PERPL_CHAIN_ID`                                               | Monad mainnet `143` or testnet `10143`                         | Derived from NERVA environment |
| `PERPL_API_URL`                                                | Perpl REST origin plus `/api`                                  | Network-specific official host |
| `PERPL_WS_URL`                                                 | Perpl WebSocket origin                                         | Network-specific official host |
| `PERPL_MARKET_FRESHNESS_MS`                                    | Maximum public market source age                               | `5000`                         |
| `PERPL_ACCOUNT_FRESHNESS_MS`                                   | Maximum account/position source age                            | `15000`                        |
| `PERPL_RECONNECT_MIN_MS` / `PERPL_RECONNECT_MAX_MS`            | Bounded reconnect delay range                                  | `250` / `30000`                |
| `PERPL_API_KEY`, `PERPL_API_KEY_SECRET`, `PERPL_API_KEY_SCOPE` | Complete optional read key tuple; scope must be exactly `read` | Unset                          |

Do not add API credentials to a client-side environment, database, fixture, or evidence bundle. Missing credentials leave authenticated account data `UNAVAILABLE`; an explicit provider 404 produces `NO_ACCOUNT`.

## Read surfaces

- `GET /api/risk/portfolio` — latest risk snapshot, source quality and limitations.
- `GET /api/risk/positions/{positionId}` — position and associated risk metrics.
- `GET /api/integrations/health` — latest per-provider/stream state.
- `GET /api/market/context` — current persisted normalized markets and quality.

The dashboard is server-rendered from these read models, defaults to English, and offers Brazilian Portuguese (`pt-BR`) and Spanish (`es`). Demo fixtures are visibly labelled when demo mode is enabled. No API in this increment mutates an account or position.

## Risk interpretation

Amounts are decimal strings and use integer/BigInt arithmetic. Position notional is rounded up: `ceil(size_scaled × mark_scaled / 10^(size_decimals + price_decimals − 6))` in micro-units. Token collateral and equity are rounded down when reduced to micro-units. The Q16 residue of entry price is converted exactly using `10^16 / 65536` before comparison. Adverse movement is the non-negative direction-aware difference from entry to mark, divided by entry and expressed in basis points; it excludes fees, realized PnL and accrued funding. Collateral-to-notional and single-quote-token concentration are ratios; mixed quote tokens remain unknown because no cross-token conversion is admitted. Portfolio drawdown is peak-to-current over chronological points in the Perpl day series; an empty/short series remains `UNKNOWN`.

Funding rate is shown in Perpl micro-rate units and retains the interval identity as source metadata. The API's `ppl` is not exposed as normalized risk because exact account-debit scale and side semantics are not proven; funding direction remains `UNKNOWN`. Margin safety and `LIQUIDATION_DISTANCE_BPS` are `UNAVAILABLE_UNPROVEN`. The SDK formula alone does not establish all external API scaling/current funding inputs required by the Work Order.

Freshness uses the older of the provider event age and receipt age. A stale/unknown required source makes the overall risk snapshot non-actionable. Sequence gaps invalidate the relevant stream, close it, and trigger reconnect/resnapshot. Repeated `feb` funding updates replace the same market/interval record.

## Validation

`npm run perpl:smoke` performs unauthenticated public reads of Perpl context and ticker for the configured network. It is manual evidence, not a CI dependency. `npm run risk:benchmark` records the in-memory one-position p95. CI applies migrations to an empty database and to a throwaway database first initialized with the accepted M01 schema. The upgrade script refuses to run unless `NERVA_ALLOW_DISPOSABLE_DATABASE=true` is explicitly set for a disposable CI database.
