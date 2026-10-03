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

const M03MetricSchema = z
  .object({
    metric: z.enum(['POSITION_ADVERSE_MOVE_BPS', 'PORTFOLIO_DRAWDOWN_BPS']),
    operator: z.literal('GTE'),
    thresholdBps: positiveBps,
  })
  .strict();

const M03PolicyActionSchema = z
  .object({
    family: z.enum(['REDUCE_POSITION', 'CLOSE_POSITION', 'NO_ACTION']),
    maxActionFractionBps: bps,
  })
  .strict();

const canonicalUnsignedDecimal = z.string().regex(/^(?:0|[1-9][0-9]{0,37})$/);
const boundedActorRef = z.string().trim().min(1).max(200);

/** M03 policy authority. It is deliberately separate from M01's preview-only contract. */
export const M03PolicySchemaV0_1 = z
  .object({
    schemaVersion: z.literal('0.1'),
    policyId: z.string().trim().min(1).max(200),
    version: z.number().int().min(1).max(2_147_483_647),
    createdByActorRef: boundedActorRef,
    environment: z.enum([
      'LOCAL',
      'TESTNET_DEMO',
      'TESTNET',
      'MAINNET_READONLY',
      'MAINNET_EXECUTION',
    ]),
    scope: z
      .object({
        network: z.enum(['local', 'monad-testnet', 'monad-mainnet']),
        protocolCapability: z.literal('perpl-protective-v0'),
        accountId: z.string().regex(/^[1-9][0-9]{0,19}$/),
        positionId: z.string().regex(/^[1-9][0-9]{0,19}$/),
        marketSelector: market,
      })
      .strict(),
    triggers: z.array(M03MetricSchema).min(1).max(2),
    actionIntent: M03PolicyActionSchema,
    constraints: z
      .object({
        maxActionFractionBps: bps,
        maxReducibleQuantityScaled: canonicalUnsignedDecimal,
        maxNotionalMicros: canonicalUnsignedDecimal,
        maxSlippageBps: bps,
        cooldownSeconds: z.number().int().min(0).max(31_536_000),
        expiresAt: z.iso.datetime({ offset: true }),
        maxPlanAgeSeconds: z.number().int().min(1).max(300),
        allowedProtocols: z.array(z.literal('perpl-protective-v0')).length(1),
        allowedMarkets: z.array(market).min(1).max(64),
        fallbackAction: z.literal('NO_ACTION'),
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
    const expectedNetwork = {
      LOCAL: 'local',
      TESTNET_DEMO: 'monad-testnet',
      TESTNET: 'monad-testnet',
      MAINNET_READONLY: 'monad-mainnet',
      MAINNET_EXECUTION: 'monad-mainnet',
    }[policy.environment];
    if (policy.scope.network !== expectedNetwork) {
      context.addIssue({
        code: 'custom',
        path: ['scope', 'network'],
        message: 'Network does not match the environment',
      });
    }
    if (policy.environment === 'MAINNET_EXECUTION') {
      context.addIssue({
        code: 'custom',
        path: ['environment'],
        message: 'Effectful MAINNET execution is hard-blocked',
      });
    }
    if (policy.environment === 'MAINNET_READONLY' && policy.actionIntent.family !== 'NO_ACTION') {
      context.addIssue({
        code: 'custom',
        path: ['actionIntent', 'family'],
        message: 'MAINNET_READONLY permits only NO_ACTION',
      });
    }
    if (
      policy.actionIntent.maxActionFractionBps > policy.constraints.maxActionFractionBps ||
      !policy.constraints.allowedMarkets.includes(policy.scope.marketSelector)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['constraints'],
        message: 'Action or market exceeds the declared policy bounds',
      });
    }
    if (
      new Set(policy.triggers.map((trigger) => trigger.metric)).size !== policy.triggers.length ||
      new Set(policy.constraints.allowedMarkets).size !== policy.constraints.allowedMarkets.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['triggers'],
        message: 'Duplicate triggers or allowed markets are ambiguous',
      });
    }
    if (policy.actionIntent.family === 'NO_ACTION') {
      if (
        policy.actionIntent.maxActionFractionBps !== 0 ||
        policy.constraints.maxActionFractionBps !== 0 ||
        policy.constraints.maxReducibleQuantityScaled !== '0' ||
        policy.constraints.maxNotionalMicros !== '0' ||
        policy.constraints.maxSlippageBps !== 0
      ) {
        context.addIssue({
          code: 'custom',
          path: ['actionIntent'],
          message: 'NO_ACTION must have zero quantity, notional, slippage and action bounds',
        });
      }
    } else if (
      policy.actionIntent.maxActionFractionBps < 1 ||
      policy.constraints.maxActionFractionBps < 1 ||
      policy.constraints.maxReducibleQuantityScaled === '0' ||
      policy.constraints.maxNotionalMicros === '0'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['actionIntent'],
        message: 'Protective actions require positive bounded quantity and notional',
      });
    } else if (
      policy.actionIntent.family === 'CLOSE_POSITION' &&
      (policy.actionIntent.maxActionFractionBps !== 10_000 ||
        policy.constraints.maxActionFractionBps !== 10_000)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['actionIntent', 'maxActionFractionBps'],
        message: 'CLOSE_POSITION must bind the exact full position',
      });
    } else if (
      policy.actionIntent.family === 'REDUCE_POSITION' &&
      policy.actionIntent.maxActionFractionBps >= 10_000
    ) {
      context.addIssue({
        code: 'custom',
        path: ['actionIntent', 'maxActionFractionBps'],
        message: 'REDUCE_POSITION must strictly reduce and cannot close the full position',
      });
    }
    if (policy.environment === 'TESTNET_DEMO' && policy.actionIntent.family !== 'NO_ACTION') {
      // Demo policies can be simulated but never dispatched; the execution adapter independently refuses them.
    }
  });

export type M03PolicyV0_1 = z.infer<typeof M03PolicySchemaV0_1>;

export const M03ProposalSchemaV0_1 = z
  .object({
    schemaVersion: z.literal('0.1'),
    proposalId: z.string().trim().min(1).max(200),
    source: z.enum(['NATURAL_LANGUAGE', 'STRUCTURED']),
    untrusted: z.literal(true),
    languageInput: z.string().max(2_000).optional(),
    proposedPolicy: z.unknown(),
    diagnostics: z.array(z.string().max(500)).max(32),
  })
  .strict();

export const M03ActorConfirmationProofSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    issuer: boundedActorRef,
    subject: boundedActorRef,
    audience: z.literal('nerva-policy-confirmation-v1'),
    policyHash: z.string().regex(/^[0-9a-f]{64}$/),
    nonce: z.string().min(16).max(200),
    keyId: z.string().trim().min(1).max(200),
    issuedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    signature: z.string().min(32).max(2_048),
  })
  .strict();

export const M03PolicyControlProofSchemaV0_1 = z
  .object({
    schemaVersion: z.literal('0.1'),
    policyId: z.string().trim().min(1).max(200),
    policyVersionHash: z.string().regex(/^[0-9a-f]{64}$/),
    action: z.enum(['PAUSE', 'REVOKE']),
    issuer: boundedActorRef,
    subject: boundedActorRef,
    audience: z.literal('nerva-policy-control-v1'),
    nonce: z.string().min(16).max(200),
    keyId: z.string().trim().min(1).max(200),
    issuedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    signature: z.string().min(32).max(2_048),
  })
  .strict();

export const M03ExecutionAuthorizationProofSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    issuer: boundedActorRef,
    subject: boundedActorRef,
    audience: z.literal('nerva-testnet-execution-v1'),
    environment: z.literal('TESTNET'),
    network: z.literal('monad-testnet'),
    chainId: z.literal(10_143),
    policyHash: z.string().regex(/^[0-9a-f]{64}$/),
    planDigest: z.string().regex(/^[0-9a-f]{64}$/),
    accountId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    positionId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    action: z.enum(['REDUCE_POSITION', 'CLOSE_POSITION']),
    scope: z.array(z.enum(['REDUCE_POSITION', 'CLOSE_POSITION'])).length(1),
    nonce: z.string().min(16).max(200),
    keyId: z.string().trim().min(1).max(200),
    issuedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    signature: z.string().min(32).max(2_048),
  })
  .strict()
  .refine(
    (proof) => proof.scope[0] === proof.action,
    'Authorization scope must contain only the exact action',
  );

export const M04WalletBindingRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    accountId: z.string().trim().min(1).max(200),
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    chainId: z.literal(10_143),
    issuedAt: z.iso.datetime({ offset: true }),
    validUntil: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .optional(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04AgentRegistrationRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    agentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    version: z.number().int().min(1).max(2_147_483_647),
    issuer: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    keyId: z.string().trim().min(1).max(200),
    walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    chainId: z.literal(10_143),
    issuedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z.string().min(32).max(2_048),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04GrantRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    grantId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    agentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    agentVersion: z.number().int().min(1).max(2_147_483_647),
    policyHash: z.string().regex(/^[0-9a-f]{64}$/),
    scope: z
      .object({
        positionId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
        marketSelector: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/),
      })
      .strict(),
    actions: z
      .array(z.enum(['REDUCE_POSITION', 'CLOSE_POSITION', 'NO_ACTION']))
      .min(1)
      .max(3),
    limits: z
      .object({
        maxActionFractionBps: z.number().int().min(1).max(10_000),
        maxNotionalMicros: z.string().regex(/^[1-9][0-9]{0,37}$/),
        maxSlippageBps: z.number().int().min(0).max(2_000),
      })
      .strict(),
    issuedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    authorizationExpiresAt: z.iso.datetime({ offset: true }),
    nonceDomain: z.string().regex(/^nerva:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/),
    revocationGeneration: z.number().int().min(0).max(2_147_483_647),
    delegationObservationHash: z.string().regex(/^[0-9a-f]{64}$/),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .optional(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04AuthorizationRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    grantId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    authority: z.enum(['grant', 'session']).default('grant'),
    sessionId: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/)
      .optional(),
    sessionHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    planDigest: z.string().regex(/^[0-9a-f]{64}$/),
    action: z.enum(['REDUCE_POSITION', 'CLOSE_POSITION', 'NO_ACTION']),
    validUntil: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .optional(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.authority === 'session' && (!value.sessionId || !value.sessionHash)) ||
      (value.authority === 'grant' &&
        (value.sessionId !== undefined || value.sessionHash !== undefined))
    )
      context.addIssue({
        code: 'custom',
        message: 'Authority selector must bind one exact grant or session.',
      });
  });

export const M04DelegationObserveRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    accountId: z.string().trim().min(1).max(200),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04ReadModelChallengeRequestSchema = z
  .object({
    accountId: z.string().trim().min(1).max(200),
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04ReadModelRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    accountId: z.string().trim().min(1).max(200),
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    chainId: z.literal(10_143),
    issuedAt: z.iso.datetime({ offset: true }),
    validUntil: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04SessionRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    grantId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    sessionId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    actions: z
      .array(z.enum(['REDUCE_POSITION', 'CLOSE_POSITION', 'NO_ACTION']))
      .min(1)
      .max(3),
    maxActionFractionBps: z.number().int().min(1).max(10_000),
    maxNotionalMicros: z.string().regex(/^[1-9][0-9]{0,37}$/),
    maxSlippageBps: z.number().int().min(0).max(2_000),
    expiresAt: z.iso.datetime({ offset: true }),
    nonceDomain: z.string().regex(/^nerva:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/),
    issuedAt: z.iso.datetime({ offset: true }),
    validUntil: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .optional(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04SessionRevocationRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    sessionId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    issuedAt: z.iso.datetime({ offset: true }),
    validUntil: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .optional(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04GrantRevocationRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    grantId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
    reasonCode: z.enum(['USER_REVOKED', 'POLICY_CHANGED', 'SCOPE_RETIRED']),
    issuedAt: z.iso.datetime({ offset: true }),
    validUntil: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .optional(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M04WalletUnbindingRequestSchema = z
  .object({
    schemaVersion: z.literal('0.1'),
    accountId: z.string().trim().min(1).max(200),
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    chainId: z.literal(10_143),
    bindingGeneration: z.number().int().min(1).max(2_147_483_647),
    issuedAt: z.iso.datetime({ offset: true }),
    validUntil: z.iso.datetime({ offset: true }),
    nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
    signature: z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .optional(),
    correlationId: z.string().trim().min(1).max(200),
  })
  .strict();

export const M03ProviderEnrollmentEvidenceSchemaV0_1 = z
  .object({
    schemaVersion: z.literal('0.1'),
    provider: z.literal('perpl'),
    issuer: boundedActorRef,
    network: z.literal('monad-testnet'),
    chainId: z.literal(10_143),
    accountId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    credentialRefHash: z.string().regex(/^[0-9a-f]{64}$/),
    nonce: z.string().min(16).max(200),
    allowedActions: z.array(z.enum(['REDUCE_POSITION', 'CLOSE_POSITION'])).length(1),
    scopes: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
    keyId: z.string().trim().min(1).max(200),
    proofRef: z.string().trim().min(1).max(500),
    verifiedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    signature: z.string().min(32).max(2_048),
  })
  .strict();

export type PolicyV0_1 = z.infer<typeof PolicySchemaV0_1>;

export const HealthResponseSchema = z
  .object({
    status: z.enum(['live', 'ready', 'not_ready']),
    module: z.literal('M01'),
    environment: z.enum(['LOCAL', 'TESTNET_DEMO', 'TESTNET', 'MAINNET_READONLY']),
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
