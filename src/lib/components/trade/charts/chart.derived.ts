import type { UTCTimestamp, CandlestickData, LineData, HistogramData } from "lightweight-charts";
import type { ThemeColors } from "$lib/components/ui/charts/core";
import { E12_SCALE, getVolumeScale } from "$lib/components/ui/charts/core";
import type { SpotCandle } from "$lib/domain/markets";
import type { PriceBasis } from "./chart-controls.svelte";
import type { PriceEntry } from "$lib/repositories/cache";
import { findNearestRate } from "$lib/utils/price.utils";

export type CandleWithVolume = CandlestickData<UTCTimestamp> & { volume: number };

export interface BaseChartData {
  candles: CandleWithVolume[];
  ohlc: CandlestickData<UTCTimestamp>[];
  line: LineData<UTCTimestamp>[];
  oracle: LineData<UTCTimestamp>[];
  volume: HistogramData<UTCTimestamp>[];
}

/**
 * Transform SpotCandle tuples from backend into chart-ready formats
 *
 * @param chartData - Raw SpotCandle tuples from backend
 * @param themeColors - Theme colors for bullish/bearish
 * @param basis - 'icp' for quote token, 'usd' for USD conversion
 * @param baseTokenDecimals - Decimals of base token for volume scaling (default 8 for ICP)
 * @param quoteUsdRates - Oracle price entries for USD conversion (sorted [timestamp_ms, price_e12])
 */
export function deriveSpotBaseData(
  chartData: SpotCandle[],
  themeColors: ThemeColors,
  basis: PriceBasis,
  baseTokenDecimals: number = 8,
  quoteUsdRates: PriceEntry[] = []
): BaseChartData {
  const candles: CandleWithVolume[] = [];
  const oracle: LineData<UTCTimestamp>[] = [];
  const line: LineData<UTCTimestamp>[] = [];
  const volume: HistogramData<UTCTimestamp>[] = [];
  const ohlc: CandlestickData<UTCTimestamp>[] = [];

  // Validation: Check if chartData exists and is an array
  if (!chartData || !Array.isArray(chartData)) {
    return { candles, ohlc, line, oracle, volume };
  }

  if (chartData.length === 0) {
    return { candles, ohlc, line, oracle, volume };
  }

  const bullishColor = themeColors?.bullish ?? "#10b981";
  const bearishColor = themeColors?.bearish ?? "#ef4444";
  const volumeScale = getVolumeScale(baseTokenDecimals);

  for (let i = 0; i < chartData.length; i++) {
    const candle = chartData[i];

    // Validate candle structure (must be array with at least 6 elements)
    if (!candle || !Array.isArray(candle) || candle.length < 6) {
      continue;
    }

    const time = (Number(candle[0]) / 1000) as UTCTimestamp;
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
    const quoteUsdRate = basis === "usd" ? findNearestRate(quoteUsdRates, Number(candle[0])) : 0;

    // Skip invalid OHLC data
    if (!isFinite(openQuote) || !isFinite(highQuote) || !isFinite(lowQuote) || !isFinite(closeQuote)) {
      continue;
    }

    // Skip invalid volume
    if (!isFinite(volumeNative) || volumeNative < 0) {
      continue;
    }

    // Apply price basis conversion
    const priceFactor = basis === "usd" ? quoteUsdRate : 1;

    const open = openQuote * priceFactor;
    const high = highQuote * priceFactor;
    const low = lowQuote * priceFactor;
    const close = closeQuote * priceFactor;

    // USD volume = quantity × price × usdRate (actual USD value traded)
    // Quote volume = quantity (native units)
    const vol = basis === "usd"
      ? volumeNative * closeQuote * quoteUsdRate
      : volumeNative;

    candles.push({ time, open, high, low, close, volume: vol });
    ohlc.push({ time, open, high, low, close });
    line.push({ time, value: close });
    volume.push({
      time,
      value: vol,
      color: close >= open ? bullishColor : bearishColor,
    });
  }

  return { candles, ohlc, line, oracle, volume };
}

// Derive PnL horizontal line data
export function derivePnLLine(
  userinfo: any,
  baseData: BaseChartData
): LineData<UTCTimestamp>[] {
  if (!userinfo || !baseData.line.length) return [];

  const price = Number(userinfo.avg_usd_price ?? 0n) / E12_SCALE;
  if (!price || !isFinite(price)) return [];

  const first = baseData.line[0].time;
  const last = baseData.line[baseData.line.length - 1].time;

  return [
    { time: first, value: price },
    { time: last, value: price },
  ];
}
