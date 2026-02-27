export enum StatsTab {
  Platform = 'platform',
  Financials = 'financials',
}

export const STATS_TABS = [
  { id: StatsTab.Platform, label: 'Platform' },
  { id: StatsTab.Financials, label: 'Financials' },
] as const;
