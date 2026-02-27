import type {
  CustomSeriesPricePlotValues,
  ICustomSeriesPaneView,
  PaneRendererCustomData,
  Time,
  WhitespaceData,
} from 'lightweight-charts';
import { customSeriesDefaultOptions } from 'lightweight-charts';
import { LiquidityBarSeriesRenderer } from './liquidity-bar-renderer';
import type {
  LiquidityBarData,
  LiquidityBarSeriesOptions,
  LiquidityBarSeriesProps,
} from './liquidity-bar.types';
import { DEFAULT_LIQUIDITY_BAR_OPTIONS } from './liquidity-bar.types';

/**
 * Custom series for rendering liquidity depth as horizontal bars
 *
 * This series displays liquidity distribution across price ticks,
 * with bars colored based on whether they are above or below the
 * current active tick.
 *
 * Usage:
 * ```typescript
 * const series = new LiquidityBarSeries({
 *   tokenAboveColor: '#ef4444',
 *   tokenBelowColor: '#22c55e',
 *   currentTickColor: '#3b82f6',
 *   activeTick: 100000,
 * });
 *
 * const customSeries = chart.addCustomSeries(series, {
 *   priceScaleId: 'liquidity',
 * });
 *
 * customSeries.setData(liquidityData);
 * ```
 */
export class LiquidityBarSeries<TData extends LiquidityBarData = LiquidityBarData>
  implements ICustomSeriesPaneView<Time, TData, LiquidityBarSeriesOptions>
{
  private _renderer: LiquidityBarSeriesRenderer<TData>;
  private _tokenAboveColor: string;
  private _tokenBelowColor: string;
  private _currentTickColor: string;
  private _activeTick?: number;
  private _radius: number;
  private _barSpacing: number;
  private _inactiveOpacity: number;

  constructor(props: LiquidityBarSeriesProps) {
    this._tokenAboveColor = props.tokenAboveColor;
    this._tokenBelowColor = props.tokenBelowColor;
    this._currentTickColor = props.currentTickColor;
    this._activeTick = props.activeTick;
    this._radius = props.radius ?? DEFAULT_LIQUIDITY_BAR_OPTIONS.radius;
    this._barSpacing = props.barSpacing ?? DEFAULT_LIQUIDITY_BAR_OPTIONS.barSpacing;
    this._inactiveOpacity = props.inactiveOpacity ?? DEFAULT_LIQUIDITY_BAR_OPTIONS.inactiveOpacity;

    this._renderer = new LiquidityBarSeriesRenderer<TData>({
      tokenAboveColor: this._tokenAboveColor,
      tokenBelowColor: this._tokenBelowColor,
      currentTickColor: this._currentTickColor,
      activeTick: this._activeTick,
      radius: this._radius,
      barSpacing: this._barSpacing,
      inactiveOpacity: this._inactiveOpacity,
    });
  }

  /**
   * Build price values for the price scale
   * Returns [min, max] where min is 0 and max is the liquidity value
   */
  priceValueBuilder(plotRow: TData): CustomSeriesPricePlotValues {
    return [0, plotRow.liquidity];
  }

  /**
   * Determine if a data point is whitespace (no data)
   */
  isWhitespace(data: TData | WhitespaceData): data is WhitespaceData {
    return (data as TData).liquidity === undefined || (data as TData).liquidity === null;
  }

  /**
   * Get the renderer instance
   */
  renderer(): LiquidityBarSeriesRenderer<TData> {
    return this._renderer;
  }

  /**
   * Update the renderer with new data and options
   */
  update(data: PaneRendererCustomData<Time, TData>, options: LiquidityBarSeriesOptions): void {
    this._renderer.update(data, options);
  }

  /**
   * Get default options for the series
   */
  defaultOptions(): LiquidityBarSeriesOptions {
    return {
      ...customSeriesDefaultOptions,
      ...DEFAULT_LIQUIDITY_BAR_OPTIONS,
      tokenAboveColor: this._tokenAboveColor,
      tokenBelowColor: this._tokenBelowColor,
      currentTickColor: this._currentTickColor,
      activeTick: this._activeTick,
      radius: this._radius,
      barSpacing: this._barSpacing,
      inactiveOpacity: this._inactiveOpacity,
    };
  }

  /**
   * Update the active tick (e.g., when pool state changes)
   */
  setActiveTick(tick: number | undefined): void {
    this._activeTick = tick;
  }

  /**
   * Get the current active tick
   */
  getActiveTick(): number | undefined {
    return this._activeTick;
  }

  /**
   * Update the hovered tick directly on the renderer
   * This bypasses applyOptions to avoid triggering crosshair updates
   */
  setHoveredTick(tick: number | undefined): void {
    this._renderer.setHoveredTick(tick);
  }
}
