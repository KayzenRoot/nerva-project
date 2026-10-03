'use client';

import Link from 'next/link';
import { useState } from 'react';
import { locales, type Locale } from '../i18n.ts';

type WalletProvider = { request(input: { method: string; params?: unknown[] }): Promise<unknown> };
declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

const copy = {
  en: {
    title: 'Wallet permissions',
    intro:
      'Read-only view of verified identity and bounded authority. Sign a short-lived read request with the currently bound wallet.',
    account: 'Account ID',
    lookup: 'Connect and view status',
    none: 'No permission records were found for this account.',
    connect: 'A browser wallet with EIP-712 support is required.',
    wrongChain: 'Switch the wallet to Monad Testnet (10143).',
    wallets: 'Wallet identity',
    agents: 'Verified agents',
    grants: 'Capability grants',
    sessions: 'Sessions',
    delegation: 'EIP-7702 delegation observations',
    evidence: 'Permission evidence',
    integrity: 'Chain integrity',
    enabled: 'Execution enabled',
    no: 'No',
    hard: 'Mainnet effects: HARD_BLOCKED',
    live: 'Live Perpl effects: BLOCKED',
    bound: 'Binding',
    status: 'Status',
    expires: 'Expires',
    actions: 'Allowed actions',
    revoked: 'Revoked',
    verified: 'VERIFIED',
    failed: 'FAILED',
    back: 'Back to NERVA',
    unavailable: 'Read-only status is unavailable.',
    signing: 'Waiting for wallet approval…',
    readError: 'The wallet-authorized status read failed.',
  },
  'pt-BR': {
    title: 'Permissões da carteira',
    intro:
      'Visão somente leitura de identidade verificada e autoridade limitada. Assine uma consulta curta com a carteira atualmente vinculada.',
    account: 'ID da conta',
    lookup: 'Conectar e ver estado',
    none: 'Nenhum registro de permissão para esta conta.',
    connect: 'É necessária uma carteira do navegador compatível com EIP-712.',
    wrongChain: 'Altere a carteira para Monad Testnet (10143).',
    wallets: 'Identidade da carteira',
    agents: 'Agentes verificados',
    grants: 'Concessões de capacidade',
    sessions: 'Sessões',
    delegation: 'Observações de delegação EIP-7702',
    evidence: 'Evidências de permissão',
    integrity: 'Integridade da cadeia',
    enabled: 'Execução habilitada',
    no: 'Não',
    hard: 'Efeitos em mainnet: HARD_BLOCKED',
    live: 'Efeitos Perpl ao vivo: BLOCKED',
    bound: 'Vínculo',
    status: 'Estado',
    expires: 'Expira',
    actions: 'Ações permitidas',
    revoked: 'Revogada',
    verified: 'VERIFICADA',
    failed: 'FALHOU',
    back: 'Voltar ao NERVA',
    unavailable: 'Estado somente leitura indisponível.',
    signing: 'Aguardando aprovação da carteira…',
    readError: 'A leitura autorizada pela carteira falhou.',
  },
  es: {
    title: 'Permisos de cartera',
    intro:
      'Vista de solo lectura de identidad verificada y autoridad limitada. Firma una consulta breve con la cartera vinculada.',
    account: 'ID de cuenta',
    lookup: 'Conectar y ver estado',
    none: 'No hay registros de permisos para esta cuenta.',
    connect: 'Se requiere una cartera de navegador compatible con EIP-712.',
    wrongChain: 'Cambia la cartera a Monad Testnet (10143).',
    wallets: 'Identidad de cartera',
    agents: 'Agentes verificados',
    grants: 'Concesiones de capacidad',
    sessions: 'Sesiones',
    delegation: 'Observaciones de delegación EIP-7702',
    evidence: 'Evidencia de permisos',
    integrity: 'Integridad de la cadena',
    enabled: 'Ejecución habilitada',
    no: 'No',
    hard: 'Efectos en mainnet: HARD_BLOCKED',
    live: 'Efectos Perpl en vivo: BLOCKED',
    bound: 'Vínculo',
    status: 'Estado',
    expires: 'Caduca',
    actions: 'Acciones permitidas',
    revoked: 'Revocada',
    verified: 'VERIFICADA',
    failed: 'FALLÓ',
    back: 'Volver a NERVA',
    unavailable: 'Estado de solo lectura no disponible.',
    signing: 'Esperando aprobación de la cartera…',
    readError: 'Falló la lectura autorizada por la cartera.',
  },
} as const;

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
      )
    : [];
}

export default function PermissionsReadView({
  locale,
  initialAccountId,
}: {
  locale: Locale;
  initialAccountId: string;
}) {
  const text = copy[locale];
  const [accountId, setAccountId] = useState(initialAccountId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [model, setModel] = useState<Record<string, unknown> | undefined>();

  async function loadStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setModel(undefined);
    try {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(accountId)) throw new Error(text.readError);
      const wallet = window.ethereum;
      if (!wallet) throw new Error(text.connect);
      const accounts = await wallet.request({ method: 'eth_requestAccounts' });
      const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error(text.connect);
      const chainId = await wallet.request({ method: 'eth_chainId' });
      if (typeof chainId !== 'string' || BigInt(chainId) !== 10_143n)
        throw new Error(text.wrongChain);
      const challengeResponse = await fetch(
        `/api/permissions?accountId=${encodeURIComponent(accountId)}&address=${encodeURIComponent(address)}`,
        { cache: 'no-store' },
      );
      const challenge = (await challengeResponse.json()) as Record<string, unknown>;
      if (!challengeResponse.ok || !challenge.typedData) throw new Error(text.readError);
      setMessage(text.signing);
      const signature = await wallet.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(challenge.typedData)],
      });
      if (typeof signature !== 'string') throw new Error(text.readError);
      const response = await fetch('/api/permissions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': String(challenge.correlationId),
        },
        cache: 'no-store',
        body: JSON.stringify({
          schemaVersion: '0.1',
          accountId,
          address,
          chainId: 10_143,
          issuedAt: challenge.issuedAt,
          validUntil: challenge.validUntil,
          nonce: challenge.nonce,
          signature,
          correlationId: challenge.correlationId,
        }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(text.readError);
      setModel(body);
      setMessage('');
    } catch (error) {
      setModel(undefined);
      setMessage(error instanceof Error ? error.message : text.readError);
    } finally {
      setBusy(false);
    }
  }

  const wallets = rows(model?.wallets);
  const agents = rows(model?.agents);
  const grants = rows(model?.grants);
  const sessions = rows(model?.sessions);
  const delegation = rows(model?.delegation);
  const hasRows =
    wallets.length + agents.length + grants.length + sessions.length + delegation.length > 0;
  const langHref = (option: Locale) =>
    `/permissions?lang=${option}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ''}`;

  return (
    <main className="dashboard-shell" lang={locale}>
      <header className="dashboard-topbar">
        <Link className="brand" href={`/?lang=${locale}`} aria-label="NERVA">
          NERVA
        </Link>
        <nav className="language-switcher" aria-label="Language">
          {locales.map((option) => (
            <Link
              key={option}
              href={langHref(option)}
              aria-current={locale === option ? 'page' : undefined}
            >
              {option === 'en' ? 'EN' : option === 'pt-BR' ? 'PT' : 'ES'}
            </Link>
          ))}
        </nav>
      </header>
      <section className="dashboard-heading">
        <p className="eyebrow">NERVA · M04</p>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
        <div className="readonly-badge">
          {text.enabled}: {text.no}
        </div>
        <p>
          {text.hard} · {text.live}
        </p>
      </section>
      <form onSubmit={loadStatus} className="dashboard-card">
        <label htmlFor="accountId">{text.account}</label>
        <input
          id="accountId"
          maxLength={200}
          required
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? text.signing : text.lookup}
        </button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      {model && !hasRows ? <p role="status">{text.none}</p> : null}
      {model && hasRows ? (
        <section className="dashboard-grid" aria-label={text.title}>
          <article className="dashboard-card">
            <h2>{text.wallets}</h2>
            {wallets.map((row, index) => (
              <p key={`${String(row.wallet_address)}:${index}`}>
                {String(row.wallet_address)} · {text.bound}: {String(row.event_type)}
              </p>
            ))}
          </article>
          <article className="dashboard-card">
            <h2>{text.agents}</h2>
            {agents.map((row) => (
              <p key={`${String(row.agent_id)}:${String(row.version)}`}>
                {String(row.agent_id)} v{String(row.version)} · {String(row.issuer_id)}
              </p>
            ))}
          </article>
          <article className="dashboard-card">
            <h2>{text.grants}</h2>
            {grants.map((row) => (
              <p key={String(row.grant_id)}>
                {String(row.grant_id)} · {text.actions}:{' '}
                {Array.isArray(row.actions) ? row.actions.join(', ') : 'UNKNOWN'} · {text.expires}:{' '}
                {String(row.expires_at)} · {text.revoked}: {String(row.revoked)}
              </p>
            ))}
          </article>
          <article className="dashboard-card">
            <h2>{text.sessions}</h2>
            {sessions.map((row) => (
              <p key={String(row.session_id)}>
                {String(row.session_id)} · {text.expires}: {String(row.expires_at)} · {text.revoked}
                : {String(row.revoked)}
              </p>
            ))}
          </article>
          <article className="dashboard-card">
            <h2>{text.delegation}</h2>
            {delegation.map((row, index) => (
              <p key={`${String(row.observation_hash)}:${index}`}>
                {text.status}: {String(row.status)} · {String(row.delegate_address ?? '—')} ·{' '}
                {String(row.observed_at)}
              </p>
            ))}
          </article>
          <article className="dashboard-card">
            <h2>{text.evidence}</h2>
            <p>
              {text.integrity}:{' '}
              {model.evidenceIntegrity === 'VERIFIED' ? text.verified : text.failed} ·{' '}
              {String(model.evidenceCount)} events
            </p>
            <code>{String(model.evidenceHeadHash)}</code>
          </article>
        </section>
      ) : null}
      <footer className="dashboard-footer">
        <Link href={`/?lang=${locale}`}>{text.back}</Link> · {text.hard} · {text.live}
      </footer>
    </main>
  );
}
