import type { ChartOptions, DeepPartial, ColorType } from 'lightweight-charts';
import type { ThemeColors } from './chart.colors';
import { getGridLineColor, getCrosshairColor, getScaleLineColor } from './chart.colors';
import { DEFAULT_PRICE_FORMAT, type ChartMode } from './chart.constants';

/**
 * Create base chart options
 */
export function getChartOptions(
  width: number,
  height: number,
  colors: ThemeColors,
  mode: ChartMode = 'interactive'
): DeepPartial<ChartOptions> {
  const gridLineColor = getGridLineColor(colors);
  const crosshairColor = getCrosshairColor(colors);
  const scaleLineColor = getScaleLineColor(colors);

  const isStatic = mode === 'static';

  return {
    width: width || 600,
    height: height || 400,
    layout: {
      textColor: colors.mutedForeground,
      background: { type: 'solid' as ColorType, color: colors.background },
      fontFamily: "'Basel', sans-serif",
    },
    grid: {
      vertLines: { color: isStatic ? 'transparent' : gridLineColor, visible: !isStatic },
      horzLines: { color: isStatic ? 'transparent' : gridLineColor, visible: !isStatic },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: scaleLineColor,
      borderVisible: !isStatic,
      ticksVisible: !isStatic,
      fixLeftEdge: isStatic,
      fixRightEdge: isStatic,
      barSpacing: 8,
    },
    crosshair: {
      mode: isStatic ? 1 : 0, // 1 = Magnet, 0 = Normal
      vertLine: {
        visible: true,
        labelVisible: !isStatic,
        style: isStatic ? 3 : 2, // 3 = LargeDashed, 2 = Dashed
        width: 1,
        color: crosshairColor,
      },
      horzLine: {
        visible: true,
        labelVisible: !isStatic,
        style: isStatic ? 3 : 2,
        width: 1,
        color: crosshairColor,
      },
    },
    rightPriceScale: {
      borderColor: scaleLineColor,
      borderVisible: !isStatic,
      mode: 0, // Normal mode
      scaleMargins: isStatic ? { top: 0.25, bottom: 0.05 } : undefined,
    },
    handleScale: !isStatic,
    handleScroll: !isStatic,
  };
}

/**
 * Create candlestick series options
 */
export function getCandlestickOptions(colors: ThemeColors) {
  return {
    upColor: colors.bullish,
    downColor: colors.bearish,
    borderVisible: false,
    wickUpColor: colors.candleWick || colors.bullish,
    wickDownColor: colors.candleWick || colors.bearish,
    priceFormat: DEFAULT_PRICE_FORMAT,
  };
}

/**
 * Create line series options
 */
export function getLineOptions(colors: ThemeColors) {
  const lineColor = colors.chart2 || colors.primary;
  return {
    color: lineColor,
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    crosshairMarkerBorderColor: '#ffffff',
    crosshairMarkerBackgroundColor: lineColor,
    lastPriceAnimation: 0,
    priceFormat: DEFAULT_PRICE_FORMAT,
  };
}

/**
 * Create area series options (for explore charts)
 */
export function getAreaOptions(
  lineColor: string,
  topColor: string,
  bottomColor: string
) {
  return {
    lineColor,
    topColor,
    bottomColor,
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    crosshairMarkerBackgroundColor: lineColor,
    crosshairMarkerBorderColor: '#fff',
    crosshairMarkerBorderWidth: 2,
  };
}

/**
 * Create volume histogram series options
 */
export function getVolumeOptions(colors: ThemeColors) {
  return {
    priceFormat: { type: 'volume' as const },
    priceScaleId: 'volume',
    color: colors.volume || '#6b7280',
  };
}

/**
 * Create volume histogram options for explore charts (no price scale)
 */
export function getExploreVolumeOptions() {
  return {
    priceFormat: { type: 'volume' as const },
    priceScaleId: '',
    priceLineVisible: false,
    lastValueVisible: false,
  };
}

/**
 * Create oracle line series options
 */
export function getOracleLineOptions(colors: ThemeColors) {
  return {
    color: colors.primary || colors.chart2 || '#6b7280',
    lineWidth: 1,
    lastValueVisible: true,
    priceLineVisible: true,
    priceLineWidth: 1,
    priceLineStyle: 2,
    crosshairMarkerVisible: false,
    lastPriceAnimation: 0,
    priceFormat: DEFAULT_PRICE_FORMAT,
  };
}

/**
 * Create PnL line series options
 */
export function getPnLLineOptions() {
  return {
    color: '#00FF00',
    lineWidth: 1,
    lineStyle: 0,
    lastValueVisible: true,
    priceLineVisible: true,
    priceLineWidth: 1,
    priceLineStyle: 0,
    priceLineColor: '#00FF00',
    title: 'Avg Entry',
    crosshairMarkerVisible: false,
    lastPriceAnimation: 0,
    priceFormat: DEFAULT_PRICE_FORMAT,
  };
}

/**
 * Volume scale margins configuration
 */
export const VOLUME_SCALE_MARGINS = {
  top: 0.8,
  bottom: 0,
};

/**
 * Explore chart volume scale margins
 */
export const EXPLORE_VOLUME_SCALE_MARGINS = {
  top: 0.25,
  bottom: 0,
};
