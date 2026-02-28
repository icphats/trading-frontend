import type {
  ICustomSeriesPaneRenderer,
  PaneRendererCustomData,
  PriceToCoordinateConverter,
  Time,
} from 'lightweight-charts';
import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { LiquidityBarData, LiquidityBarSeriesOptions, LiquidityBarSeriesProps } from './liquidity-bar.types';

/**
 * Internal representation of a bar item for rendering
 */
interface LiquidityBarItem {
  /** X coordinate (center of bar slot) */
  x: number;
  /** Y coordinate (where the bar extends to based on liquidity) */
  y: number;
  /** Original tick value */
  tick: number;
  /** Original liquidity value */
  liquidity: number;
  /** Ratio of base token USD value to total (0-1) for stacked rendering */
  baseRatio: number;
  /** Whether bar has both tokens (for stacked rendering) */
  hasBothTokens: boolean;
  /** Computed column position */
  column?: ColumnPosition;
}

interface ColumnPosition {
  left: number;
  right: number;
  shiftLeft: boolean;
}

interface BitmapPositionLength {
  position: number;
  length: number;
}

/**
 * Calculate bitmap position and length from media coordinates
 */
function positionsBox({
  position1Media,
  position2Media,
  pixelRatio,
}: {
  position1Media: number;
  position2Media: number;
  pixelRatio: number;
}): BitmapPositionLength {
  const scaledPosition1 = Math.round(pixelRatio * position1Media);
  const scaledPosition2 = Math.round(pixelRatio * position2Media);
  return {
    position: Math.min(scaledPosition1, scaledPosition2),
    length: Math.abs(scaledPosition2 - scaledPosition1),
  };
}

const ALIGN_TO_MINIMAL_WIDTH_LIMIT = 4;
const SHOW_SPACING_MINIMAL_BAR_WIDTH = 1;

/**
 * Calculate column spacing based on bar spacing
 */
function columnSpacing(barSpacingMedia: number, horizontalPixelRatio: number): number {
  return Math.ceil(barSpacingMedia * horizontalPixelRatio) <= SHOW_SPACING_MINIMAL_BAR_WIDTH
    ? 0
    : Math.max(1, Math.floor(horizontalPixelRatio));
}

/**
 * Calculate desired column width
 */
function desiredColumnWidth({
  barSpacingMedia,
  horizontalPixelRatio,
  spacing,
}: {
  barSpacingMedia: number;
  horizontalPixelRatio: number;
  spacing?: number;
}): number {
  return (
    Math.round(barSpacingMedia * horizontalPixelRatio) -
    (spacing ?? columnSpacing(barSpacingMedia, horizontalPixelRatio))
  );
}

interface ColumnCommon {
  spacing: number;
  shiftLeft: boolean;
  columnHalfWidthBitmap: number;
  horizontalPixelRatio: number;
}

/**
 * Pre-calculate common column values
 */
function columnCommon(barSpacingMedia: number, horizontalPixelRatio: number): ColumnCommon {
  const spacing = columnSpacing(barSpacingMedia, horizontalPixelRatio);
  const columnWidthBitmap = desiredColumnWidth({ barSpacingMedia, horizontalPixelRatio, spacing });
  const shiftLeft = columnWidthBitmap % 2 === 0;
  const columnHalfWidthBitmap = (columnWidthBitmap - (shiftLeft ? 0 : 1)) / 2;
  return {
    spacing,
    shiftLeft,
    columnHalfWidthBitmap,
    horizontalPixelRatio,
  };
}

/**
 * Calculate position for a single column
 */
function calculateColumnPosition({
  xMedia,
  columnData,
  previousPosition,
}: {
  xMedia: number;
  columnData: ColumnCommon;
  previousPosition?: ColumnPosition;
}): ColumnPosition {
  const xBitmapUnRounded = xMedia * columnData.horizontalPixelRatio;
  const xBitmap = Math.round(xBitmapUnRounded);
  const xPositions: ColumnPosition = {
    left: xBitmap - columnData.columnHalfWidthBitmap,
    right: xBitmap + columnData.columnHalfWidthBitmap - (columnData.shiftLeft ? 1 : 0),
    shiftLeft: xBitmap > xBitmapUnRounded,
  };
  const expectedAlignmentShift = columnData.spacing + 1;
  if (previousPosition) {
    if (xPositions.left - previousPosition.right !== expectedAlignmentShift) {
      if (previousPosition.shiftLeft) {
        previousPosition.right = xPositions.left - expectedAlignmentShift;
      } else {
        xPositions.left = previousPosition.right + expectedAlignmentShift;
      }
    }
  }
  return xPositions;
}

/**
 * Calculate column positions for all visible items
 */
function calculateColumnPositionsInPlace({
  items,
  barSpacingMedia,
  horizontalPixelRatio,
  startIndex,
  endIndex,
}: {
  items: LiquidityBarItem[];
  barSpacingMedia: number;
  horizontalPixelRatio: number;
  startIndex: number;
  endIndex: number;
}): void {
  const common = columnCommon(barSpacingMedia, horizontalPixelRatio);
  let previous: LiquidityBarItem | undefined;

  for (let i = startIndex; i < Math.min(endIndex, items.length); i++) {
    if (previous?.x && items[i].x - previous.x > barSpacingMedia) {
      previous = undefined;
    }
    items[i].column = calculateColumnPosition({
      xMedia: items[i].x,
      columnData: common,
      previousPosition: previous?.column,
    });
    previous = items[i];
  }

  // Normalize column widths
  const minColumnWidth = items.reduce((smallest: number, item: LiquidityBarItem, index: number) => {
    if (!item.column || index < startIndex || index > endIndex) {
      return smallest;
    }
    if (item.column.right < item.column.left) {
      item.column.right = item.column.left;
    }
    const width = item.column.right - item.column.left + 1;
    return Math.min(smallest, width);
  }, Math.ceil(barSpacingMedia * horizontalPixelRatio));

  if (common.spacing > 0 && minColumnWidth < ALIGN_TO_MINIMAL_WIDTH_LIMIT) {
    items.forEach((item: LiquidityBarItem, index: number) => {
      if (!item.column || index < startIndex || index > endIndex) {
        return;
      }
      const width = item.column.right - item.column.left + 1;
      if (width <= minColumnWidth) {
        return;
      }
      if (item.column.shiftLeft) {
        item.column.right -= 1;
      } else {
        item.column.left += 1;
      }
    });
  }
}

/**
 * Draw a rounded rectangle (with polyfill for older browsers)
 */
function roundRect({
  ctx,
  x,
  y,
  w,
  h,
  radii,
}: {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  radii?: number;
}): void {
  // roundRect might need to polyfilled for older browsers
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radii);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

/**
 * Custom renderer for liquidity bar series
 * Draws horizontal bars representing liquidity at each tick
 */
export class LiquidityBarSeriesRenderer<TData extends LiquidityBarData>
  implements ICustomSeriesPaneRenderer
{
  private _data: PaneRendererCustomData<Time, TData> | null = null;
  private _options: LiquidityBarSeriesProps & Partial<LiquidityBarSeriesOptions>;

  constructor(props: LiquidityBarSeriesProps) {
    this._options = {
      ...props,
      hoveredTick: props.activeTick,
    };
  }

  /**
   * Main draw entry point - called by lightweight-charts
   */
  draw(target: CanvasRenderingTarget2D, priceConverter: PriceToCoordinateConverter): void {
    target.useBitmapCoordinateSpace((scope) => this._drawImpl(scope, priceConverter));
  }

  /**
   * Update renderer with new data and options
   */
  update(data: PaneRendererCustomData<Time, TData>, options: LiquidityBarSeriesOptions): void {
    this._data = data;
    this._options = { ...this._options, ...options };
  }

  /**
   * Update the hovered tick directly without triggering chart updates
   * This is used from crosshair handlers to avoid infinite loops
   */
  setHoveredTick(tick: number | undefined): void {
    this._options = { ...this._options, hoveredTick: tick };
  }

  /**
   * Internal drawing implementation
   */
  private _drawImpl(
    renderingScope: BitmapCoordinatesRenderingScope,
    priceToCoordinate: PriceToCoordinateConverter
  ): void {
    if (this._data === null || this._data.bars.length === 0 || this._data.visibleRange === null) {
      return;
    }

    const ctx = renderingScope.context;
    const { horizontalPixelRatio, verticalPixelRatio } = renderingScope;

    // Build bar items from data
    const bars: LiquidityBarItem[] = this._data.bars.map((bar) => {
      const { amountBaseLocked, amountQuoteLocked, baseRatio } = bar.originalData;
      return {
        x: bar.x,
        y: priceToCoordinate(bar.originalData.liquidity) ?? 0,
        tick: bar.originalData.tick,
        liquidity: bar.originalData.liquidity,
        baseRatio: baseRatio ?? 0,
        hasBothTokens: amountBaseLocked > 0 && amountQuoteLocked > 0,
      };
    });

    // Calculate column positions
    calculateColumnPositionsInPlace({
      items: bars,
      barSpacingMedia: this._data.barSpacing,
      horizontalPixelRatio,
      startIndex: this._data.visibleRange.from,
      endIndex: this._data.visibleRange.to,
    });

    // Calculate zero line position (where bars start from)
    const zeroY = priceToCoordinate(0) ?? 0;

    const {
      tokenAboveColor = '#ef4444',
      tokenBelowColor = '#22c55e',
      currentTickColor = '#3b82f6',
      activeTick,
      hoveredTick,
      activeTickProgress,
      inactiveOpacity = 0.4,
      radius = 2,
    } = this._options;

    // Determine if we're in hover mode (any bar is hovered)
    const hasHoveredBar = hoveredTick !== undefined;

    // Draw each visible bar
    for (let i = this._data.visibleRange.from; i < this._data.visibleRange.to; i++) {
      const bar = bars[i];
      const column = bar.column;

      if (!column) {
        continue;
      }

      const isCurrentTick = activeTick === bar.tick;
      const isHoveredTick = hoveredTick === bar.tick;

      // Calculate bar dimensions
      const width = Math.min(
        Math.max(horizontalPixelRatio, column.right - column.left),
        this._data.barSpacing * horizontalPixelRatio
      );

      // Create margin for visual spacing between bars
      const margin = 0.15 * width;
      const widthWithMargin = width - margin * 2;

      // Calculate bar height from zero to liquidity value
      const totalBox = positionsBox({
        position1Media: zeroY,
        position2Media: bar.y,
        pixelRatio: verticalPixelRatio,
      });

      // Draw hover highlight background
      if (isHoveredTick) {
        const highlightOffset = 0.1 * ctx.canvas.height;
        const highlightLength = ctx.canvas.height - highlightOffset;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        roundRect({
          ctx,
          x: column.left + margin,
          y: highlightOffset,
          w: widthWithMargin,
          h: highlightLength,
          radii: radius * 2,
        });

        ctx.globalAlpha = 1;
      } else if (hasHoveredBar) {
        // Reduce opacity for non-hovered bars when something is hovered
        ctx.globalAlpha = inactiveOpacity;
      } else {
        ctx.globalAlpha = 1;
      }

      // Determine if this bar should be stacked (has both tokens)
      const shouldStack = bar.hasBothTokens && bar.baseRatio > 0 && bar.baseRatio < 1;

      if (shouldStack) {
        // Draw vertically stacked bar: quote (green/bullish) at bottom, base (red/bearish) on top
        // Use flat edges where segments meet, only round the outer corners
        const quoteHeight = totalBox.length * (1 - bar.baseRatio);
        const baseHeight = totalBox.length * bar.baseRatio;

        const x = column.left + margin;
        const w = widthWithMargin;

        // Base portion (above/red) - on top, rounded top corners only
        ctx.fillStyle = tokenAboveColor;
        ctx.beginPath();
        ctx.moveTo(x + radius, totalBox.position);
        ctx.lineTo(x + w - radius, totalBox.position);
        ctx.quadraticCurveTo(x + w, totalBox.position, x + w, totalBox.position + radius);
        ctx.lineTo(x + w, totalBox.position + Math.max(1, baseHeight));
        ctx.lineTo(x, totalBox.position + Math.max(1, baseHeight));
        ctx.lineTo(x, totalBox.position + radius);
        ctx.quadraticCurveTo(x, totalBox.position, x + radius, totalBox.position);
        ctx.closePath();
        ctx.fill();

        // Quote portion (below/green) - at bottom, rounded bottom corners only
        const quoteY = totalBox.position + baseHeight;
        ctx.fillStyle = tokenBelowColor;
        ctx.beginPath();
        ctx.moveTo(x, quoteY);
        ctx.lineTo(x + w, quoteY);
        ctx.lineTo(x + w, quoteY + Math.max(1, quoteHeight) - radius);
        ctx.quadraticCurveTo(x + w, quoteY + Math.max(1, quoteHeight), x + w - radius, quoteY + Math.max(1, quoteHeight));
        ctx.lineTo(x + radius, quoteY + Math.max(1, quoteHeight));
        ctx.quadraticCurveTo(x, quoteY + Math.max(1, quoteHeight), x, quoteY + Math.max(1, quoteHeight) - radius);
        ctx.lineTo(x, quoteY);
        ctx.closePath();
        ctx.fill();
      } else {
        // Single color bar based on position relative to active tick
        if (isCurrentTick) {
          ctx.fillStyle = currentTickColor;
        } else if (activeTick === undefined) {
          // No active tick defined - use neutral color
          ctx.fillStyle = tokenBelowColor;
        } else if (activeTick > bar.tick) {
          // Bar is below active tick (quote/bullish side)
          ctx.fillStyle = tokenBelowColor;
        } else {
          // Bar is above active tick (base/bearish side)
          ctx.fillStyle = tokenAboveColor;
        }

        // Draw the main bar (ensure minimum height of 2px for visibility)
        roundRect({
          ctx,
          x: column.left + margin,
          y: totalBox.position,
          w: widthWithMargin,
          h: Math.max(2, totalBox.length),
          radii: radius,
        });

        // Draw split coloring for current tick if progress is defined
        if (isCurrentTick && activeTickProgress !== undefined && activeTickProgress > 0 && activeTickProgress < 1) {
          ctx.globalCompositeOperation = 'source-atop';

          // Token above color takes up (1 - activeTickProgress) of the bar height from top
          const aboveHeight = totalBox.length * (1 - activeTickProgress);

          ctx.fillStyle = tokenAboveColor;
          ctx.beginPath();
          ctx.fillRect(column.left + margin, totalBox.position, widthWithMargin, aboveHeight);

          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // Reset opacity
      ctx.globalAlpha = 1;
    }
  }
}
