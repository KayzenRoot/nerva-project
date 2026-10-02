import Link from 'next/link';
import { locales, messages, type Locale } from './i18n.ts';

type PlaceholderTitle = 'dashboardTitle' | 'policiesTitle' | 'flightRecorderTitle';
type PlaceholderRoute = 'dashboard' | 'policies' | 'flight-recorder';

export function PlaceholderScreen({
  locale,
  title,
  route,
}: {
  readonly locale: Locale;
  readonly title: PlaceholderTitle;
  readonly route: PlaceholderRoute;
}) {
  const copy = messages[locale];
  return (
    <main className="shell" lang={locale}>
      <header className="topbar">
        <Link className="brand" href={`/?lang=${locale}`}>
          NERVA
        </Link>
        <div className="topbar-tools">
          <nav className="language-switcher" aria-label={copy.languageLabel}>
            {locales.map((option) => (
              <Link
                key={option}
                href={`/${route}?lang=${option}`}
                aria-current={locale === option ? 'page' : undefined}
              >
                {option === 'en' ? 'EN' : option === 'pt-BR' ? 'PT' : 'ES'}
              </Link>
            ))}
          </nav>
          <span className="environment">M01</span>
        </div>
      </header>
      <section className="hero">
        <p className="eyebrow">{copy.futureArea}</p>
        <h1>{copy[title]}</h1>
        <p className="intro">{copy.placeholderIntro}</p>
        <p>
          <Link href={`/?lang=${locale}`}>{copy.backHome}</Link>
        </p>
      </section>
    </main>
  );
}
