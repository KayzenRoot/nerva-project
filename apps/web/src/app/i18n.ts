export type Locale = 'en' | 'pt-BR' | 'es';

export const locales: readonly Locale[] = ['en', 'pt-BR', 'es'];

export function resolveLocale(value: string | string[] | undefined): Locale {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate?.toLowerCase() === 'pt' || candidate?.toLowerCase() === 'pt-br') return 'pt-BR';
  if (candidate?.toLowerCase() === 'es') return 'es';
  return 'en';
}

export const messages = {
  en: {
    documentTitle: 'NERVA | Safety platform',
    documentDescription: 'M01 safety-kernel foundation. No financial execution is enabled.',
    languageLabel: 'Language',
    environmentLabel: (environment: string) => `Environment ${environment}`,
    platform: 'Safety platform · M01',
    headline: 'Protection starts with clear limits.',
    intro:
      'The policy and observability foundation is running in safe mode. Financial execution is disabled.',
    executionDisabled: 'Autonomous execution is disabled',
    noIntegrations: 'This foundation does not connect to wallets, providers, or trading networks.',
    areas: 'Platform areas',
    dashboard: 'Dashboard',
    policies: 'Policies',
    flightRecorder: 'Flight recorder',
    preparing: 'In preparation',
    systemStatus: 'System status',
    serviceHealth: 'Service health',
    futureArea: 'Reserved for a future module',
    placeholderIntro:
      'This screen does not display market data, positions, wallets, or recommendations. Financial execution remains disabled.',
    backHome: 'Back to home',
    dashboardTitle: 'Dashboard in preparation',
    policiesTitle: 'Policies in preparation',
    flightRecorderTitle: 'Flight recorder in preparation',
  },
  'pt-BR': {
    documentTitle: 'NERVA | Plataforma de segurança',
    documentDescription:
      'Fundação do núcleo de segurança M01. Nenhuma execução financeira está habilitada.',
    languageLabel: 'Idioma',
    environmentLabel: (environment: string) => `Ambiente ${environment}`,
    platform: 'Plataforma de segurança · M01',
    headline: 'Proteção começa com limites claros.',
    intro:
      'A fundação de políticas e observabilidade está em modo seguro. Nenhuma execução financeira está habilitada.',
    executionDisabled: 'Execução autônoma desabilitada',
    noIntegrations: 'Esta base não conecta carteiras, provedores ou redes de negociação.',
    areas: 'Áreas da plataforma',
    dashboard: 'Painel',
    policies: 'Políticas',
    flightRecorder: 'Registro de eventos',
    preparing: 'Em preparação',
    systemStatus: 'Estado do sistema',
    serviceHealth: 'Saúde do serviço',
    futureArea: 'Área reservada para módulo futuro',
    placeholderIntro:
      'Esta tela não apresenta dados de mercado, posições, carteiras ou recomendações. A execução financeira permanece desabilitada.',
    backHome: 'Voltar ao início',
    dashboardTitle: 'Painel em preparação',
    policiesTitle: 'Políticas em preparação',
    flightRecorderTitle: 'Registro de eventos em preparação',
  },
  es: {
    documentTitle: 'NERVA | Plataforma de seguridad',
    documentDescription:
      'Base del núcleo de seguridad M01. La ejecución financiera está deshabilitada.',
    languageLabel: 'Idioma',
    environmentLabel: (environment: string) => `Entorno ${environment}`,
    platform: 'Plataforma de seguridad · M01',
    headline: 'La protección comienza con límites claros.',
    intro:
      'La base de políticas y observabilidad funciona en modo seguro. La ejecución financiera está deshabilitada.',
    executionDisabled: 'La ejecución autónoma está deshabilitada',
    noIntegrations: 'Esta base no se conecta a carteras, proveedores ni redes de negociación.',
    areas: 'Áreas de la plataforma',
    dashboard: 'Panel',
    policies: 'Políticas',
    flightRecorder: 'Registro de actividad',
    preparing: 'En preparación',
    systemStatus: 'Estado del sistema',
    serviceHealth: 'Salud del servicio',
    futureArea: 'Área reservada para un módulo futuro',
    placeholderIntro:
      'Esta pantalla no muestra datos de mercado, posiciones, carteras ni recomendaciones. La ejecución financiera sigue deshabilitada.',
    backHome: 'Volver al inicio',
    dashboardTitle: 'Panel en preparación',
    policiesTitle: 'Políticas en preparación',
    flightRecorderTitle: 'Registro de actividad en preparación',
  },
} as const;

export type Messages = (typeof messages)[Locale];
