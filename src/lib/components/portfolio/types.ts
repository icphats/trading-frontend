export enum PortfolioTab {
  Overview = 'overview',
  Tokens = 'tokens',
  Pools = 'pools',
  Orders = 'orders',
  Triggers = 'triggers',
  Nfts = 'nfts',
}

export const PORTFOLIO_TABS = [
  { id: PortfolioTab.Overview, label: 'Overview' },
  { id: PortfolioTab.Tokens, label: 'Tokens' },
  { id: PortfolioTab.Nfts, label: 'NFTs' },
  { id: PortfolioTab.Pools, label: 'Pools' },
  { id: PortfolioTab.Orders, label: 'Orders' },
  { id: PortfolioTab.Triggers, label: 'Triggers' },
] as const;

export interface PortfolioNft {
  id: string;
  name: string;
  collection: string;
  image?: string;
  floorPrice?: number;
}

export type TimeFilter = '24h' | '7d' | '30d' | 'all';
