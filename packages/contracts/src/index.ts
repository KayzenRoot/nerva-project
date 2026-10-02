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
