import Link from 'next/link';
import { loadServerConfig, publicConfig } from '@nerva/config';
import { messages, resolveLocale } from './i18n.ts';
import { ExperienceHeader } from './experience-header.tsx';
import { homeCopy } from './home-copy.ts';
import { NervaBrand, NervaSymbol } from './nerva-brand.tsx';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly lang?: string | string[] }>;
}) {
  const config = publicConfig(loadServerConfig());
  const locale = resolveLocale((await searchParams).lang);
  const copy = messages[locale];
  const experience = homeCopy[locale];
  return (
    <main className="landing-shell" lang={locale}>
      <ExperienceHeader locale={locale} active="home" />
      <section className="landing-hero" aria-labelledby="title">
        <div className="hero-copy">
          <div className="hero-logo-lockup">
            <NervaBrand />
            <span>{experience.heroDescriptor}</span>
          </div>
          <p className="eyebrow">
            {copy.platform} · {config.environment}
          </p>
          <h1 id="title">{copy.headline}</h1>
          <p className="intro">{copy.intro}</p>
          <div className="hero-actions">
            <Link className="button button-primary" href={`/demo?lang=${locale}`}>
              {experience.startDemo} <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-secondary" href={`/dashboard?lang=${locale}`}>
              {copy.dashboard}
            </Link>
          </div>
          <p className="landing-note">
            {copy.executionDisabled}. {copy.noIntegrations}
          </p>
        </div>
        <div className="hero-visual" aria-label={experience.visualLabel}>
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-core">
            <NervaSymbol />
          </div>
          <div className="signal-card signal-top">
            <span className="signal-dot" />
            {experience.observedRisk}
            <strong>DATA → POLICY → EVIDENCE</strong>
          </div>
          <div className="signal-card signal-bottom">
            {experience.freshness}
            <strong>UNKNOWN BLOCKS</strong>
          </div>
        </div>
      </section>
      <section className="landing-proof" aria-label={copy.areas}>
        <div>
          <span className="proof-index">01</span>
          <strong>{experience.proofRiskHeading}</strong>
          <p>{experience.proofRisk}</p>
        </div>
        <div>
          <span className="proof-index">02</span>
          <strong>{experience.proofAuthorityHeading}</strong>
          <p>{experience.proofAuthority}</p>
        </div>
        <div>
          <span className="proof-index">03</span>
          <strong>{experience.proofEvidenceHeading}</strong>
          <p>{experience.proofEvidence}</p>
        </div>
      </section>
      <section className="landing-media-links" aria-label={experience.submissionPages}>
        <div>
          <p className="eyebrow">{experience.submissionEyebrow}</p>
          <h2>{experience.submissionTitle}</h2>
        </div>
        <Link href="/metropolis/technical-demo">{experience.technicalVideo}</Link>
        <Link href="/metropolis/pitch-video">{experience.pitchVideo}</Link>
      </section>
      <footer className="landing-footer">
        {copy.systemStatus} · <Link href="/api/health/live">{copy.serviceHealth}</Link>
        <span>MAINNET HARD-BLOCKED · LIVE PERPL BLOCKED</span>
      </footer>
    </main>
  );
}
