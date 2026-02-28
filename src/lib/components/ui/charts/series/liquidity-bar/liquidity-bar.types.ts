import type { CustomData, CustomSeriesOptions, UTCTimestamp } from 'lightweight-charts';

/**
 * Data point for a single liquidity bar
 * Each bar represents liquidity at a specific tick range
 */
export interface LiquidityBarData extends CustomData {
  /** UTCTimestamp - used as fake x-axis index for lightweight-charts compatibility */
  time: UTCTimestamp;
  /** The tick index for this liquidity bar */
  tick: number;
  /** Liquidity amount - determines bar width (horizontal extent) */
  liquidity: number;
  /** Amount of base token locked at this tick (in human-readable units) */
  amountBaseLocked: number;
  /** Amount of quote token locked at this tick (in human-readable units) */
  amountQuoteLocked: number;
  /** USD value of base token locked */
  usdBaseLocked: number;
  /** USD value of quote token locked */
  usdQuoteLocked: number;
  /** Ratio of base token USD value to total USD value (0-1), used for stacked bar rendering */
  baseRatio: number;
  /** Price at this tick - used for tooltip display */
  price: number;
  /** Whether this is the current active tick */
  isCurrentTick: boolean;
}

/**
 * Configuration options for the liquidity bar series
 */
export interface LiquidityBarSeriesOptions extends CustomSeriesOptions {
  /** Color for liquidity above current tick (base/bearish side) */
  tokenAboveColor: string;
  /** Color for liquidity below current tick (quote/bullish side) */
  tokenBelowColor: string;
  /** Color for current tick highlight */
  currentTickColor: string;
  /** Spacing gap between bars in pixels */
  barSpacing: number;
  /** Corner radius for rounded bar ends */
  radius: number;
  /** Current active tick of the pool */
  activeTick?: number;
  /** Currently hovered tick (for hover highlighting) */
  hoveredTick?: number;
  /** Opacity for non-hovered bars when a bar is hovered */
  inactiveOpacity: number;
  /** Progress through the current tick (0-1) for split coloring */
  activeTickProgress?: number;
}

/**
 * Props for constructing the liquidity bar series
 */
export interface LiquidityBarSeriesProps {
  tokenAboveColor: string;
  tokenBelowColor: string;
  currentTickColor: string;
  activeTick?: number;
  activeTickProgress?: number;
  radius?: number;
  barSpacing?: number;
  inactiveOpacity?: number;
}

/**
 * Default options for the liquidity bar series
 */
export const DEFAULT_LIQUIDITY_BAR_OPTIONS: Omit<LiquidityBarSeriesOptions, keyof CustomSeriesOptions> = {
  tokenAboveColor: '#ef4444', // bearish red
  tokenBelowColor: '#22c55e', // bullish green
  currentTickColor: '#3b82f6', // primary blue
  barSpacing: 1,
  radius: 2,
  inactiveOpacity: 0.4,
  activeTick: undefined,
  hoveredTick: undefined,
  activeTickProgress: undefined,
};
