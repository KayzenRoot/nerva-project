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
    documentTitle: 'NERVA | Safety and risk observation',
    documentDescription:
      'Read-only market observation and deterministic risk. Financial execution is disabled.',
    languageLabel: 'Language',
    environmentLabel: (environment: string) => `Environment ${environment}`,
    platform: 'Read-only observations and policy · M03',
    headline: 'See the conditions before any future action.',
    intro:
      'NERVA reads Perpl market and account data and computes deterministic risk. Financial execution is disabled.',
    executionDisabled: 'Financial execution is disabled',
    noIntegrations:
      'Provider data is read-only. NERVA cannot connect a wallet, place orders, or move funds.',
    areas: 'Platform areas',
    dashboard: 'Dashboard',
    policies: 'Policies',
    flightRecorder: 'Flight recorder',
    preparing: 'Read-only view',
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
    documentTitle: 'NERVA | Observação de segurança e risco',
    documentDescription:
      'Observação de mercado somente para leitura e risco determinístico. A execução financeira está desabilitada.',
    languageLabel: 'Idioma',
    environmentLabel: (environment: string) => `Ambiente ${environment}`,
    platform: 'Observação somente para leitura e políticas · M03',
    headline: 'Veja as condições antes de qualquer ação futura.',
    intro:
      'O NERVA lê dados de mercado e conta da Perpl e calcula riscos determinísticos. A execução financeira está desabilitada.',
    executionDisabled: 'Execução autônoma desabilitada',
    noIntegrations:
      'Os dados dos provedores são somente para leitura. O NERVA não conecta carteiras, envia ordens nem movimenta fundos.',
    areas: 'Áreas da plataforma',
    dashboard: 'Painel',
    policies: 'Políticas',
    flightRecorder: 'Registro de eventos',
    preparing: 'Visualização somente leitura',
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
    documentTitle: 'NERVA | Observación de seguridad y riesgo',
    documentDescription:
      'Observación de mercado de solo lectura y riesgo determinista. La ejecución financiera está deshabilitada.',
    languageLabel: 'Idioma',
    environmentLabel: (environment: string) => `Entorno ${environment}`,
    platform: 'Observación de solo lectura y políticas · M03',
    headline: 'Consulta las condiciones antes de una acción futura.',
    intro:
      'NERVA lee datos de mercado y cuenta de Perpl y calcula riesgos deterministas. La ejecución financiera está deshabilitada.',
    executionDisabled: 'La ejecución autónoma está deshabilitada',
    noIntegrations:
      'Los datos de proveedores son de solo lectura. NERVA no conecta carteras, envía órdenes ni mueve fondos.',
    areas: 'Áreas de la plataforma',
    dashboard: 'Panel',
    policies: 'Políticas',
    flightRecorder: 'Registro de actividad',
    preparing: 'Vista de solo lectura',
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
