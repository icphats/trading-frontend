import type { UTCTimestamp, CandlestickData, LineData, HistogramData } from 'lightweight-charts';
import type { ThemeColors } from './chart.colors';
import type { BaseChartData, CandleWithVolume, PriceBasis, RawCandle } from './chart.constants';
import { E12_SCALE, getVolumeScale } from './chart.constants';

/**
 * Convert milliseconds timestamp to seconds for lightweight-charts UTCTimestamp
 * Backend sends timestamps in milliseconds, but lightweight-charts expects Unix seconds
 */
function msToSeconds(ms: bigint): UTCTimestamp {
  return Math.floor(Number(ms) / 1000) as UTCTimestamp;
}

/**
 * Empty base chart data (for initialization)
 */
export const EMPTY_BASE_DATA: BaseChartData = {
  candles: [],
  ohlc: [],
  line: [],
  volume: [],
};

/**
 * Transform raw candle array to chart-ready formats
 * Used by trading chart with SpotMarket data
 *
 * @param chartData - Raw candle tuples from backend
 * @param colors - Theme colors for bullish/bearish
 * @param priceBasis - 'icp' for quote token, 'usd' for USD conversion
 * @param baseTokenDecimals - Decimals of base token for volume scaling (default 8 for ICP)
 */
export function transformSpotCandles(
  chartData: RawCandle[],
  colors: ThemeColors,
  priceBasis: PriceBasis = 'icp',
  baseTokenDecimals: number = 8
): BaseChartData {
  const candles: CandleWithVolume[] = [];
  const ohlc: CandlestickData<UTCTimestamp>[] = [];
  const line: LineData<UTCTimestamp>[] = [];
  const volume: HistogramData<UTCTimestamp>[] = [];

  if (!chartData || !Array.isArray(chartData)) {
    return EMPTY_BASE_DATA;
  }

  const bullishColor = colors?.bullish ?? '#10b981';
  const bearishColor = colors?.bearish ?? '#ef4444';
  const volumeScale = getVolumeScale(baseTokenDecimals);

  for (let i = 0; i < chartData.length; i++) {
    const candle = chartData[i];

    // Validate candle structure (must be array with 6 elements)
    if (!candle || !Array.isArray(candle) || candle.length !== 6) {
      continue;
    }

    const time = msToSeconds(candle[0]);
    if (!time || time === 0) {
      continue;
    }

    // Extract and scale OHLC values (E12 precision)
    const openQuote = Number(candle[1]) / E12_SCALE;
    const highQuote = Number(candle[2]) / E12_SCALE;
    const lowQuote = Number(candle[3]) / E12_SCALE;
    const closeQuote = Number(candle[4]) / E12_SCALE;
    // Volume uses native token decimals, NOT E12
    const volumeNative = Number(candle[5]) / volumeScale;

    // Skip invalid OHLC data
    if (!isFinite(openQuote) || !isFinite(highQuote) || !isFinite(lowQuote) || !isFinite(closeQuote)) {
      continue;
    }

    // Skip invalid volume
    if (!isFinite(volumeNative) || volumeNative < 0) {
      continue;
    }

    const open = openQuote;
    const high = highQuote;
    const low = lowQuote;
    const close = closeQuote;
    const vol = volumeNative;

    candles.push({ time, open, high, low, close, volume: vol });
    ohlc.push({ time, open, high, low, close });
    line.push({ time, value: close });
    volume.push({
      time,
      value: vol,
      color: close >= open ? bullishColor : bearishColor,
    });
  }

  return { candles, ohlc, line, volume };
}

/**
 * Transform raw candles for explore charts (token detail)
 * No price basis conversion, simpler output
 *
 * @param rawCandles - Raw candle tuples from backend
 * @param colors - Theme colors for bullish/bearish
 * @param baseTokenDecimals - Decimals of base token for volume scaling (default 8 for ICP)
 */
export function transformExploreCandles(
  rawCandles: RawCandle[],
  colors: { bullish: string; bearish: string },
  baseTokenDecimals: number = 8
): {
  lineData: LineData<UTCTimestamp>[];
  candleData: CandlestickData<UTCTimestamp>[];
  volumeData: HistogramData<UTCTimestamp>[];
} {
  const lineData: LineData<UTCTimestamp>[] = [];
  const candleData: CandlestickData<UTCTimestamp>[] = [];
  const volumeData: HistogramData<UTCTimestamp>[] = [];

  if (!rawCandles || !Array.isArray(rawCandles)) {
    return { lineData, candleData, volumeData };
  }

  const volumeScale = getVolumeScale(baseTokenDecimals);

  for (const candle of rawCandles) {
    // Validate candle structure (must be array with 6 elements)
    if (!candle || !Array.isArray(candle) || candle.length !== 6) continue;

    const time = msToSeconds(candle[0]);
    if (!time || time === 0) continue;

    // Extract and scale OHLC values (E12 precision)
    const open = Number(candle[1]) / E12_SCALE;
    const high = Number(candle[2]) / E12_SCALE;
    const low = Number(candle[3]) / E12_SCALE;
    const close = Number(candle[4]) / E12_SCALE;
    // Volume uses native token decimals, NOT E12
    const vol = Number(candle[5]) / volumeScale;


    // Skip invalid OHLC data
    if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) {
      continue;
    }

    // Skip invalid volume
    if (!isFinite(vol) || vol < 0) {
      continue;
    }

    lineData.push({ time, value: close });
    candleData.push({ time, open, high, low, close });
    volumeData.push({
      time,
      value: vol,
      color: close >= open ? `${colors.bullish}80` : `${colors.bearish}80`,
    });
  }

  // Sort by time
  lineData.sort((a, b) => a.time - b.time);
  candleData.sort((a, b) => a.time - b.time);
  volumeData.sort((a, b) => a.time - b.time);

  return { lineData, candleData, volumeData };
}

/**
 * Transform raw candles for pool charts with optional price inversion
 *
 * @param rawCandles - Raw candle tuples from backend
 * @param colors - Theme colors for bullish/bearish
 * @param isReversed - Whether to invert prices (for reversed token pairs)
 * @param baseTokenDecimals - Decimals of base token for volume scaling (default 8 for ICP)
 */
export function transformPoolCandles(
  rawCandles: RawCandle[],
  colors: { bullish: string; bearish: string },
  isReversed: boolean = false,
  baseTokenDecimals: number = 8
): {
  lineData: LineData<UTCTimestamp>[];
  candleData: CandlestickData<UTCTimestamp>[];
  volumeData: HistogramData<UTCTimestamp>[];
} {
  const lineData: LineData<UTCTimestamp>[] = [];
  const candleData: CandlestickData<UTCTimestamp>[] = [];
  const volumeData: HistogramData<UTCTimestamp>[] = [];

  if (!rawCandles || !Array.isArray(rawCandles)) {
    return { lineData, candleData, volumeData };
  }

  const volumeScale = getVolumeScale(baseTokenDecimals);

  for (const candle of rawCandles) {
    // Validate candle structure (must be array with 6 elements)
    if (!candle || !Array.isArray(candle) || candle.length !== 6) continue;

    const time = msToSeconds(candle[0]);
    if (!time || time === 0) continue;

    // Extract and scale OHLC values (E12 precision)
    let open = Number(candle[1]) / E12_SCALE;
    let high = Number(candle[2]) / E12_SCALE;
    let low = Number(candle[3]) / E12_SCALE;
    let close = Number(candle[4]) / E12_SCALE;
    // Volume uses native token decimals, NOT E12
    const vol = Number(candle[5]) / volumeScale;


    // Skip invalid OHLC data
    if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) {
      continue;
    }

    // Skip invalid volume
    if (!isFinite(vol) || vol < 0) {
      continue;
    }

    // Apply price inversion if needed
    if (isReversed) {
      const invOpen = open > 0 ? 1 / open : 0;
      const invHigh = low > 0 ? 1 / low : 0; // Inverted low becomes high
      const invLow = high > 0 ? 1 / high : 0; // Inverted high becomes low
      const invClose = close > 0 ? 1 / close : 0;
      open = invOpen;
      high = invHigh;
      low = invLow;
      close = invClose;
    }

    lineData.push({ time, value: close });
    candleData.push({ time, open, high, low, close });
    volumeData.push({
      time,
      value: vol,
      color: close >= open ? `${colors.bullish}80` : `${colors.bearish}80`,
    });
  }

  // Sort by time
  lineData.sort((a, b) => a.time - b.time);
  candleData.sort((a, b) => a.time - b.time);
  volumeData.sort((a, b) => a.time - b.time);

  return { lineData, candleData, volumeData };
}

/**
 * Transform a single live candle for real-time updates
 *
 * @param liveCandle - Raw candle tuple from backend
 * @param priceBasis - 'icp' for quote token, 'usd' for USD conversion
 * @param colors - Theme colors for bullish/bearish
 * @param baseTokenDecimals - Decimals of base token for volume scaling (default 8 for ICP)
 */
export function transformLiveCandle(
  liveCandle: RawCandle,
  priceBasis: PriceBasis,
  colors: ThemeColors,
  baseTokenDecimals: number = 8
): {
  ohlc: CandlestickData<UTCTimestamp>;
  line: LineData<UTCTimestamp>;
  volume: HistogramData<UTCTimestamp>;
} | null {
  // Validate candle structure (must be array with 6 elements)
  if (!liveCandle || !Array.isArray(liveCandle) || liveCandle.length !== 6) {
    return null;
  }

  const time = msToSeconds(liveCandle[0]);
  if (!time || time === 0) return null;

  const volumeScale = getVolumeScale(baseTokenDecimals);

  // Extract and scale OHLC values (E12 precision)
  const open = Number(liveCandle[1]) / E12_SCALE;
  const high = Number(liveCandle[2]) / E12_SCALE;
  const low = Number(liveCandle[3]) / E12_SCALE;
  const close = Number(liveCandle[4]) / E12_SCALE;
  // Volume uses native token decimals, NOT E12
  const vol = Number(liveCandle[5]) / volumeScale;

  // Skip invalid OHLC data
  if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) {
    return null;
  }

  // Skip invalid volume
  if (!isFinite(vol) || vol < 0) {
    return null;
  }

  const color = close >= open
    ? (colors?.bullish ?? '#10b981')
    : (colors?.bearish ?? '#ef4444');

  return {
    ohlc: { time, open, high, low, close },
    line: { time, value: close },
    volume: { time, value: vol, color },
  };
}

/**
 * Calculate price change percentage from candle data
 */
export function calculatePriceChange(
  data: LineData<UTCTimestamp>[]
): number {
  if (data.length < 2) return 0;

  const firstPrice = data[0].value;
  const lastPrice = data[data.length - 1].value;

  if (firstPrice === 0) return 0;
  return ((lastPrice - firstPrice) / firstPrice) * 100;
}

/**
 * Get the latest price from line data
 */
export function getLatestPrice(data: LineData<UTCTimestamp>[]): number {
  if (data.length === 0) return 0;
  return data[data.length - 1].value;
}

/**
 * Ensure value is a proper array (handles reactive proxies)
 */
export function ensureArray<T>(
  value: T[] | ReadonlyArray<T> | Iterable<T> | null | undefined
): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof (value as any)[Symbol.iterator] === 'function') {
    return Array.from(value as Iterable<T>);
  }
  return [];
}
