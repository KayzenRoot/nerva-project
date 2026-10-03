import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { canonicalHash } from '@nerva/domain';
import {
  appendPermissionEvidence,
  restoreCompiledCapabilityGrant,
  type CompiledCapabilityGrant,
  type Eip7702Delegation,
  type PermissionEvidenceInput,
  type PermissionEvidenceRecord,
  type SessionAuthority,
  type VerifiedAuthorization,
  type WalletIdentity,
  type AgentIdentity,
  type CapabilityGrantCandidate,
  verifyPermissionEvidenceChain,
} from '@nerva/permissions';

const ZERO_HASH = '0'.repeat(64);

async function lockM04WalletIdentity(
  client: PoolClient,
  accountId: string,
  walletAddress: string,
): Promise<void> {
  const locks = [
    `m04-wallet-account:${accountId}`,
    `m04-wallet-address:${10_143}:${walletAddress.toLowerCase()}`,
  ].sort();
  for (const key of locks) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
}

async function transaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function appendEvidenceInTransaction(
  client: PoolClient,
  event: PermissionEvidenceInput,
): Promise<PermissionEvidenceRecord> {
  await client.query(
    `INSERT INTO m04_permission_evidence_head (singleton,last_sequence,last_hash)
     VALUES (true,0,$1) ON CONFLICT (singleton) DO NOTHING`,
    [ZERO_HASH],
  );
  const head = await client.query<{ last_sequence: number; last_hash: string }>(
    'SELECT last_sequence,last_hash FROM m04_permission_evidence_head WHERE singleton=true FOR UPDATE',
  );
  const current = head.rows[0];
  if (!current) throw new Error('M04 evidence chain head is unavailable');
  const previous =
    current.last_sequence === 0
      ? undefined
      : ({ sequence: current.last_sequence, hash: current.last_hash } as PermissionEvidenceRecord);
  const record = await appendPermissionEvidence(previous, event);
  await client.query(
    `INSERT INTO m04_permission_evidence (sequence,event_id,previous_hash,entry_hash,event,occurred_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
    [
      record.sequence,
      `m04:${record.hash}`,
      record.previousHash,
      record.hash,
      JSON.stringify(record),
      record.occurredAt,
    ],
  );
  await client.query(
    `UPDATE m04_permission_evidence_head SET last_sequence=$1,last_hash=$2 WHERE singleton=true`,
    [record.sequence, record.hash],
  );
  return record;
}

export async function appendM04PermissionEvidence(
  pool: Pool,
  event: PermissionEvidenceInput,
): Promise<PermissionEvidenceRecord> {
  return transaction(pool, (client) => appendEvidenceInTransaction(client, event));
}

export async function recordM04WalletBinding(
  pool: Pool,
  input: Readonly<{
    identity: WalletIdentity;
    nonceHash: string;
    domainHash: string;
    correlationId: string;
    occurredAt: string;
  }>,
): Promise<void> {
  const { identity, occurredAt } = input;
  await transaction(pool, async (client) => {
    await lockM04WalletIdentity(client, identity.accountId, identity.address);
    const latestAccount = await client.query<{ generation: number; event_type: string }>(
      `SELECT generation,event_type FROM m04_wallet_bindings
       WHERE chain_id=$1 AND account_id=$2 ORDER BY generation DESC LIMIT 1`,
      [identity.chainId, identity.accountId],
    );
    const latestWallet = await client.query<{
      generation: number;
      event_type: string;
      account_id: string;
    }>(
      `SELECT generation,event_type,account_id FROM m04_wallet_bindings
       WHERE chain_id=$1 AND lower(wallet_address)=lower($2) ORDER BY generation DESC LIMIT 1`,
      [identity.chainId, identity.address],
    );
    if (
      latestAccount.rows[0]?.event_type === 'BOUND' ||
      latestWallet.rows[0]?.event_type === 'BOUND'
    )
      throw new Error(
        'Wallet/account is already bound; unbind the current identity before rebinding',
      );
    if (latestWallet.rows[0] && latestWallet.rows[0].account_id !== identity.accountId)
      throw new Error('Wallet identity belongs to a different account history');
    const generation =
      Math.max(
        Number(latestAccount.rows[0]?.generation ?? 0),
        Number(latestWallet.rows[0]?.generation ?? 0),
      ) + 1;
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,'wallet-binding',NULL,'WALLET_BINDING',$4,$5)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [input.nonceHash, identity.accountId, identity.address, input.domainHash, occurredAt],
    );
    if (!nonce.rowCount) throw new Error('Wallet binding nonce replay was rejected');
    await client.query(
      `INSERT INTO m04_wallet_bindings
       (binding_id,account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at)
       VALUES ($1,$2,10143,'monad-testnet',$3,'eip712-compatible-wallet','BOUND',$4,$5,$6)`,
      [
        randomUUID(),
        identity.accountId,
        identity.address,
        generation,
        identity.provenanceHash,
        occurredAt,
      ],
    );
    await appendEvidenceInTransaction(client, {
      kind: 'WALLET_BOUND',
      subjectRef: identity.accountId,
      correlationId: input.correlationId,
      occurredAt,
      result: 'PASS',
      reasonCode: 'WALLET_SIGNATURE_VERIFIED',
    });
  });
}

export async function unbindM04Wallet(
  pool: Pool,
  input: Readonly<{
    accountId: string;
    walletAddress: string;
    nonceHash: string;
    domainHash: string;
    proofRefHash: string;
    correlationId: string;
    occurredAt: string;
    expectedGeneration: number;
  }>,
): Promise<boolean> {
  return transaction(pool, async (client) => {
    await lockM04WalletIdentity(client, input.accountId, input.walletAddress);
    const current = await client.query<{ generation: number; event_type: string }>(
      `SELECT generation,event_type FROM m04_wallet_bindings WHERE account_id=$1 AND chain_id=10143
       AND lower(wallet_address)=lower($2) ORDER BY generation DESC LIMIT 1 FOR UPDATE`,
      [input.accountId, input.walletAddress],
    );
    const binding = current.rows[0];
    const latestAccount = await client.query<{
      generation: number;
      event_type: string;
      wallet_address: string;
    }>(
      `SELECT generation,event_type,wallet_address FROM m04_wallet_bindings WHERE account_id=$1 AND chain_id=10143
       ORDER BY generation DESC LIMIT 1`,
      [input.accountId],
    );
    if (
      !binding ||
      binding.event_type !== 'BOUND' ||
      Number(binding.generation) !== input.expectedGeneration ||
      Number(latestAccount.rows[0]?.generation) !== input.expectedGeneration ||
      latestAccount.rows[0]?.event_type !== 'BOUND' ||
      latestAccount.rows[0]?.wallet_address.toLowerCase() !== input.walletAddress.toLowerCase()
    )
      return false;
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,'wallet-unbind',NULL,'WALLET_BINDING',$4,$5)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [input.nonceHash, input.accountId, input.walletAddress, input.domainHash, input.occurredAt],
    );
    if (!nonce.rowCount) throw new Error('Wallet-unbind nonce replay was rejected');
    const generation = Number(binding.generation) + 1;
    await client.query(
      `INSERT INTO m04_wallet_bindings
       (binding_id,account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at)
       VALUES ($1,$2,10143,'monad-testnet',$3,'eip712-compatible-wallet','UNBOUND',$4,$5,$6)`,
      [
        randomUUID(),
        input.accountId,
        input.walletAddress,
        generation,
        input.proofRefHash,
        input.occurredAt,
      ],
    );
    const active = await client.query<{ grant_id: string; generation: number }>(
      `SELECT s.grant_id,s.generation FROM m04_authority_states s JOIN m04_capability_grants g USING(grant_id)
       WHERE g.account_id=$1 AND lower(g.wallet_address)=lower($2) AND s.revoked=false
       ORDER BY s.grant_id FOR UPDATE OF s`,
      [input.accountId, input.walletAddress],
    );
    for (const grant of active.rows) {
      const next = Number(grant.generation) + 1;
      await client.query(
        'UPDATE m04_authority_states SET generation=$2,revoked=true,updated_at=$3 WHERE grant_id=$1',
        [grant.grant_id, next, input.occurredAt],
      );
      await client.query(
        `INSERT INTO m04_revocations (revocation_id,grant_id,generation,actor_ref,reason_code,proof_ref_hash,occurred_at)
         VALUES ($1,$2,$3,$4,'WALLET_UNBOUND',$5,$6)`,
        [randomUUID(), grant.grant_id, next, input.accountId, input.proofRefHash, input.occurredAt],
      );
      await appendEvidenceInTransaction(client, {
        kind: 'AUTHORITY_REVOKED',
        subjectRef: grant.grant_id,
        correlationId: `${input.correlationId}:${next}`,
        occurredAt: input.occurredAt,
        result: 'REFUSED',
        reasonCode: 'WALLET_UNBOUND',
      });
    }
    await appendEvidenceInTransaction(client, {
      kind: 'AUTHORITY_REVOKED',
      subjectRef: input.accountId,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt,
      result: 'PASS',
      reasonCode: 'WALLET_UNBOUND',
    });
    return true;
  });
}

export async function consumeM04ReadAccess(
  pool: Pool,
  input: Readonly<{
    accountId: string;
    walletAddress: string;
    nonceHash: string;
    domainHash: string;
    occurredAt: string;
  }>,
): Promise<boolean> {
  return transaction(pool, async (client) => {
    await lockM04WalletIdentity(client, input.accountId, input.walletAddress);
    const binding = await client.query<{
      event_type: string;
      generation: number;
      wallet_address: string;
    }>(
      `SELECT event_type,generation,wallet_address FROM m04_wallet_bindings
       WHERE chain_id=10143 AND account_id=$1 ORDER BY generation DESC LIMIT 1 FOR SHARE`,
      [input.accountId],
    );
    const current = binding.rows[0];
    if (
      !current ||
      current.event_type !== 'BOUND' ||
      current.wallet_address.toLowerCase() !== input.walletAddress.toLowerCase()
    )
      return false;
    const inserted = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,'wallet-read',NULL,'READ_ACCESS',$4,$5)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [input.nonceHash, input.accountId, input.walletAddress, input.domainHash, input.occurredAt],
    );
    return inserted.rowCount === 1;
  });
}

export async function loadCurrentM04Wallet(
  pool: Pool,
  accountId: string,
): Promise<WalletIdentity | undefined> {
  const result = await pool.query<{
    account_id: string;
    wallet_address: string;
    chain_id: number;
    network: 'monad-testnet';
    provider_id: 'eip712-compatible-wallet';
    provenance_hash: string;
    occurred_at: Date;
    event_type: string;
  }>(
    `SELECT account_id,wallet_address,chain_id,network,provider_id,provenance_hash,occurred_at,event_type
     FROM m04_wallet_bindings WHERE account_id=$1 ORDER BY generation DESC LIMIT 1`,
    [accountId],
  );
  const row = result.rows[0];
  if (!row || row.event_type !== 'BOUND') return undefined;
  return Object.freeze({
    schemaVersion: '0.1',
    accountId: row.account_id,
    address: row.wallet_address as WalletIdentity['address'],
    chainId: 10_143,
    network: 'monad-testnet',
    providerId: 'eip712-compatible-wallet',
    provenanceHash: row.provenance_hash,
    verifiedAt: new Date(row.occurred_at).toISOString(),
  });
}

export async function recordM04AgentIdentity(
  pool: Pool,
  identity: AgentIdentity,
  input: Readonly<{
    verifiedAt: string;
    nonceHash: string;
    domainHash: string;
    correlationId: string;
  }>,
): Promise<void> {
  await transaction(pool, async (client) => {
    const binding = await client.query<{ account_id: string }>(
      `SELECT account_id FROM m04_wallet_bindings
       WHERE chain_id=$1 AND wallet_address=$2 AND event_type='BOUND'
         AND generation=(SELECT max(generation) FROM m04_wallet_bindings WHERE chain_id=$1 AND wallet_address=$2)`,
      [identity.chainId, identity.walletAddress],
    );
    const currentBinding = binding.rows[0];
    if (!currentBinding) throw new Error('No current user-verified wallet binding exists');
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,$4,NULL,'AGENT_IDENTITY',$5,$6)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [
        input.nonceHash,
        currentBinding.account_id,
        identity.walletAddress,
        identity.agentId,
        input.domainHash,
        input.verifiedAt,
      ],
    );
    if (!nonce.rowCount) throw new Error('Agent identity nonce replay was rejected');
    await client.query(
      `INSERT INTO m04_agent_identities
       (agent_identity_id,agent_id,version,issuer_id,provenance_hash,chain_id,wallet_address,verified_at)
       VALUES ($1,$2,$3,$4,$5,10143,$6,$7)`,
      [
        randomUUID(),
        identity.agentId,
        identity.version,
        identity.issuerId,
        identity.provenanceHash,
        identity.walletAddress,
        input.verifiedAt,
      ],
    );
    await appendEvidenceInTransaction(client, {
      kind: 'AGENT_VERIFIED',
      subjectRef: `${identity.agentId}:${identity.version}`,
      correlationId: input.correlationId,
      occurredAt: input.verifiedAt,
      result: 'PASS',
      reasonCode: 'TRUSTED_ISSUER_VERIFIED',
    });
  });
}

export async function persistM04CapabilityGrant(
  pool: Pool,
  input: Readonly<{
    grant: CompiledCapabilityGrant;
    approvalRefHash: string;
    nonceHash: string;
    domainHash: string;
    correlationId: string;
  }>,
): Promise<void> {
  const grant = input.grant;
  await transaction(pool, async (client) => {
    await lockM04WalletIdentity(client, grant.accountId, grant.walletAddress);
    const binding = await client.query<{ account_id: string; event_type: string }>(
      `SELECT account_id,event_type FROM m04_wallet_bindings
       WHERE chain_id=$1 AND wallet_address=$2 ORDER BY generation DESC LIMIT 1`,
      [grant.chainId, grant.walletAddress],
    );
    const agent = await client.query(
      `SELECT 1 FROM m04_agent_identities WHERE agent_id=$1 AND version=$2
       AND chain_id=$3 AND wallet_address=$4`,
      [grant.agentId, grant.agentVersion, grant.chainId, grant.walletAddress],
    );
    if (
      binding.rows[0]?.event_type !== 'BOUND' ||
      binding.rows[0]?.account_id !== grant.accountId ||
      !agent.rowCount
    )
      throw new Error(
        'Capability grant identity provenance does not match current persisted identities',
      );
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,$4,NULL,'GRANT_APPROVAL',$5,$6)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [
        input.nonceHash,
        grant.accountId,
        grant.walletAddress,
        grant.agentId,
        input.domainHash,
        grant.issuedAt,
      ],
    );
    if (!nonce.rowCount) throw new Error('Grant approval nonce replay was rejected');
    await client.query(
      `INSERT INTO m04_capability_grants
       (grant_id,grant_hash,account_id,wallet_address,agent_id,agent_version,chain_id,policy_hash,scope,actions,limits,grant_document,nonce_domain_hash,delegation_observation_hash,grant_approval_ref_hash,created_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,10143,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16)`,
      [
        grant.grantId,
        grant.digest,
        grant.accountId,
        grant.walletAddress,
        grant.agentId,
        grant.agentVersion,
        grant.policyHash,
        JSON.stringify(grant.scope),
        JSON.stringify(grant.actions),
        JSON.stringify(grant.limits),
        JSON.stringify(grant.source),
        await canonicalHash(grant.nonceDomain),
        grant.delegation.observationHash,
        input.approvalRefHash,
        grant.issuedAt,
        grant.expiresAt,
      ],
    );
    await client.query(
      `INSERT INTO m04_authority_states (grant_id,generation,revoked) VALUES ($1,$2,false)`,
      [grant.grantId, grant.revocationGeneration],
    );
    await appendEvidenceInTransaction(client, {
      kind: 'GRANT_COMPILED',
      subjectRef: grant.grantId,
      correlationId: input.correlationId,
      occurredAt: grant.issuedAt,
      result: 'PASS',
      reasonCode: 'DETERMINISTIC_GRANT_COMPILED',
    });
  });
}

export async function loadCurrentM04Identities(
  pool: Pool,
  input: Readonly<{ accountId: string; agentId: string; agentVersion: number }>,
): Promise<Readonly<{ wallet: WalletIdentity; agent: AgentIdentity }> | undefined> {
  const walletResult = await pool.query<{
    account_id: string;
    wallet_address: string;
    chain_id: number;
    network: 'monad-testnet';
    provider_id: 'eip712-compatible-wallet';
    provenance_hash: string;
    occurred_at: Date;
    event_type: string;
  }>(
    `SELECT account_id,wallet_address,chain_id,network,provider_id,provenance_hash,occurred_at,event_type
     FROM m04_wallet_bindings WHERE account_id=$1 ORDER BY generation DESC LIMIT 1`,
    [input.accountId],
  );
  const currentWallet = walletResult.rows[0];
  if (!currentWallet || currentWallet.event_type !== 'BOUND') return undefined;
  const agentResult = await pool.query<{
    agent_id: string;
    version: number;
    issuer_id: string;
    provenance_hash: string;
    wallet_address: string;
    chain_id: number;
  }>(
    `SELECT agent_id,version,issuer_id,provenance_hash,wallet_address,chain_id FROM m04_agent_identities
     WHERE agent_id=$1 AND version=$2 AND wallet_address=$3 ORDER BY verified_at DESC LIMIT 1`,
    [input.agentId, input.agentVersion, currentWallet.wallet_address],
  );
  const persistedAgent = agentResult.rows[0];
  if (!persistedAgent) return undefined;
  const wallet: WalletIdentity = {
    schemaVersion: '0.1',
    accountId: currentWallet.account_id,
    address: currentWallet.wallet_address as WalletIdentity['address'],
    chainId: 10_143,
    network: 'monad-testnet',
    providerId: 'eip712-compatible-wallet',
    provenanceHash: currentWallet.provenance_hash,
    verifiedAt: new Date(currentWallet.occurred_at).toISOString(),
  };
  const agent: AgentIdentity = {
    schemaVersion: '0.1',
    agentId: persistedAgent.agent_id,
    version: persistedAgent.version,
    issuerId: persistedAgent.issuer_id,
    provenanceHash: persistedAgent.provenance_hash,
    walletAddress: persistedAgent.wallet_address as AgentIdentity['walletAddress'],
    chainId: 10_143,
  };
  return Object.freeze({ wallet, agent });
}

export async function loadCurrentM04IdentitiesByAgent(
  pool: Pool,
  input: Readonly<{ agentId: string; agentVersion: number }>,
): Promise<Readonly<{ wallet: WalletIdentity; agent: AgentIdentity }> | undefined> {
  const agentResult = await pool.query<{
    agent_id: string;
    version: number;
    issuer_id: string;
    provenance_hash: string;
    wallet_address: string;
  }>(
    `SELECT agent_id,version,issuer_id,provenance_hash,wallet_address FROM m04_agent_identities
     WHERE agent_id=$1 AND version=$2 ORDER BY verified_at DESC LIMIT 1`,
    [input.agentId, input.agentVersion],
  );
  const agentRow = agentResult.rows[0];
  if (!agentRow) return undefined;
  const binding = await pool.query<{
    account_id: string;
    wallet_address: string;
    provenance_hash: string;
    occurred_at: Date;
    event_type: string;
  }>(
    `SELECT account_id,wallet_address,provenance_hash,occurred_at,event_type FROM m04_wallet_bindings
     WHERE chain_id=10143 AND wallet_address=$1 ORDER BY generation DESC LIMIT 1`,
    [agentRow.wallet_address],
  );
  const walletRow = binding.rows[0];
  if (!walletRow || walletRow.event_type !== 'BOUND') return undefined;
  const wallet: WalletIdentity = {
    schemaVersion: '0.1',
    accountId: walletRow.account_id,
    address: walletRow.wallet_address as WalletIdentity['address'],
    chainId: 10_143,
    network: 'monad-testnet',
    providerId: 'eip712-compatible-wallet',
    provenanceHash: walletRow.provenance_hash,
    verifiedAt: new Date(walletRow.occurred_at).toISOString(),
  };
  const agent: AgentIdentity = {
    schemaVersion: '0.1',
    agentId: agentRow.agent_id,
    version: agentRow.version,
    issuerId: agentRow.issuer_id,
    provenanceHash: agentRow.provenance_hash,
    walletAddress: agentRow.wallet_address as AgentIdentity['walletAddress'],
    chainId: 10_143,
  };
  return Object.freeze({ wallet, agent });
}

export async function isM04WalletBound(pool: Pool, walletAddress: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT event_type FROM m04_wallet_bindings WHERE chain_id=10143 AND lower(wallet_address)=lower($1)
     ORDER BY generation DESC LIMIT 1`,
    [walletAddress],
  );
  return result.rows[0]?.event_type === 'BOUND';
}

export async function loadM04GrantMaterial(
  pool: Pool,
  grantId: string,
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const result = await pool.query(
    `SELECT g.grant_id,g.grant_hash,g.account_id,g.wallet_address,g.agent_id,g.agent_version,
       g.chain_id,g.policy_hash,g.scope,g.actions,g.limits,g.grant_document,g.nonce_domain_hash,
       g.delegation_observation_hash,g.created_at,g.expires_at,s.generation,s.revoked,
       o.status AS delegation_status,o.observation_hash AS current_delegation_hash
     FROM m04_capability_grants g JOIN m04_authority_states s USING(grant_id)
     LEFT JOIN LATERAL (SELECT status,observation_hash FROM m04_delegation_observations
       WHERE chain_id=g.chain_id AND wallet_address=g.wallet_address ORDER BY observed_at DESC LIMIT 1) o ON true
     WHERE g.grant_id=$1 LIMIT 1`,
    [grantId],
  );
  return result.rows[0] ? Object.freeze(result.rows[0] as Record<string, unknown>) : undefined;
}

export async function loadM04CompiledGrant(
  pool: Pool,
  grantId: string,
): Promise<
  Readonly<{ grant: CompiledCapabilityGrant; generation: number; revoked: boolean }> | undefined
> {
  const material = await loadM04GrantMaterial(pool, grantId);
  if (!material || !material.grant_document || typeof material.grant_document !== 'object')
    return undefined;
  const identities = await loadCurrentM04Identities(pool, {
    accountId: String(material.account_id),
    agentId: String(material.agent_id),
    agentVersion: Number(material.agent_version),
  });
  if (!identities) return undefined;
  try {
    const grant = await restoreCompiledCapabilityGrant({
      source: material.grant_document as CapabilityGrantCandidate,
      wallet: identities.wallet,
      agent: identities.agent,
    });
    if (grant.digest !== material.grant_hash) return undefined;
    return Object.freeze({
      grant,
      generation: Number(material.generation),
      revoked: Boolean(material.revoked),
    });
  } catch {
    return undefined;
  }
}

export async function loadM04SessionForRevocation(
  pool: Pool,
  sessionId: string,
): Promise<
  | Readonly<{
      sessionId: string;
      grantId: string;
      sessionHash: string;
      generation: number;
      revoked: boolean;
      grant: CompiledCapabilityGrant;
      grantGeneration: number;
      grantRevoked: boolean;
    }>
  | undefined
> {
  const result = await pool.query<{
    session_id: string;
    grant_id: string;
    session_hash: string;
    generation: number;
    revoked_session_id: string | null;
  }>(
    `SELECT s.session_id,s.grant_id,s.session_hash,1 AS generation,r.session_id AS revoked_session_id
     FROM m04_sessions s LEFT JOIN m04_session_revocations r USING(session_id)
     WHERE s.session_id=$1 LIMIT 1`,
    [sessionId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const parent = await loadM04CompiledGrant(pool, row.grant_id);
  if (!parent) return undefined;
  return Object.freeze({
    sessionId: row.session_id,
    grantId: row.grant_id,
    sessionHash: row.session_hash,
    generation: row.revoked_session_id ? Number(row.generation) : 0,
    revoked: Boolean(row.revoked_session_id),
    grant: parent.grant,
    grantGeneration: parent.generation,
    grantRevoked: parent.revoked,
  });
}

export async function latestM04DelegationObservation(
  pool: Pool,
  walletAddress: string,
): Promise<
  | Readonly<{ observation: Eip7702Delegation; observationHash: string; observedAt: string }>
  | undefined
> {
  const result = await pool.query<{
    status: Eip7702Delegation['status'];
    delegate_address: string | null;
    delegate_code_hash: string | null;
    block_number: string | null;
    block_hash: string | null;
    observation_hash: string;
    observed_at: Date;
  }>(
    `SELECT status,delegate_address,delegate_code_hash,block_number,block_hash,observation_hash,observed_at
     FROM m04_delegation_observations WHERE chain_id=10143 AND lower(wallet_address)=lower($1)
     ORDER BY observed_at DESC LIMIT 1`,
    [walletAddress],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return Object.freeze({
    observation: Object.freeze({
      status: row.status,
      ...(row.delegate_address
        ? { delegateAddress: row.delegate_address as Eip7702Delegation['delegateAddress'] }
        : {}),
      ...(row.delegate_code_hash ? { delegateCodeHash: row.delegate_code_hash } : {}),
      ...(row.block_number ? { blockNumber: row.block_number } : {}),
      ...(row.block_hash ? { blockHash: row.block_hash } : {}),
      observedAt: new Date(row.observed_at).toISOString(),
    }),
    observationHash: row.observation_hash,
    observedAt: new Date(row.observed_at).toISOString(),
  });
}

export async function verifyM04PermissionEvidence(pool: Pool): Promise<
  Readonly<{
    verified: boolean;
    count: number;
    lastHash: string;
  }>
> {
  const result = await pool.query<{
    sequence: number;
    previous_hash: string;
    entry_hash: string;
    event: PermissionEvidenceRecord;
  }>(
    'SELECT sequence,previous_hash,entry_hash,event FROM m04_permission_evidence ORDER BY sequence ASC LIMIT 25001',
  );
  const rows = result.rows;
  const bounded = rows.length <= 25_000;
  const aligned = rows.every(
    (row) =>
      row.event.sequence === row.sequence &&
      row.event.previousHash === row.previous_hash &&
      row.event.hash === row.entry_hash,
  );
  const verified =
    bounded && aligned && (await verifyPermissionEvidenceChain(rows.map((row) => row.event)));
  const head = await pool.query<{ last_sequence: number; last_hash: string }>(
    'SELECT last_sequence,last_hash FROM m04_permission_evidence_head WHERE singleton=true',
  );
  const current = head.rows[0];
  const last = rows.at(-1);
  const consistentHead = current
    ? current.last_sequence === rows.length && current.last_hash === (last?.entry_hash ?? ZERO_HASH)
    : rows.length === 0;
  return Object.freeze({
    verified: verified && consistentHead,
    count: rows.length,
    lastHash: last?.entry_hash ?? ZERO_HASH,
  });
}

export async function listM04PermissionEvidence(
  pool: Pool,
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const result = await pool.query(
    `SELECT sequence,entry_hash,occurred_at,event->>'kind' AS kind,event->>'result' AS result,
       event->>'reasonCode' AS reason_code,event->>'correlationId' AS correlation_id,
       event->>'subjectRef' AS subject_ref
     FROM m04_permission_evidence ORDER BY sequence DESC LIMIT 100`,
  );
  return Object.freeze(
    await Promise.all(
      result.rows.reverse().map(async (row) =>
        Object.freeze({
          sequence: row.sequence,
          entry_hash: row.entry_hash,
          occurred_at: row.occurred_at,
          kind: row.kind,
          result: row.result,
          reason_code: row.reason_code,
          correlation_id: row.correlation_id,
          subject_ref_hash: await canonicalHash(row.subject_ref ?? ''),
        }),
      ),
    ),
  );
}

export async function recordM04M03BoundaryDecision(
  pool: Pool,
  input: Readonly<{
    planDigest: string;
    authorizationRefHash: string;
    correlationId: string;
    occurredAt: string;
    result: 'PASS' | 'REFUSED' | 'UNKNOWN';
    reasonCode: string;
  }>,
): Promise<void> {
  await appendM04PermissionEvidence(pool, {
    kind: 'M03_DECISION',
    subjectRef: `${input.planDigest}:${input.authorizationRefHash}`,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
    result: input.result,
    reasonCode: input.reasonCode,
  });
}

export async function persistM04DelegationObservation(
  pool: Pool,
  input: Readonly<{
    accountId: string;
    walletAddress: string;
    chainId: number;
    observation: Eip7702Delegation;
    observedAt: string;
  }>,
): Promise<void> {
  const observation = input.observation;
  const body = {
    schemaVersion: '0.1',
    accountId: input.accountId,
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    status: observation.status,
    delegateAddress: observation.delegateAddress ?? null,
    delegateCodeHash: observation.delegateCodeHash ?? null,
    blockNumber: observation.blockNumber ?? null,
    blockHash: observation.blockHash ?? null,
    observedAt: input.observedAt,
  };
  const observationHash = await canonicalHash(body);
  await transaction(pool, async (client) => {
    await client.query(
      `INSERT INTO m04_delegation_observations
       (observation_id,account_id,wallet_address,chain_id,status,delegate_address,delegate_code_hash,block_number,block_hash,observation_hash,observed_at)
       VALUES ($1,$2,$3,10143,$4,$5,$6,$7,$8,$9,$10)`,
      [
        randomUUID(),
        input.accountId,
        input.walletAddress,
        observation.status,
        observation.delegateAddress ?? null,
        observation.delegateCodeHash ?? null,
        observation.blockNumber ?? null,
        observation.blockHash ?? null,
        observationHash,
        input.observedAt,
      ],
    );
    const invalidatesAuthority = ['CHANGED', 'REVOKED'].includes(observation.status);
    const affected = await client.query<{ grant_id: string; generation: number }>(
      `SELECT s.grant_id,s.generation FROM m04_authority_states s JOIN m04_capability_grants g USING(grant_id)
       WHERE g.wallet_address=$1 AND s.revoked=false
         AND ($2::boolean=true OR ($6::boolean=false AND (
           g.grant_document->'delegation'->>'status' <> $3 OR
           lower(COALESCE(g.grant_document->'delegation'->>'delegateAddress','')) <> lower(COALESCE($4::text,'')) OR
           COALESCE(g.grant_document->'delegation'->>'delegateCodeHash','') <> COALESCE($5::text,''))))
       ORDER BY s.grant_id FOR UPDATE OF s`,
      [
        input.walletAddress,
        invalidatesAuthority,
        observation.status,
        observation.delegateAddress ?? null,
        observation.delegateCodeHash ?? null,
        observation.status === 'UNKNOWN',
      ],
    );
    for (const grant of affected.rows) {
      const generation = Number(grant.generation) + 1;
      await client.query(
        `UPDATE m04_authority_states SET generation=$2,revoked=true,updated_at=$3 WHERE grant_id=$1`,
        [grant.grant_id, generation, input.observedAt],
      );
      await client.query(
        `INSERT INTO m04_revocations (revocation_id,grant_id,generation,actor_ref,reason_code,proof_ref_hash,occurred_at)
         VALUES ($1,$2,$3,'system:delegation-observer','DELEGATE_CHANGED',$4,$5)`,
        [randomUUID(), grant.grant_id, generation, observationHash, input.observedAt],
      );
      await appendEvidenceInTransaction(client, {
        kind: 'AUTHORITY_REVOKED',
        subjectRef: grant.grant_id,
        correlationId: `m04-delegate-${grant.grant_id}-${generation}`,
        occurredAt: input.observedAt,
        result: 'REFUSED',
        reasonCode: 'DELEGATE_CHANGED',
      });
    }
    await appendEvidenceInTransaction(client, {
      kind: 'DELEGATION_OBSERVED',
      subjectRef: input.accountId,
      correlationId: `m04-delegation-${observationHash}`,
      occurredAt: input.observedAt,
      result: observation.status === 'UNKNOWN' ? 'UNKNOWN' : 'PASS',
      reasonCode:
        observation.reason?.replaceAll(/[^A-Z0-9_]/g, '_').toUpperCase() ||
        `DELEGATION_${observation.status}`,
    });
  });
}

export async function persistM04Authorization(
  pool: Pool,
  input: Readonly<{
    grantId: string;
    generation: number;
    verified: VerifiedAuthorization;
    domainHash: string;
    correlationId: string;
    verifiedAt: string;
  }>,
): Promise<boolean> {
  return transaction(pool, async (client) => {
    const state = await client.query<{
      generation: number;
      revoked: boolean;
      grant_hash: string;
      account_id: string;
      wallet_address: string;
      agent_id: string;
      policy_hash: string;
      expires_at: Date;
      delegation_observation_hash: string;
      current_delegation_hash: string;
      delegation_status: string;
      delegation_observed_at: Date;
      expected_delegation_status: string;
      expected_delegate_address: string | null;
      expected_delegate_code_hash: string | null;
      current_delegate_address: string | null;
      current_delegate_code_hash: string | null;
    }>(
      `SELECT s.generation,s.revoked,g.grant_hash,g.account_id,g.wallet_address,g.agent_id,g.policy_hash,
        g.expires_at,g.delegation_observation_hash,o.observation_hash AS current_delegation_hash,o.observed_at AS delegation_observed_at,
        o.status AS delegation_status,g.grant_document->'delegation'->>'status' AS expected_delegation_status,
        g.grant_document->'delegation'->>'delegateAddress' AS expected_delegate_address,
        g.grant_document->'delegation'->>'delegateCodeHash' AS expected_delegate_code_hash,
        o.delegate_address AS current_delegate_address,o.delegate_code_hash AS current_delegate_code_hash
       FROM m04_authority_states s JOIN m04_capability_grants g USING(grant_id)
       LEFT JOIN LATERAL (SELECT status,observation_hash,delegate_address,delegate_code_hash FROM m04_delegation_observations
         WHERE chain_id=g.chain_id AND wallet_address=g.wallet_address ORDER BY observed_at DESC LIMIT 1) o ON true
       WHERE s.grant_id=$1 FOR UPDATE OF s`,
      [input.grantId],
    );
    const current = state.rows[0];
    if (
      !current ||
      current.revoked ||
      Number(current.generation) !== input.generation ||
      current.grant_hash !== input.verified.grantHash ||
      !current.current_delegation_hash ||
      !['ABSENT', 'ACTIVE'].includes(current.delegation_status) ||
      !current.delegation_observed_at ||
      Date.parse(input.verifiedAt) - new Date(current.delegation_observed_at).getTime() < 0 ||
      Date.parse(input.verifiedAt) - new Date(current.delegation_observed_at).getTime() > 30_000 ||
      current.expected_delegation_status !== current.delegation_status ||
      (current.expected_delegation_status === 'ACTIVE' &&
        (current.expected_delegate_address?.toLowerCase() !==
          current.current_delegate_address?.toLowerCase() ||
          current.expected_delegate_code_hash !== current.current_delegate_code_hash)) ||
      new Date(current.expires_at).getTime() <= Date.parse(input.verifiedAt)
    )
      return false;
    const binding = await client.query(
      `SELECT event_type FROM m04_wallet_bindings WHERE account_id=$1
       ORDER BY generation DESC LIMIT 1`,
      [current.account_id],
    );
    if (binding.rows[0]?.event_type !== 'BOUND') return false;
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,$4,$5,'AUTHORIZATION',$6,$7)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [
        input.verified.nonceHash,
        current.account_id,
        current.wallet_address,
        current.agent_id,
        input.grantId,
        input.domainHash,
        input.verifiedAt,
      ],
    );
    if (!nonce.rowCount) return false;
    await client.query(
      `INSERT INTO m04_authorization_refs
       (authorization_ref,grant_id,proof_ref_hash,typed_data_digest,plan_digest,action,verified_signer,revocation_generation,delegation_observation_hash,verified_at,expires_at)
       VALUES ($1,$2,$3,$1,$4,$5,$6,$7,$8,$9,$10)`,
      [
        input.verified.typedDataDigest,
        input.grantId,
        input.verified.proofRefHash,
        input.verified.planDigest,
        input.verified.action,
        input.verified.signer,
        input.generation,
        current.delegation_observation_hash,
        input.verifiedAt,
        input.verified.expiresAt,
      ],
    );
    await appendEvidenceInTransaction(client, {
      kind: 'AUTHORIZATION_VERIFIED',
      subjectRef: input.verified.typedDataDigest,
      correlationId: input.correlationId,
      occurredAt: input.verifiedAt,
      result: 'PASS',
      reasonCode: 'WALLET_GRANT_PLAN_ACTION_VERIFIED',
    });
    return true;
  });
}

export async function validateM04AuthorizationRef(
  pool: Pool,
  input: Readonly<{
    authorizationRef: string;
    planDigest: string;
    action: string;
    now: string;
    agentId?: string;
  }>,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM m04_authorization_refs r
     JOIN m04_capability_grants g USING(grant_id)
     JOIN m04_authority_states s USING(grant_id)
     JOIN LATERAL (SELECT status,observation_hash,delegate_address,delegate_code_hash,observed_at
       FROM m04_delegation_observations WHERE chain_id=g.chain_id AND wallet_address=g.wallet_address
       ORDER BY observed_at DESC LIMIT 1) o ON true
     WHERE r.authorization_ref=$1 AND r.plan_digest=$2 AND r.action=$3 AND r.expires_at>$4
       AND g.expires_at>$4 AND s.revoked=false AND r.revocation_generation=s.generation
       AND o.status IN ('ABSENT','ACTIVE')
       AND o.observed_at <= $4::timestamptz
       AND ($5::text IS NULL OR g.agent_id=$5)
       AND EXISTS (SELECT 1 FROM m04_wallet_bindings b WHERE b.account_id=g.account_id
         AND lower(b.wallet_address)=lower(g.wallet_address) AND b.generation=(
           SELECT max(b2.generation) FROM m04_wallet_bindings b2 WHERE b2.account_id=b.account_id
             AND lower(b2.wallet_address)=lower(b.wallet_address)) AND b.event_type='BOUND')
       AND g.grant_document->'delegation'->>'status'=o.status
       AND lower(COALESCE(g.grant_document->'delegation'->>'delegateAddress',''))=lower(COALESCE(o.delegate_address,''))
       AND COALESCE(g.grant_document->'delegation'->>'delegateCodeHash','')=COALESCE(o.delegate_code_hash,'')
       AND o.observed_at > $4::timestamptz - interval '30 seconds'
     ORDER BY o.observed_at DESC LIMIT 1`,
    [input.authorizationRef, input.planDigest, input.action, input.now, input.agentId ?? null],
  );
  return result.rowCount === 1;
}

export async function persistM04Session(pool: Pool, session: SessionAuthority): Promise<void> {
  await transaction(pool, async (client) => {
    const state = await client.query<{
      generation: number;
      revoked: boolean;
      expires_at: Date;
      status: string;
      observed_at: Date;
      expected_status: string;
      expected_address: string | null;
      expected_code_hash: string | null;
      address: string | null;
      code_hash: string | null;
    }>(
      `SELECT s.generation,s.revoked,g.expires_at,o.status,o.observed_at,
        g.grant_document->'delegation'->>'status' AS expected_status,
        g.grant_document->'delegation'->>'delegateAddress' AS expected_address,
        g.grant_document->'delegation'->>'delegateCodeHash' AS expected_code_hash,
        o.delegate_address AS address,o.delegate_code_hash AS code_hash
       FROM m04_authority_states s JOIN m04_capability_grants g USING(grant_id)
       LEFT JOIN LATERAL (SELECT status,observed_at,delegate_address,delegate_code_hash
         FROM m04_delegation_observations WHERE chain_id=g.chain_id AND wallet_address=g.wallet_address
         ORDER BY observed_at DESC LIMIT 1) o ON true
       WHERE s.grant_id=$1 FOR SHARE OF s`,
      [session.grantId],
    );
    const current = state.rows[0];
    const currentTime = Date.parse(session.issuedAt);
    if (
      !current ||
      current.revoked ||
      Number(current.generation) !== session.revocationGeneration ||
      current.expires_at.getTime() <= currentTime ||
      current.expires_at.getTime() < Date.parse(session.expiresAt) ||
      !['ABSENT', 'ACTIVE'].includes(current.status) ||
      current.status !== current.expected_status ||
      !current.observed_at ||
      currentTime - current.observed_at.getTime() < 0 ||
      currentTime - current.observed_at.getTime() > 30_000 ||
      (current.status === 'ACTIVE' &&
        (current.address?.toLowerCase() !== current.expected_address?.toLowerCase() ||
          current.code_hash !== current.expected_code_hash))
    )
      throw new Error('Session parent grant has been revoked or superseded');
    await client.query(
      `INSERT INTO m04_sessions
       (session_id,grant_id,session_hash,nonce_domain_hash,actions,limits,created_at,expires_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)`,
      [
        session.sessionId,
        session.grantId,
        session.digest,
        await canonicalHash(session.nonceDomain),
        JSON.stringify(session.actions),
        JSON.stringify({
          maxActionFractionBps: session.maxActionFractionBps,
          maxNotionalMicros: session.maxNotionalMicros,
          maxSlippageBps: session.maxSlippageBps,
        }),
        session.issuedAt,
        session.expiresAt,
      ],
    );
    const nonceHash = await canonicalHash(`session:${session.sessionId}:${session.digest}`);
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,$4,$5,'SESSION',$6,$7)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [
        nonceHash,
        session.accountId,
        session.walletAddress,
        session.agentId,
        session.grantId,
        await canonicalHash(session.nonceDomain),
        session.issuedAt,
      ],
    );
    if (!nonce.rowCount) throw new Error('Session nonce replay was rejected');
    await appendEvidenceInTransaction(client, {
      kind: 'SESSION_ISSUED',
      subjectRef: session.sessionId,
      correlationId: `m04-session-${session.sessionId}`,
      occurredAt: session.issuedAt,
      result: 'PASS',
      reasonCode: 'STRICT_SUBSET_SESSION_ISSUED',
    });
  });
}

export async function revokeM04Session(
  pool: Pool,
  input: Readonly<{
    sessionId: string;
    sessionHash: string;
    expectedGeneration: number;
    grantGeneration: number;
    nonceHash: string;
    domainHash: string;
    proofRefHash: string;
    occurredAt: string;
  }>,
): Promise<number | undefined> {
  return transaction(pool, async (client) => {
    const current = await client.query<{
      grant_id: string;
      grant_generation: number;
      grant_revoked: boolean;
      account_id: string;
      wallet_address: string;
      agent_id: string;
      session_hash: string;
      expires_at: Date;
      revoked_session_id: string | null;
    }>(
      `SELECT s.grant_id,a.generation AS grant_generation,a.revoked AS grant_revoked,
        g.account_id,g.wallet_address,g.agent_id,s.session_hash,s.expires_at,
        r.session_id AS revoked_session_id
       FROM m04_sessions s JOIN m04_capability_grants g USING(grant_id)
       JOIN m04_authority_states a USING(grant_id)
       LEFT JOIN m04_session_revocations r USING(session_id)
       WHERE s.session_id=$1 FOR UPDATE OF a,s`,
      [input.sessionId],
    );
    const row = current.rows[0];
    if (!row || row.session_hash !== input.sessionHash) return undefined;
    if (row.revoked_session_id) return 1;
    if (
      row.grant_revoked ||
      Number(row.grant_generation) !== input.grantGeneration ||
      input.expectedGeneration !== 0
    )
      return undefined;
    const binding = await client.query<{ event_type: string; wallet_address: string }>(
      `SELECT event_type,wallet_address FROM m04_wallet_bindings WHERE account_id=$1 AND chain_id=10143
       ORDER BY generation DESC LIMIT 1`,
      [row.account_id],
    );
    if (
      binding.rows[0]?.event_type !== 'BOUND' ||
      binding.rows[0]?.wallet_address.toLowerCase() !== row.wallet_address.toLowerCase()
    )
      return undefined;
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,$4,$5,'REVOCATION',$6,$7)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [
        input.nonceHash,
        row.account_id,
        row.wallet_address,
        row.agent_id,
        row.grant_id,
        input.domainHash,
        input.occurredAt,
      ],
    );
    if (!nonce.rowCount) throw new Error('Session revocation nonce replay was rejected');
    await client.query(
      `INSERT INTO m04_session_revocations
       (session_id,generation,actor_ref,proof_ref_hash,nonce_hash,occurred_at)
       VALUES ($1,1,$2,$3,$4,$5)`,
      [input.sessionId, row.account_id, input.proofRefHash, input.nonceHash, input.occurredAt],
    );
    await appendEvidenceInTransaction(client, {
      kind: 'SESSION_REVOKED',
      subjectRef: input.sessionId,
      correlationId: `m04-session-revoke-${input.sessionId}`,
      occurredAt: input.occurredAt,
      result: 'PASS',
      reasonCode: 'USER_REVOKED',
    });
    return 1;
  });
}

export async function consumeM04Nonce(
  pool: Pool,
  input: Readonly<{
    nonceHash: string;
    domainHash: string;
    accountId: string;
    walletAddress: string;
    agentId: string;
    grantId: string;
    operation: 'WALLET_BINDING' | 'AUTHORIZATION' | 'SESSION' | 'REVOCATION';
    consumedAt: string;
  }>,
): Promise<boolean> {
  return transaction(pool, async (client) => {
    const state = await client.query<{ generation: number; revoked: boolean }>(
      'SELECT generation,revoked FROM m04_authority_states WHERE grant_id=$1 FOR UPDATE',
      [input.grantId],
    );
    if (!state.rows[0] || state.rows[0].revoked) return false;
    const inserted = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [
        input.nonceHash,
        input.accountId,
        input.walletAddress,
        input.agentId,
        input.grantId,
        input.operation,
        input.domainHash,
        input.consumedAt,
      ],
    );
    if (!inserted.rowCount) return false;
    await appendEvidenceInTransaction(client, {
      kind: 'NONCE_CONSUMED',
      subjectRef: input.grantId,
      correlationId: `m04-nonce-${input.nonceHash}`,
      occurredAt: input.consumedAt,
      result: 'PASS',
      reasonCode: 'DOMAIN_SCOPED_DURABLE_NONCE_CONSUMED',
    });
    return true;
  });
}

export async function revokeM04Grant(
  pool: Pool,
  input: Readonly<{
    grantId: string;
    actorRef: string;
    reasonCode: string;
    nonceHash: string;
    domainHash: string;
    occurredAt: string;
    proofRefHash: string;
  }>,
): Promise<number | undefined> {
  return transaction(pool, async (client) => {
    const state = await client.query<{ generation: number; revoked: boolean }>(
      'SELECT generation,revoked FROM m04_authority_states WHERE grant_id=$1 FOR UPDATE',
      [input.grantId],
    );
    const current = state.rows[0];
    if (!current) return undefined;
    if (current.revoked) return Number(current.generation);
    const grant = await client.query<{
      account_id: string;
      wallet_address: string;
      agent_id: string;
    }>('SELECT account_id,wallet_address,agent_id FROM m04_capability_grants WHERE grant_id=$1', [
      input.grantId,
    ]);
    const owner = grant.rows[0];
    if (!owner) return undefined;
    const nonce = await client.query(
      `INSERT INTO m04_nonce_ledger
       (nonce_hash,chain_id,account_id,wallet_address,agent_id,grant_id,operation,domain_hash,consumed_at)
       VALUES ($1,10143,$2,$3,$4,$5,'REVOCATION',$6,$7)
       ON CONFLICT (nonce_hash) DO NOTHING RETURNING nonce_hash`,
      [
        input.nonceHash,
        owner.account_id,
        owner.wallet_address,
        owner.agent_id,
        input.grantId,
        input.domainHash,
        input.occurredAt,
      ],
    );
    if (!nonce.rowCount) throw new Error('Revocation nonce replay was rejected');
    const generation = Number(current.generation) + 1;
    await client.query(
      'UPDATE m04_authority_states SET generation=$2,revoked=true,updated_at=$3 WHERE grant_id=$1',
      [input.grantId, generation, input.occurredAt],
    );
    await client.query(
      `INSERT INTO m04_revocations (revocation_id,grant_id,generation,actor_ref,reason_code,proof_ref_hash,occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(),
        input.grantId,
        generation,
        input.actorRef,
        input.reasonCode,
        input.proofRefHash,
        input.occurredAt,
      ],
    );
    await appendEvidenceInTransaction(client, {
      kind: 'AUTHORITY_REVOKED',
      subjectRef: input.grantId,
      correlationId: `m04-revoke-${input.grantId}-${generation}`,
      occurredAt: input.occurredAt,
      result: 'PASS',
      reasonCode: input.reasonCode,
    });
    return generation;
  });
}

/**
 * Serializes use against revocation. The row lock is retained through `operation`;
 * current M03 never has a live Perpl adapter, so the future effect-lock contract remains blocked.
 */
export async function runWithCurrentM04Authority<T>(
  pool: Pool,
  input: Readonly<{
    grantId: string;
    generation: number;
    delegationObservationHash: string;
    operation: () => Promise<T>;
  }>,
): Promise<Readonly<{ permitted: true; value: T }> | Readonly<{ permitted: false }>> {
  return transaction(pool, async (client) => {
    const state = await client.query<{
      generation: number;
      revoked: boolean;
      expected_hash: string;
      actual_hash: string;
      actual_status: string;
      grant_delegation_status: string;
      grant_delegate_address: string | null;
      grant_delegate_code_hash: string | null;
      actual_delegate_address: string | null;
      actual_delegate_code_hash: string | null;
    }>(
      `SELECT a.generation,a.revoked,g.delegation_observation_hash AS expected_hash,
        o.observation_hash AS actual_hash,o.status AS actual_status,
        g.grant_document->'delegation'->>'status' AS grant_delegation_status,
        g.grant_document->'delegation'->>'delegateAddress' AS grant_delegate_address,
        g.grant_document->'delegation'->>'delegateCodeHash' AS grant_delegate_code_hash,
        o.delegate_address AS actual_delegate_address,o.delegate_code_hash AS actual_delegate_code_hash
       FROM m04_authority_states a JOIN m04_capability_grants g USING(grant_id)
       LEFT JOIN LATERAL (SELECT observation_hash,status,delegate_address,delegate_code_hash FROM m04_delegation_observations
         WHERE chain_id=g.chain_id AND wallet_address=g.wallet_address ORDER BY observed_at DESC LIMIT 1) o ON true
       WHERE a.grant_id=$1 FOR SHARE OF a`,
      [input.grantId],
    );
    if (
      !state.rows[0] ||
      state.rows[0].revoked ||
      Number(state.rows[0].generation) !== input.generation ||
      state.rows[0].expected_hash !== input.delegationObservationHash ||
      !state.rows[0].actual_hash ||
      !['ABSENT', 'ACTIVE'].includes(state.rows[0].actual_status) ||
      state.rows[0].grant_delegation_status !== state.rows[0].actual_status ||
      (state.rows[0].actual_status === 'ACTIVE' &&
        (state.rows[0].grant_delegate_address?.toLowerCase() !==
          state.rows[0].actual_delegate_address?.toLowerCase() ||
          state.rows[0].grant_delegate_code_hash !== state.rows[0].actual_delegate_code_hash))
    )
      return { permitted: false } as const;
    return { permitted: true, value: await input.operation() } as const;
  });
}

export async function listM04PermissionReadModel(
  pool: Pool,
  accountId: string,
): Promise<Readonly<Record<string, unknown>>> {
  const [wallets, agents, grants, sessions, delegation, evidence] = await Promise.all([
    pool.query(
      `SELECT account_id,chain_id,network,wallet_address,provider_id,event_type,generation,provenance_hash,occurred_at
       FROM m04_wallet_bindings WHERE account_id=$1 ORDER BY generation DESC LIMIT 100`,
      [accountId],
    ),
    pool.query(
      `SELECT agent_id,version,issuer_id,provenance_hash,chain_id,wallet_address,verified_at
       FROM m04_agent_identities i WHERE EXISTS (SELECT 1 FROM m04_wallet_bindings b
         WHERE b.account_id=$1 AND b.chain_id=i.chain_id AND lower(b.wallet_address)=lower(i.wallet_address))
       ORDER BY verified_at DESC LIMIT 100`,
      [accountId],
    ),
    pool.query(
      `SELECT g.grant_id,g.grant_hash,g.account_id,g.wallet_address,g.agent_id,g.agent_version,g.chain_id,g.policy_hash,g.scope,g.actions,g.limits,g.created_at,g.expires_at,s.generation,s.revoked
       FROM m04_capability_grants g JOIN m04_authority_states s USING(grant_id)
       WHERE g.account_id=$1 ORDER BY g.created_at DESC LIMIT 100`,
      [accountId],
    ),
    pool.query(
      `SELECT s.session_id,s.grant_id,s.session_hash,s.actions,s.limits,s.created_at,s.expires_at,a.generation,
        a.revoked AS parent_grant_revoked,(r.session_id IS NOT NULL) AS revoked,
        r.generation AS revocation_generation,r.proof_ref_hash AS revocation_proof_ref_hash,
        r.occurred_at AS revoked_at
       FROM m04_sessions s JOIN m04_authority_states a USING(grant_id)
       JOIN m04_capability_grants g USING(grant_id)
       LEFT JOIN m04_session_revocations r USING(session_id) WHERE g.account_id=$1
       ORDER BY s.created_at DESC LIMIT 100`,
      [accountId],
    ),
    pool.query(
      `SELECT observation_id,account_id,wallet_address,chain_id,status,delegate_address,delegate_code_hash,block_number,block_hash,observation_hash,observed_at
       FROM m04_delegation_observations WHERE account_id=$1 ORDER BY observed_at DESC LIMIT 100`,
      [accountId],
    ),
    pool.query(
      `SELECT sequence,event_id,previous_hash,entry_hash,event,occurred_at FROM m04_permission_evidence
       WHERE event->>'subjectRef'=$1 ORDER BY sequence DESC LIMIT 100`,
      [accountId],
    ),
  ]);
  return Object.freeze({
    schemaVersion: '0.1',
    mainnetEffect: 'HARD_BLOCKED',
    livePerplEffect: 'BLOCKED',
    wallets: wallets.rows,
    agents: agents.rows,
    grants: grants.rows,
    sessions: sessions.rows,
    delegation: delegation.rows,
    evidence: evidence.rows.reverse(),
  });
}
