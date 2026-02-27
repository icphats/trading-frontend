import type { UTCTimestamp, CandlestickData, LineData, HistogramData } from 'lightweight-charts';
import { formatSigFig } from '$lib/utils/format.utils';
import type { ChartInterval as CandidChartInterval } from 'declarations/spot/spot.did';

// =============================================================================
// SCALING CONSTANTS
// =============================================================================

/**
 * E12 precision scaling factor (1e12)
 * Used for: OHLC prices (fields 1-4) and quote_usd_rate (field 6)
 * NOT used for: volume (field 5) - uses native token decimals
 */
export const E12_SCALE = 1_000_000_000_000;

/** @deprecated Use E12_SCALE instead - kept for backwards compatibility */
export const SCALE = E12_SCALE;

/**
 * Calculate volume scale factor from token decimals
 * Volume is stored in native token decimals (e.g., 8 for ICP, 6 for USDC)
 */
export function getVolumeScale(tokenDecimals: number): number {
  return Math.pow(10, tokenDecimals);
}

// Chart view types
export type ChartView = 'candle' | 'line' | 'area';

// Data types that can be displayed
// - token mode: price, volume, tvl
// - pool mode: volume, liquidity, fees (no price - tick depth chart will be added separately)
export type DataType = 'price' | 'volume' | 'tvl' | 'liquidity' | 'fees';

// Price basis for trading charts
export type PriceBasis = 'icp' | 'usd';

// Chart intervals - trading page style
export type ChartInterval = '1m' | '15m' | '1h' | '4h' | '1d';

// Time intervals - explore page style (user-friendly labels)
// Note: 1H removed - snapshot buffer is hourly, no sub-hourly aggregation possible
export type TimeInterval = '1D' | '1W' | '1M' | '1Y';

// Backend interval mapping
export interface IntervalConfig {
  backend: ChartInterval;
  candles: number;
}

// Explore page interval configuration
// Aligned with backend snapshot intervals:
// - 1D: 24 × 1-hour bars
// - 1W: 28 × 6-hour bars (168h / 6 = 28)
// - 1M: 30 × daily bars
// - 1Y: 52 × weekly bars
export const EXPLORE_INTERVAL_CONFIG: Record<TimeInterval, IntervalConfig> = {
  '1D': { backend: '1h', candles: 24 },
  '1W': { backend: '4h', candles: 42 },
  '1M': { backend: '1d', candles: 30 },
  '1Y': { backend: '1d', candles: 365 },
};

/**
 * Convert chart interval string to Candid ChartInterval variant
 */
export function toCandidChartInterval(interval: ChartInterval): CandidChartInterval {
  switch (interval) {
    case '1m':
      return { min1: null };
    case '15m':
      return { min15: null };
    case '1h':
      return { hour1: null };
    case '4h':
      return { hour4: null };
    case '1d':
      return { day1: null };
  }
}

// Trading page interval options
export const TRADING_INTERVAL_OPTIONS: { value: ChartInterval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
];

// Trading page: visible candles per selected interval (initial view)
export const TRADING_VISIBLE_CANDLES: Record<ChartInterval, number> = {
  '1m': 60,   // 1 hour of data
  '15m': 48,  // 12 hours of data
  '1h': 48,   // 2 days of data
  '4h': 42,   // 1 week of data
  '1d': 30,   // 1 month of data
};

// Price format configuration using significant figures
export const DEFAULT_PRICE_FORMAT = {
  type: 'custom' as const,
  precision: 6,
  minMove: 0.000001,
  formatter: (price: number) => formatSigFig(price, 5, { subscriptZeros: true }),
};

// Candle data with volume (internal representation)
export interface CandleWithVolume extends CandlestickData<UTCTimestamp> {
  volume: number;
}

// Base chart data structure
export interface BaseChartData {
  candles: CandleWithVolume[];
  ohlc: CandlestickData<UTCTimestamp>[];
  line: LineData<UTCTimestamp>[];
  volume: HistogramData<UTCTimestamp>[];
}

/**
 * Raw candle tuple from backend (SpotCandle):
 * [0] timestamp_sec      - Unix seconds
 * [1] open_e12           - E12 precision (÷ E12_SCALE)
 * [2] high_e12           - E12 precision (÷ E12_SCALE)
 * [3] low_e12            - E12 precision (÷ E12_SCALE)
 * [4] close_e12          - E12 precision (÷ E12_SCALE)
 * [5] volume_native      - Native token decimals (÷ getVolumeScale(tokenDecimals))
 */
export type RawCandle = [bigint, bigint, bigint, bigint, bigint, bigint];

// Chart mode determines interaction behavior
export type ChartMode = 'interactive' | 'static';

// Data layer toggles
export type DataLayerKey = 'oracle' | 'volume';

// Trading overlay toggles
export type TradingOverlayKey = 'avgEntry' | 'triggers' | 'limitOrders' | 'liquidation';

// Chart settings state shape
export interface ChartSettingsState {
  view: ChartView;
  layers: Record<DataLayerKey, boolean>;
  trading: Record<TradingOverlayKey, boolean>;
  priceBasis: PriceBasis;
  interval: ChartInterval;
}

// Default chart settings
export const DEFAULT_CHART_SETTINGS: ChartSettingsState = {
  view: 'candle',
  layers: {
    oracle: true,
    volume: false,
  },
  trading: {
    avgEntry: false,
    triggers: false,
    limitOrders: false,
    liquidation: false,
  },
  priceBasis: 'icp',
  interval: '1h',
};
