import Link from 'next/link';
import { locales, type Locale } from './i18n.ts';

const labels: Record<
  Locale,
  Readonly<
    Record<'dashboard' | 'policies' | 'demo' | 'permissions' | 'recorder' | 'language', string>
  >
> = {
  en: {
    dashboard: 'Risk',
    policies: 'Policies',
    demo: 'Guided demo',
    permissions: 'Permissions',
    recorder: 'Flight Recorder',
    language: 'Language',
  },
  'pt-BR': {
    dashboard: 'Risco',
    policies: 'Políticas',
    demo: 'Demo guiada',
    permissions: 'Permissões',
    recorder: 'Flight Recorder',
    language: 'Idioma',
  },
  es: {
    dashboard: 'Riesgo',
    policies: 'Políticas',
    demo: 'Demo guiada',
    permissions: 'Permisos',
    recorder: 'Flight Recorder',
    language: 'Idioma',
  },
};

const mode: Record<Locale, Readonly<{ label: string; description: string }>> = {
  en: {
    label: 'LIVE READ ONLY',
    description: 'Provider freshness is shown per observation · no financial effects',
  },
  'pt-BR': {
    label: 'LIVE READ ONLY · SOMENTE LEITURA',
    description: 'Atualidade aparece por observação · sem efeitos financeiros',
  },
  es: {
    label: 'LIVE READ ONLY · SOLO LECTURA',
    description: 'La vigencia aparece por observación · sin efectos financieros',
  },
};

export function ExperienceHeader({
  locale,
  active,
}: {
  readonly locale: Locale;
  readonly active: 'home' | 'dashboard' | 'policies' | 'permissions' | 'recorder';
}) {
  const text = labels[locale];
  const activePath: Record<typeof active, string> = {
    home: '',
    dashboard: 'dashboard',
    policies: 'policies',
    permissions: 'permissions',
    recorder: 'flight-recorder',
  };
  const links = [
    [`/dashboard?lang=${locale}`, text.dashboard, 'dashboard'],
    [`/policies?lang=${locale}`, text.policies, 'policies'],
    [`/demo?lang=${locale}`, text.demo, 'demo'],
    [`/permissions?lang=${locale}`, text.permissions, 'permissions'],
    [`/flight-recorder?lang=${locale}`, text.recorder, 'recorder'],
  ] as const;
  return (
    <>
      <header className="experience-header">
        <Link className="brand" href={`/?lang=${locale}`} aria-label="NERVA">
          NERVA<span className="brand-mark">●</span>
        </Link>
        <nav
          className="experience-nav"
          aria-label={
            locale === 'pt-BR'
              ? 'Navegação principal'
              : locale === 'es'
                ? 'Navegación principal'
                : 'Primary navigation'
          }
        >
          {links.map(([href, label, key]) => (
            <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <nav className="language-switcher" aria-label={text.language}>
          {locales.map((option) => (
            <Link
              key={option}
              href={`/${activePath[active]}?lang=${option}`}
              aria-current={locale === option ? 'page' : undefined}
            >
              {option === 'en' ? 'EN' : option === 'pt-BR' ? 'PT' : 'ES'}
            </Link>
          ))}
        </nav>
      </header>
      <div className="live-mode-banner" role="note">
        <span className="mode-light" aria-hidden="true" /> <strong>{mode[locale].label}</strong>
        <span>{mode[locale].description}</span>
        <span className="effect-gates">MAINNET HARD-BLOCKED · LIVE PERPL BLOCKED</span>
      </div>
    </>
  );
}
