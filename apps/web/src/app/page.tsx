import Link from 'next/link';
import { loadServerConfig, publicConfig } from '@nerva/config';
import { locales, messages, resolveLocale } from './i18n.ts';

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
    <main className="shell" lang={locale}>
      <header className="topbar">
        <Link className="brand" href={`/?lang=${locale}`} aria-label="NERVA">
          NERVA
        </Link>
        <div className="topbar-tools">
          <nav className="language-switcher" aria-label={copy.languageLabel}>
            {locales.map((option) => (
              <Link
                key={option}
                href={`/?lang=${option}`}
                aria-current={locale === option ? 'page' : undefined}
              >
                {option === 'en' ? 'EN' : option === 'pt-BR' ? 'PT' : 'ES'}
              </Link>
            ))}
          </nav>
          <span className="environment" aria-label={copy.environmentLabel(config.environment)}>
            {config.environment}
          </span>
        </div>
      </header>
      <section className="hero" aria-labelledby="title">
        <p className="eyebrow">{copy.platform}</p>
        <h1 id="title">{copy.headline}</h1>
        <p className="intro">{copy.intro}</p>
        <div className="status-card">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>{copy.executionDisabled}</strong>
            <p>{copy.noIntegrations}</p>
          </div>
        </div>
      </section>
      <nav className="future-nav" aria-label={copy.areas}>
        <Link href={`/dashboard?lang=${locale}`}>
          {copy.dashboard} <small>{copy.preparing}</small>
        </Link>
        <Link href={`/policies?lang=${locale}`}>
          {copy.policies} <small>{copy.preparing}</small>
        </Link>
        <Link href={`/flight-recorder?lang=${locale}`}>
          {copy.flightRecorder} <small>{copy.preparing}</small>
        </Link>
      </nav>
      <footer>
        {copy.systemStatus} · <Link href="/api/health/live">{copy.serviceHealth}</Link>
      </footer>
    </main>
  );
}
