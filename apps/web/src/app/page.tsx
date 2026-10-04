import Link from 'next/link';
import { loadServerConfig, publicConfig } from '@nerva/config';
import { messages, resolveLocale } from './i18n.ts';
import { ExperienceHeader } from './experience-header.tsx';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const config = publicConfig(loadServerConfig());
  const locale = resolveLocale((await searchParams).lang);
  const copy = messages[locale];
  return (
    <main className="landing-shell" lang={locale}>
      <ExperienceHeader locale={locale} active="home" />
      <section className="landing-hero" aria-labelledby="title">
        <div className="hero-copy">
          <p className="eyebrow">
            {copy.platform} · {config.environment}
          </p>
          <h1 id="title">{copy.headline}</h1>
          <p className="intro">{copy.intro}</p>
          <div className="hero-actions">
            <Link className="button button-primary" href={`/demo?lang=${locale}`}>
              {locale === 'pt-BR'
                ? 'Iniciar demo guiada'
                : locale === 'es'
                  ? 'Iniciar demo guiada'
                  : 'Start guided demo'}{' '}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-secondary" href={`/dashboard?lang=${locale}`}>
              {copy.dashboard}
            </Link>
          </div>
          <p className="landing-note">
            {copy.executionDisabled}. {copy.noIntegrations}
          </p>
        </div>
        <div
          className="hero-visual"
          aria-label={
            locale === 'pt-BR'
              ? 'Visualização sintética de fluxo de risco'
              : locale === 'es'
                ? 'Visualización sintética de flujo de riesgo'
                : 'Synthetic risk flow visualization'
          }
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-core">N</div>
          <div className="signal-card signal-top">
            <span className="signal-dot" />
            {locale === 'pt-BR'
              ? 'RISCO · OBSERVADO'
              : locale === 'es'
                ? 'RIESGO · OBSERVADO'
                : 'RISK · OBSERVED'}
            <strong>DATA → POLICY → EVIDENCE</strong>
          </div>
          <div className="signal-card signal-bottom">
            {locale === 'pt-BR' ? 'FRESHNESS' : 'FRESHNESS'}
            <strong>UNKNOWN BLOCKS</strong>
          </div>
        </div>
      </section>
      <section className="landing-proof" aria-label={copy.areas}>
        <div>
          <span className="proof-index">01</span>
          <strong>
            {locale === 'pt-BR'
              ? 'Risco determinístico'
              : locale === 'es'
                ? 'Riesgo determinista'
                : 'Deterministic risk'}
          </strong>
          <p>
            {locale === 'pt-BR'
              ? 'Fonte, atualidade e limites visíveis.'
              : locale === 'es'
                ? 'Origen, vigencia y límites visibles.'
                : 'Source, freshness and limits in view.'}
          </p>
        </div>
        <div>
          <span className="proof-index">02</span>
          <strong>
            {locale === 'pt-BR'
              ? 'Autoridade limitada'
              : locale === 'es'
                ? 'Autoridad acotada'
                : 'Bounded authority'}
          </strong>
          <p>
            {locale === 'pt-BR'
              ? 'Permissões verificáveis e revogáveis.'
              : locale === 'es'
                ? 'Permisos verificables y revocables.'
                : 'Verifiable, revocable permissions.'}
          </p>
        </div>
        <div>
          <span className="proof-index">03</span>
          <strong>
            {locale === 'pt-BR'
              ? 'Trilha verificável'
              : locale === 'es'
                ? 'Rastro verificable'
                : 'Verifiable evidence'}
          </strong>
          <p>
            {locale === 'pt-BR'
              ? 'Cada decisão tem contexto rastreável.'
              : locale === 'es'
                ? 'Cada decisión conserva contexto.'
                : 'Every decision keeps its context.'}
          </p>
        </div>
      </section>
      <footer className="landing-footer">
        {copy.systemStatus} · <Link href="/api/health/live">{copy.serviceHealth}</Link>
        <span>MAINNET HARD-BLOCKED · LIVE PERPL BLOCKED</span>
      </footer>
    </main>
  );
}
