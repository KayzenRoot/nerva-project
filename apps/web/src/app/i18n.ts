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
    documentTitle: 'NERVA | Safety-first risk intelligence with verifiable accountability',
    documentDescription:
      'Read-only market observations, deterministic risk and policy simulation for perpetual markets on Monad. Financial execution remains disabled.',
    languageLabel: 'Language',
    environmentLabel: (environment: string) => `Environment ${environment}`,
    platform: 'Risk intelligence · Monad',
    headline: 'Risk intelligence. Deterministic accountability.',
    intro:
      'Read-only market observations and policy simulation for perpetual markets on Monad. Every signal keeps its source. Financial execution remains disabled.',
    executionDisabled: 'Financial execution is disabled',
    noIntegrations:
      'Provider data is read-only. NERVA cannot connect a wallet, place orders, or move funds.',
    areas: 'Platform areas',
    dashboard: 'Dashboard',
    policies: 'Policies',
    flightRecorder: 'Flight recorder',
    permissions: 'Wallet permissions',
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
    documentTitle: 'NERVA | inteligência de risco, segurança e responsabilidade verificável',
    documentDescription:
      'Observações de mercado somente para leitura, risco determinístico e simulação de políticas para mercados perpétuos na Monad. A execução financeira permanece desabilitada.',
    languageLabel: 'Idioma',
    environmentLabel: (environment: string) => `Ambiente ${environment}`,
    platform: 'Inteligência de risco · Monad',
    headline: 'Inteligência de risco. Responsabilidade determinística.',
    intro:
      'Observações de mercado somente para leitura e simulação de políticas para mercados perpétuos na Monad. Cada sinal mantém sua origem. A execução financeira permanece desabilitada.',
    executionDisabled: 'Execução autônoma desabilitada',
    noIntegrations:
      'Os dados dos provedores são somente para leitura. O NERVA não conecta carteiras, envia ordens nem movimenta fundos.',
    areas: 'Áreas da plataforma',
    dashboard: 'Painel',
    policies: 'Políticas',
    flightRecorder: 'Registro de eventos',
    permissions: 'Permissões da carteira',
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
    documentTitle: 'NERVA | inteligencia de riesgo, seguridad y responsabilidad verificable',
    documentDescription:
      'Observaciones de mercado de solo lectura, riesgo determinista y simulación de políticas para mercados perpetuos en Monad. La ejecución financiera sigue deshabilitada.',
    languageLabel: 'Idioma',
    environmentLabel: (environment: string) => `Entorno ${environment}`,
    platform: 'Inteligencia de riesgo · Monad',
    headline: 'Inteligencia de riesgo. Responsabilidad determinista.',
    intro:
      'Observaciones de mercado de solo lectura y simulación de políticas para mercados perpetuos en Monad. Cada señal conserva su origen. La ejecución financiera sigue deshabilitada.',
    executionDisabled: 'La ejecución autónoma está deshabilitada',
    noIntegrations:
      'Los datos de proveedores son de solo lectura. NERVA no conecta carteras, envía órdenes ni mueve fondos.',
    areas: 'Áreas de la plataforma',
    dashboard: 'Panel',
    policies: 'Políticas',
    flightRecorder: 'Registro de actividad',
    permissions: 'Permisos de cartera',
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
