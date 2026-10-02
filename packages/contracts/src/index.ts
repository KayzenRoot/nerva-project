import { z } from 'zod';

const bps = z.number().int().min(0).max(10_000);
const positiveBps = z.number().int().min(1).max(10_000);
// M01 admits only a non-connected preview capability; provider capabilities enter in later modules.
const protocol = z.literal('generic-risk-preview-v0');
const market = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._/-]*$/i);

const TriggerSchema = z
  .object({
    family: z.enum(['LIQUIDATION_MARGIN_THRESHOLD', 'DRAWDOWN_THRESHOLD', 'FUNDING_THRESHOLD']),
    thresholdBps: positiveBps,
  })
  .strict();

export const PolicySchemaV0_1 = z
  .object({
    schemaVersion: z.literal('0.1'),
    policyId: z.string().trim().min(1).max(200),
    version: z.number().int().positive().max(2_147_483_647),
    environment: z.enum(['LOCAL', 'TESTNET_DEMO', 'MAINNET_READONLY', 'MAINNET_EXECUTION']),
    scope: z
      .object({
        network: z.enum(['monad-mainnet', 'monad-testnet', 'local']),
        protocolCapability: protocol,
        marketSelector: market,
      })
      .strict(),
    triggers: z.array(TriggerSchema).min(1).max(16),
    actionIntent: z
      .object({
        family: z.enum(['REDUCE_POSITION', 'CLOSE_POSITION']),
        maxActionFractionBps: positiveBps,
      })
      .strict(),
    constraints: z
      .object({
        maxActionFractionBps: positiveBps,
        maxNotionalMicros: z.string().regex(/^[1-9][0-9]{0,37}$/),
        maxSlippageBps: bps,
        cooldownSeconds: z.number().int().min(0).max(31_536_000),
        expiresAt: z.iso.datetime({ offset: true }),
        allowedProtocols: z.array(protocol).min(1).max(16),
        allowedMarkets: z.array(market).min(1).max(64),
      })
      .strict(),
    safetyBehavior: z.literal('REFUSE'),
    metadata: z
      .object({
        label: z.string().trim().min(1).max(80),
        description: z.string().trim().max(500),
      })
      .strict(),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.actionIntent.maxActionFractionBps > policy.constraints.maxActionFractionBps) {
      context.addIssue({
        code: 'custom',
        path: ['actionIntent', 'maxActionFractionBps'],
        message: 'Action exceeds configured maximum',
      });
    }
    if (!policy.constraints.allowedProtocols.includes(policy.scope.protocolCapability)) {
      context.addIssue({
        code: 'custom',
        path: ['constraints', 'allowedProtocols'],
        message: 'Scope protocol is not explicitly allowed',
      });
    }
    if (!policy.constraints.allowedMarkets.includes(policy.scope.marketSelector)) {
      context.addIssue({
        code: 'custom',
        path: ['constraints', 'allowedMarkets'],
        message: 'Scope market is not explicitly allowed',
      });
    }
    const triggerFamilies = policy.triggers.map((trigger) => trigger.family);
    if (new Set(triggerFamilies).size !== triggerFamilies.length) {
      context.addIssue({
        code: 'custom',
        path: ['triggers'],
        message: 'Duplicate or conflicting trigger family',
      });
    }
    if (
      new Set(policy.constraints.allowedProtocols).size !==
      policy.constraints.allowedProtocols.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['constraints', 'allowedProtocols'],
        message: 'Duplicate protocol capability',
      });
    }
    if (
      new Set(policy.constraints.allowedMarkets).size !== policy.constraints.allowedMarkets.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['constraints', 'allowedMarkets'],
        message: 'Duplicate market selector',
      });
    }
    if (policy.environment === 'MAINNET_EXECUTION') {
      context.addIssue({
        code: 'custom',
        path: ['environment'],
        message: 'MAINNET_EXECUTION is disabled in M01',
      });
    }
    const requiredNetwork = {
      LOCAL: 'local',
      TESTNET_DEMO: 'monad-testnet',
      MAINNET_READONLY: 'monad-mainnet',
      MAINNET_EXECUTION: 'monad-mainnet',
    }[policy.environment];
    if (policy.scope.network !== requiredNetwork) {
      context.addIssue({
        code: 'custom',
        path: ['scope', 'network'],
        message: 'Network does not match the configured trust environment',
      });
    }
  });

export type PolicyV0_1 = z.infer<typeof PolicySchemaV0_1>;

export const HealthResponseSchema = z
  .object({
    status: z.enum(['live', 'ready', 'not_ready']),
    module: z.literal('M01'),
    environment: z.enum(['LOCAL', 'TESTNET_DEMO', 'MAINNET_READONLY']),
    executionEnabled: z.literal(false),
    timestamp: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    code: z.string().min(1),
    message: z.string().min(1),
    correlationId: z.string().min(1),
  })
  .strict();

export const ReadModelStatusSchema = z.enum([
  'AVAILABLE',
  'NO_ACCOUNT',
  'NO_POSITION',
  'STALE',
  'UNAVAILABLE',
]);
const ObservationQualitySchema = z.enum(['FRESH', 'STALE', 'UNKNOWN', 'INCONSISTENT']);
export const ObservationSourceM02Schema = z
  .object({
    source: z.string().min(1).max(100),
    network: z.enum(['local', 'monad-mainnet', 'monad-testnet']),
    chainId: z.number().int().positive(),
    observedAt: z.iso.datetime({ offset: true }),
    receivedAt: z.iso.datetime({ offset: true }),
    sourceBlock: z
      .string()
      .regex(/^(?:0|[1-9][0-9]*)$/)
      .optional(),
    sequence: z
      .string()
      .regex(/^(?:0|[1-9][0-9]*)$/)
      .optional(),
    sessionId: z.string().max(200).optional(),
    quality: ObservationQualitySchema,
    correlationId: z.string().min(1).max(200),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export const MarketSnapshotM02Schema = z
  .object({
    schemaVersion: z.literal('0.1'),
    snapshotId: z.string().min(1).max(200),
    marketId: z.string().regex(/^[1-9][0-9]*$/),
    symbol: z.string().min(1).max(100),
    priceDecimals: z.number().int().min(0).max(30),
    sizeDecimals: z.number().int().min(0).max(30),
    markPriceScaled: z.string().regex(/^[1-9][0-9]*$/),
    oraclePriceScaled: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .optional(),
    quoteToken: z.string().min(1).max(50),
    fundingIntervalId: z
      .string()
      .regex(/^(?:0|[1-9][0-9]*)$/)
      .optional(),
    fundingRateMicros: z
      .string()
      .regex(/^(?:0|-?[1-9][0-9]*)$/)
      .optional(),
    source: ObservationSourceM02Schema,
  })
  .strict();
export const PositionSnapshotM02Schema = z
  .object({
    schemaVersion: z.literal('0.1'),
    snapshotId: z.string().min(1).max(200),
    positionId: z.string().regex(/^[1-9][0-9]*$/),
    marketId: z.string().regex(/^[1-9][0-9]*$/),
    symbol: z.string().min(1).max(100),
    side: z.enum(['LONG', 'SHORT']),
    sizeScaled: z.string().regex(/^[1-9][0-9]*$/),
    sizeDecimals: z.number().int().min(0).max(30),
    entryPriceScaled: z.string().regex(/^[1-9][0-9]*$/),
    entryPriceDecimals: z.number().int().min(0).max(46),
    markPriceScaled: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .optional(),
    markPriceDecimals: z.number().int().min(0).max(30).optional(),
    collateralMicros: z.string().regex(/^(?:0|[1-9][0-9]*)$/),
    quoteToken: z.string().min(1).max(50),
    source: ObservationSourceM02Schema,
  })
  .strict();
const RiskMetricM02Schema = z
  .object({
    name: z.string().min(1).max(100),
    value: z.string().max(120).optional(),
    valueBps: z.number().int().min(0).max(10_000).optional(),
    unit: z.enum(['basis-points', 'micro-units', 'milliseconds', 'count', 'status']).optional(),
    quality: ObservationQualitySchema,
    observedAt: z.iso.datetime({ offset: true }),
    source: z.string().min(1).max(100).optional(),
    reason: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict();

export const RiskSnapshotM02Schema = z
  .object({
    schemaVersion: z.literal('0.1'),
    snapshotId: z.string().min(1).max(200),
    snapshotHash: z.string().regex(/^[0-9a-f]{64}$/),
    generatedAt: z.iso.datetime({ offset: true }),
    observedAt: z.iso.datetime({ offset: true }),
    quality: ObservationQualitySchema,
    actionable: z.boolean(),
    correlationId: z.string().min(1).max(200).optional(),
    sourceSnapshotHashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)),
    metrics: z.array(RiskMetricM02Schema),
    limitations: z.array(z.string().min(1).max(500)),
    liquidationDistance: z
      .object({
        status: z.literal('UNAVAILABLE_UNPROVEN'),
        reason: z.string().min(1).max(500),
      })
      .strict(),
  })
  .strict()
  .refine(
    (snapshot) => snapshot.actionable === false,
    'M02 observations can never be execution eligible',
  );

export const IndexedEvidenceReferenceM02Schema = z
  .object({
    schemaVersion: z.literal('0.1'),
    provider: z.literal('envio'),
    network: z.enum(['monad-mainnet', 'monad-testnet']),
    chainId: z.union([z.literal(143), z.literal(10_143)]),
    sourceBlock: z.string().regex(/^(?:0|[1-9][0-9]*)$/),
    observedAt: z.iso.datetime({ offset: true }),
    receivedAt: z.iso.datetime({ offset: true }),
    lagMs: z.number().int().min(0),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    authority: z.literal('ADVISORY_ONLY'),
  })
  .strict()
  .refine(
    (evidence) =>
      evidence.network === 'monad-mainnet' ? evidence.chainId === 143 : evidence.chainId === 10_143,
    'Indexed evidence network and chain identity must match',
  );

export const IntegrationHealthM02Schema = z
  .object({
    schemaVersion: z.literal('0.1'),
    integration: z.string().min(1).max(100),
    status: z.enum(['UNKNOWN', 'HEALTHY', 'DEGRADED', 'STALE', 'UNAVAILABLE']),
    observedAt: z.iso.datetime({ offset: true }),
    correlationId: z.string().min(1).max(200),
    reason: z.string().max(500).optional(),
    lastGoodAt: z.iso.datetime({ offset: true }).optional(),
    ageMs: z.number().int().min(0).optional(),
    reconnectCount: z.number().int().min(0).optional(),
    checkpoint: z
      .object({
        schemaVersion: z.literal('0.1'),
        provider: z.string().min(1).max(100),
        stream: z.string().min(1).max(100),
        chainId: z.number().int().positive(),
        sessionId: z.string().max(200).optional(),
        sequence: z
          .string()
          .regex(/^(?:0|[1-9][0-9]*)$/)
          .optional(),
        sourceBlock: z
          .string()
          .regex(/^(?:0|[1-9][0-9]*)$/)
          .optional(),
        observedAt: z.iso.datetime({ offset: true }),
        quality: ObservationQualitySchema,
        reconnectCount: z.number().int().min(0),
      })
      .strict()
      .optional(),
  })
  .strict();
