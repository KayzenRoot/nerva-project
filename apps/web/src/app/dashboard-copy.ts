import type { Locale } from './i18n.ts';

export const dashboardCopy: Record<
  Locale,
  {
    readonly title: string;
    readonly intro: string;
    readonly languageLabel: string;
    readonly network: string;
    readonly health: string;
    readonly riskSummary: string;
    readonly markets: string;
    readonly positions: string;
    readonly symbol: string;
    readonly side: string;
    readonly size: string;
    readonly entry: string;
    readonly mark: string;
    readonly notional: string;
    readonly adverseMove: string;
    readonly portfolioDrawdown: string;
    readonly liquidationDistance: string;
    readonly maintenanceMargin: string;
    readonly fundingDirection: string;
    readonly unavailableUnproven: string;
    readonly sourceQuality: string;
    readonly inspectSource: string;
    readonly readOnly: string;
    readonly noObservation: string;
    readonly noPositions: string;
    readonly apiLinks: string;
    readonly fixtureNotice: string;
    readonly status: Readonly<
      Record<
        | 'AVAILABLE'
        | 'NO_ACCOUNT'
        | 'NO_POSITION'
        | 'STALE'
        | 'UNAVAILABLE'
        | 'HEALTHY'
        | 'DEGRADED'
        | 'UNKNOWN',
        string
      >
    >;
  }
> = {
  en: {
    title: 'Risk and market observation',
    intro:
      'Read-only Perpl observations and deterministic risk snapshots. NERVA cannot place orders or move funds.',
    languageLabel: 'Language',
    network: 'Network',
    health: 'Provider health',
    riskSummary: 'Risk snapshot',
    markets: 'Markets',
    positions: 'Open positions',
    symbol: 'Market',
    side: 'Side',
    size: 'Size',
    entry: 'Entry',
    mark: 'Mark',
    notional: 'Notional',
    adverseMove: 'Adverse move',
    portfolioDrawdown: 'Day portfolio drawdown',
    liquidationDistance: 'Liquidation distance',
    maintenanceMargin: 'Maintenance margin',
    fundingDirection: 'Funding direction',
    unavailableUnproven: 'UNAVAILABLE_UNPROVEN',
    sourceQuality: 'Source quality',
    inspectSource: 'Inspect source',
    readOnly: 'READ ONLY · EXECUTION DISABLED',
    noObservation: 'No provider observations have been stored yet.',
    noPositions: 'No open positions in the latest available account snapshot.',
    apiLinks: 'Read-only APIs',
    fixtureNotice: 'Fixture or demo mode is active. This data is not live.',
    status: {
      AVAILABLE: 'Available',
      NO_ACCOUNT: 'No account',
      NO_POSITION: 'No position',
      STALE: 'Stale',
      UNAVAILABLE: 'Unavailable',
      HEALTHY: 'Healthy',
      DEGRADED: 'Degraded',
      UNKNOWN: 'Unknown',
    },
  },
  'pt-BR': {
    title: 'Observação de risco e mercado',
    intro:
      'Observações Perpl somente para leitura e snapshots determinísticos de risco. O NERVA não envia ordens nem movimenta fundos.',
    languageLabel: 'Idioma',
    network: 'Rede',
    health: 'Saúde dos provedores',
    riskSummary: 'Snapshot de risco',
    markets: 'Mercados',
    positions: 'Posições abertas',
    symbol: 'Mercado',
    side: 'Lado',
    size: 'Tamanho',
    entry: 'Entrada',
    mark: 'Marcação',
    notional: 'Exposição',
    adverseMove: 'Movimento adverso',
    portfolioDrawdown: 'Drawdown diário da carteira',
    liquidationDistance: 'Distância de liquidação',
    maintenanceMargin: 'Margem de manutenção',
    fundingDirection: 'Direção do funding',
    unavailableUnproven: 'UNAVAILABLE_UNPROVEN',
    sourceQuality: 'Qualidade da fonte',
    inspectSource: 'Inspecionar fonte',
    readOnly: 'SOMENTE LEITURA · EXECUÇÃO DESABILITADA',
    noObservation: 'Ainda não há observações de provedores armazenadas.',
    noPositions: 'Nenhuma posição aberta no snapshot de conta disponível mais recente.',
    apiLinks: 'APIs somente leitura',
    fixtureNotice: 'O modo de fixture ou demonstração está ativo. Estes dados não são ao vivo.',
    status: {
      AVAILABLE: 'Disponível',
      NO_ACCOUNT: 'Sem conta',
      NO_POSITION: 'Sem posição',
      STALE: 'Desatualizado',
      UNAVAILABLE: 'Indisponível',
      HEALTHY: 'Saudável',
      DEGRADED: 'Degradado',
      UNKNOWN: 'Desconhecido',
    },
  },
  es: {
    title: 'Observación de riesgo y mercado',
    intro:
      'Observaciones Perpl de solo lectura y snapshots deterministas de riesgo. NERVA no envía órdenes ni mueve fondos.',
    languageLabel: 'Idioma',
    network: 'Red',
    health: 'Salud de proveedores',
    riskSummary: 'Snapshot de riesgo',
    markets: 'Mercados',
    positions: 'Posiciones abiertas',
    symbol: 'Mercado',
    side: 'Lado',
    size: 'Tamaño',
    entry: 'Entrada',
    mark: 'Marca',
    notional: 'Exposición',
    adverseMove: 'Movimiento adverso',
    portfolioDrawdown: 'Drawdown diario de cartera',
    liquidationDistance: 'Distancia de liquidación',
    maintenanceMargin: 'Margen de mantenimiento',
    fundingDirection: 'Dirección del funding',
    unavailableUnproven: 'UNAVAILABLE_UNPROVEN',
    sourceQuality: 'Calidad de la fuente',
    inspectSource: 'Inspeccionar fuente',
    readOnly: 'SOLO LECTURA · EJECUCIÓN DESHABILITADA',
    noObservation: 'Todavía no hay observaciones de proveedores almacenadas.',
    noPositions: 'No hay posiciones abiertas en el snapshot de cuenta disponible más reciente.',
    apiLinks: 'APIs de solo lectura',
    fixtureNotice: 'El modo de fixture o demostración está activo. Estos datos no son en vivo.',
    status: {
      AVAILABLE: 'Disponible',
      NO_ACCOUNT: 'Sin cuenta',
      NO_POSITION: 'Sin posición',
      STALE: 'Desactualizado',
      UNAVAILABLE: 'No disponible',
      HEALTHY: 'Saludable',
      DEGRADED: 'Degradado',
      UNKNOWN: 'Desconocido',
    },
  },
};
