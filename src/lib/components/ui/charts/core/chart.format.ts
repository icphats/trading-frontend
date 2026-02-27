import { formatSigFig } from '$lib/utils/format.utils';

/**
 * Format price as USD currency
 * Uses subscript zeros for small decimal prices (e.g., $0.₀₀₀₀₅₂₃)
 */
export function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 1) return `$${formatSigFig(price, 5, { subscriptZeros: true })}`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Format price as token ratio (for pool charts)
 */
export function formatTokenRatio(price: number): string {
  if (price === 0) return '0';
  if (price < 0.000001) return price.toExponential(2);
  if (price < 0.0001) return price.toFixed(8);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 1000) return price.toFixed(2);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Format volume with appropriate suffix (K, M, B)
 */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(2)}K`;
  return `$${vol.toFixed(2)}`;
}

/**
 * Format volume without currency prefix
 */
export function formatVolumeRaw(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`;
  return vol.toFixed(2);
}

/**
 * Format percentage change with sign
 */
export function formatChange(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Get CSS class name based on price change direction
 */
export function getChangeClass(change: number): 'positive' | 'negative' | 'neutral' {
  if (change > 0) return 'positive';
  if (change < 0) return 'negative';
  return 'neutral';
}

/**
 * Get display label for data type
 */
export function getDataTypeLabel(type: 'price' | 'volume' | 'tvl'): string {
  const labels: Record<typeof type, string> = {
    price: 'Price',
    volume: 'Volume',
    tvl: 'TVL',
  };
  return labels[type];
}

/**
 * Format compact number (for display in tight spaces)
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

/**
 * Format price with dynamic precision based on value
 */
export function formatDynamicPrice(price: number): string {
  if (price === 0) return '0';
  if (price < 0.000001) return price.toExponential(2);
  if (price < 0.0001) return price.toFixed(8);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 10) return price.toFixed(3);
  if (price < 100) return price.toFixed(2);
  return price.toFixed(0);
}
