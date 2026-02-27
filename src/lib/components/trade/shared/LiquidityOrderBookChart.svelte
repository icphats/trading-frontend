<script lang="ts">
  import { scaleLinear } from "d3";
  import type { ScaleLinear } from "d3";
  import { tickToPrice, MIN_TICK, MAX_TICK } from "$lib/domain/markets/utils";
  import {
    formatSigFig,
    formatCompactUSD,
    formatNumber,
    fromDecimals,
  } from "$lib/utils/format.utils";
  import type { PoolDepthRow } from "./orderbook.utils";
  import Logo from "$lib/components/ui/Logo.svelte";

  // Import shared liquidity depth utilities
  import {
    TICK_WINDOW_HALF,
    calculateBucketSize,
    aggregateIntoBuckets,
    getMaxTickSpacing,
    getCurrentTickFromPools,
    calculateToken0UsdValue,
    calculateToken1UsdValue,
    calculateTotalAmounts,
    type LiquidityBucket,
  } from "$lib/domain/markets/utils/liquidity-depth";

  // ============================================================================
  // Types
  // ============================================================================

  interface Props {
    /** Pool depth data from market depth response */
    pools: PoolDepthRow[];
    /** Token0 decimals for amount formatting */
    token0Decimals: number;
    /** Token1 decimals for amount formatting */
    token1Decimals: number;
    /** Token0 USD price in E12 format (null if unknown) */
    token0PriceUsd: bigint | null;
    /** Token1 USD price in E12 format (null if unknown) */
    token1PriceUsd: bigint | null;
    /** Token0 logo URL */
    token0Logo?: string;
    /** Token1 logo URL */
    token1Logo?: string;
    /** Token0 symbol for tooltip */
    token0Symbol?: string;
    /** Token1 symbol for tooltip */
    token1Symbol?: string;
    /** Quote token symbol for price display */
    quoteSymbol?: string;
    /** Reference tick from market depth (shared with order book) */
    referenceTick?: number;
    /** Reference price in E12 format (shared with order book) */
    referencePriceE12?: bigint;
    /** Whether chart is loading */
    isLoading?: boolean;
    /** Pending range from pool form (highlighted overlay) */
    pendingRange?: { tickLower: number; tickUpper: number } | null;
    /** User's existing positions for subtle overlay */
    existingPositions?: Array<{ positionId: bigint; tickLower: number; tickUpper: number; feePips: number }>;
  }

  let {
    pools,
    token0Decimals,
    token1Decimals,
    token0PriceUsd,
    token1PriceUsd,
    token0Logo,
    token1Logo,
    token0Symbol = "Token0",
    token1Symbol = "Token1",
    quoteSymbol = "Quote",
    referenceTick: refTick,
    referencePriceE12,
    isLoading = false,
    pendingRange = null,
    existingPositions = [],
  }: Props = $props();

  // ============================================================================
  // Constants
  // ============================================================================

  const CHART_PADDING = { top: 8, right: 8, bottom: 8, left: 70 };
  const BAR_GAP = 2; // Gap between bars for visual separation
  const MIN_BAR_HEIGHT = 3;
  const CURRENT_PRICE_LINE_WIDTH = 1;

  // Colors
  const COLORS = {
    above: "var(--color-bearish)", // Sell side (token0) - red
    below: "var(--color-bullish)", // Buy side (token1) - green
    current: "var(--primary)",
    grid: "var(--border)",
    text: "var(--muted-foreground)",
    textHighlight: "var(--foreground)",
  };

  // ============================================================================
  // State
  // ============================================================================

  let chartWidth = $state(300);
  let chartHeight = $state(400);
  let wrapperRef: HTMLDivElement | null = $state(null);

  // Hover state
  let hoveredBar: LiquidityBucket | null = $state(null);
  let mouseX = $state(0);
  let mouseY = $state(0);

  // Zoom state
  const MIN_WINDOW = 3000;
  let activeWindowHalf = $state(TICK_WINDOW_HALF);
  let userZoomed = $state(false); // Track if user manually zoomed

  // ============================================================================
  // Derived Values
  // ============================================================================

  const contentWidth = $derived(
    chartWidth - CHART_PADDING.left - CHART_PADDING.right
  );
  const contentHeight = $derived(
    chartHeight - CHART_PADDING.top - CHART_PADDING.bottom
  );

  /** Get current tick - prefer reference tick from market depth (shared with order book) */
  const currentTick = $derived(getCurrentTickFromPools(pools, refTick));

  /** Get the largest tick spacing from pools (for bucket sizing) */
  const maxTickSpacing = $derived(getMaxTickSpacing(pools));

  /**
   * Outermost initialized ticks across all pools — the actual extent of
   * real liquidity. When no pools exist, falls back to pendingRange bounds.
   * Zoom stops here (with padding), not at MIN_TICK/MAX_TICK
   * which produce degenerate 0/Inf prices.
   */
  const liquidityBounds = $derived.by(() => {
    let lo = currentTick;
    let hi = currentTick;
    for (const pool of pools) {
      for (const t of pool.initializedTicks) {
        if (t.tick < lo) lo = t.tick;
        if (t.tick > hi) hi = t.tick;
      }
    }
    // Include pending range bounds so the overlay is always visible
    if (pendingRange) {
      if (pendingRange.tickLower < lo) lo = pendingRange.tickLower;
      if (pendingRange.tickUpper > hi) hi = pendingRange.tickUpper;
    }
    // 20% padding so the outermost content isn't at the chart edge
    const padding = Math.max(TICK_WINDOW_HALF, Math.ceil((hi - lo) * 0.2));
    return {
      lo: Math.max(MIN_TICK, lo - padding),
      hi: Math.min(MAX_TICK, hi + padding),
    };
  });

  /**
   * Maximum half-window: the larger distance from currentTick to either
   * liquidity bound. Zoom stops when all real liquidity is visible.
   */
  const maxWindowHalf = $derived(
    Math.max(liquidityBounds.hi - currentTick, currentTick - liquidityBounds.lo)
  );

  /**
   * Tick range centered on current tick, clamped to liquidity bounds.
   */
  const tickRange = $derived.by(() => {
    const half = Math.min(activeWindowHalf, maxWindowHalf);
    return {
      min: Math.max(liquidityBounds.lo, currentTick - half),
      max: Math.min(liquidityBounds.hi, currentTick + half),
    };
  });

  /**
   * Maximum bars that fit in the container without overflow.
   * Each bar needs at least MIN_BAR_HEIGHT + BAR_GAP pixels (last bar has no trailing gap).
   */
  const maxBarsForHeight = $derived(
    Math.max(1, Math.floor((contentHeight + BAR_GAP) / (MIN_BAR_HEIGHT + BAR_GAP)))
  );

  /**
   * Bucket count scales smoothly with window size via log interpolation,
   * capped to what physically fits in the container.
   */
  const dynamicBucketCount = $derived.by(() => {
    const range = tickRange.max - tickRange.min;
    const fullRange = liquidityBounds.hi - liquidityBounds.lo;
    const t = Math.log(range) / Math.log(Math.max(fullRange, range)); // 0..1
    const desired = Math.round(50 + t * 150); // 50..200
    return Math.min(desired, maxBarsForHeight);
  });

  /** Bucket size in ticks */
  const bucketSize = $derived(
    calculateBucketSize(tickRange, dynamicBucketCount, maxTickSpacing)
  );

  /**
   * Process all pools and aggregate liquidity into buckets.
   * Uses the shared aggregateIntoBuckets utility.
   */
  const aggregatedBars = $derived.by((): LiquidityBucket[] => {
    if (!pools || pools.length === 0) return [];

    return aggregateIntoBuckets(pools, {
      tickRange,
      bucketSize,
      currentTick,
      token0Decimals,
      token1Decimals,
      token0PriceUsd,
      token1PriceUsd,
    });
  });

  /** Maximum USD value for X scale */
  const maxUsdValue = $derived.by(() => {
    if (aggregatedBars.length === 0) return 1;
    return (
      aggregatedBars.reduce(
        (max, bar) => (bar.usdValueLocked > max ? bar.usdValueLocked : max),
        0
      ) || 1
    );
  });

  /** Total amounts across all bars */
  const totals = $derived(
    calculateTotalAmounts(
      aggregatedBars,
      token0Decimals,
      token1Decimals,
      token0PriceUsd,
      token1PriceUsd
    )
  );

  /** X scale: USD value to bar width */
  const xScale = $derived.by((): ScaleLinear<number, number> => {
    return scaleLinear().domain([0, maxUsdValue]).range([0, contentWidth]);
  });

  /** Height of each bar in pixels */
  const barHeight = $derived.by(() => {
    if (aggregatedBars.length === 0) return MIN_BAR_HEIGHT;
    // n bars have n-1 gaps between them
    const numGaps = aggregatedBars.length - 1;
    const availableHeight = contentHeight - numGaps * BAR_GAP;
    // Allow fractional heights - SVG handles sub-pixel rendering well
    return Math.max(MIN_BAR_HEIGHT, availableHeight / aggregatedBars.length);
  });

  /** Y axis labels - show price at specific bar indices */
  const yAxisLabels = $derived.by(() => {
    const labels: Array<{ index: number; tick: number; y: number }> = [];

    if (aggregatedBars.length === 0) {
      // No bars — generate labels from tickRange (for pending-range-only view)
      const range = tickRange.max - tickRange.min;
      if (range <= 0) return labels;
      const numLabels = 8;
      const tickStep = range / numLabels;
      for (let i = 0; i <= numLabels; i++) {
        const tick = Math.round(tickRange.max - i * tickStep);
        const y = (i / numLabels) * contentHeight;
        labels.push({ index: i, tick, y });
      }
      return labels;
    }

    // Show about 8-10 price labels, evenly distributed
    const numLabels = Math.min(10, aggregatedBars.length);
    const step = Math.max(1, Math.floor(aggregatedBars.length / numLabels));

    for (let i = 0; i < aggregatedBars.length; i += step) {
      const bar = aggregatedBars[i];
      labels.push({
        index: i,
        tick: bar.tick,
        y: i * (barHeight + BAR_GAP) + barHeight / 2,
      });
    }
    return labels;
  });

  /** Current price bar index and Y position */
  const currentPriceInfo = $derived.by(() => {
    const index = aggregatedBars.findIndex((bar) => bar.isCurrentTick);
    if (index === -1) return null;
    return {
      index,
      y: index * (barHeight + BAR_GAP) + barHeight / 2,
    };
  });

  // ============================================================================
  // Existing Position Overlays
  // ============================================================================

  /** Coverage intensity per bar — count how many user positions overlap each bar */
  const positionCoverage = $derived.by(() => {
    if (existingPositions.length === 0 || aggregatedBars.length === 0) return [];

    // Count overlaps per bar
    const counts = new Array(aggregatedBars.length).fill(0);
    for (const pos of existingPositions) {
      for (let i = 0; i < aggregatedBars.length; i++) {
        const bar = aggregatedBars[i];
        // Position overlaps bar if position range intersects bar range
        if (pos.tickLower < bar.tickUpper && pos.tickUpper > bar.tickLower) {
          counts[i]++;
        }
      }
    }

    const maxCount = Math.max(...counts);
    if (maxCount === 0) return [];

    // Build segments only for bars with coverage
    const segments: Array<{ barIndex: number; count: number; opacity: number }> = [];
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > 0) {
        segments.push({
          barIndex: i,
          count: counts[i],
          opacity: 0.1 + (counts[i] / maxCount) * 0.5, // 0.1 → 0.6
        });
      }
    }
    return segments;
  });

  /** Boundary markers — dots at each position's tickLower and tickUpper */
  const positionBoundaryMarkers = $derived.by(() => {
    if (existingPositions.length === 0 || aggregatedBars.length === 0) return [];

    const markers: Array<{ tick: number; y: number; inRange: boolean }> = [];
    const seen = new Set<number>(); // Deduplicate ticks at same level

    for (const pos of existingPositions) {
      const inRange = pos.tickLower <= currentTick && currentTick < pos.tickUpper;

      for (const tick of [pos.tickLower, pos.tickUpper]) {
        if (seen.has(tick)) continue;
        seen.add(tick);
        const y = tickToY(tick);
        // Only show markers within visible chart area
        if (y > 0 && y < contentHeight) {
          markers.push({ tick, y, inRange });
        }
      }
    }
    return markers;
  });

  // ============================================================================
  // Formatting Utilities
  // ============================================================================

  function formatPriceDisplay(tick: number): string {
    const price = tickToPrice(tick, token0Decimals, token1Decimals);
    if (!isFinite(price) || price > 1e15) return "Inf";
    if (price < 1e-15) return "0";
    return formatSigFig(price, 5, { subscriptZeros: true });
  }

  // ============================================================================
  // Tick-to-Y Mapping (for overlays)
  // ============================================================================

  function tickToY(tick: number): number {
    if (aggregatedBars.length === 0) {
      // No bars — use linear tick→pixel mapping from tickRange
      const range = tickRange.max - tickRange.min;
      if (range <= 0) return contentHeight / 2;
      // High ticks at top (y=0), low ticks at bottom (y=contentHeight)
      const t = (tickRange.max - tick) / range;
      return Math.max(0, Math.min(contentHeight, t * contentHeight));
    }
    // Bars are sorted descending by tick (high price at top)
    const barIndex = aggregatedBars.findIndex(b => tick >= b.tickLower && tick < b.tickUpper);
    if (barIndex === -1) {
      // Clamp to chart edges
      if (tick >= aggregatedBars[0].tickUpper) return 0;
      if (tick < aggregatedBars[aggregatedBars.length - 1].tickLower) return contentHeight;
      return 0;
    }
    return barIndex * (barHeight + BAR_GAP) + barHeight / 2;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function handleMouseMove(event: MouseEvent) {
    if (!wrapperRef || aggregatedBars.length === 0) return;
    const wrapperRect = wrapperRef.getBoundingClientRect();

    // Track mouse position relative to wrapper for tooltip
    mouseX = event.clientX - wrapperRect.left;
    mouseY = event.clientY - wrapperRect.top;

    // SVG uses explicit width/height (no viewBox scaling) — 1:1 pixel mapping
    // Subtract padding to get position within the content <g>
    const contentY = mouseY - CHART_PADDING.top;

    // Each bar occupies (barHeight + BAR_GAP) in SVG units, starting at y=0 in the content group
    const barPitch = barHeight + BAR_GAP;
    const barIndex = Math.floor(contentY / barPitch);

    if (barIndex >= 0 && barIndex < aggregatedBars.length) {
      hoveredBar = aggregatedBars[barIndex];
    } else {
      hoveredBar = null;
    }
  }

  function handleMouseLeave() {
    hoveredBar = null;
  }

  // ============================================================================
  // Lifecycle - ResizeObserver
  // ============================================================================

  $effect(() => {
    if (!wrapperRef) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.floor(entry.contentRect.width);
        const newHeight = Math.floor(entry.contentRect.height);
        if (newWidth !== chartWidth) chartWidth = newWidth;
        if (newHeight !== chartHeight) chartHeight = newHeight;
      }
    });

    resizeObserver.observe(wrapperRef);

    return () => resizeObserver.disconnect();
  });

  // ============================================================================
  // Auto-frame pending range
  // ============================================================================

  $effect(() => {
    if (userZoomed) return; // Don't auto-frame if user manually zoomed
    if (pendingRange) {
      const { tickLower, tickUpper } = pendingRange;
      const rangeSpan = tickUpper - tickLower;
      // Full-range positions — show all liquidity
      if (rangeSpan > maxWindowHalf * 2) {
        activeWindowHalf = maxWindowHalf;
        return;
      }
      // Frame: range center ↔ current tick, whichever is wider, with 50% padding
      const rangeCenter = (tickLower + tickUpper) / 2;
      const distToRange = Math.abs(currentTick - rangeCenter) + rangeSpan / 2;
      activeWindowHalf = Math.max(
        MIN_WINDOW,
        Math.min(maxWindowHalf, Math.ceil(distToRange * 1.5))
      );
    } else {
      activeWindowHalf = TICK_WINDOW_HALF;
    }
  });

  // ============================================================================
  // Zoom Controls
  // ============================================================================

  function zoomIn() {
    userZoomed = true;
    activeWindowHalf = Math.max(MIN_WINDOW, Math.floor(activeWindowHalf / 1.5));
  }

  function zoomOut() {
    userZoomed = true;
    activeWindowHalf = Math.min(maxWindowHalf, Math.ceil(activeWindowHalf * 1.5));
  }

  function zoomReset() {
    userZoomed = false;
    // The auto-frame effect will set the right value
  }

  // Helper functions for USD calculations in template
  function getToken0UsdValue(amount: bigint): number {
    return calculateToken0UsdValue(amount, token0Decimals, token0PriceUsd);
  }

  function getToken1UsdValue(amount: bigint): number {
    return calculateToken1UsdValue(amount, token1Decimals, token1PriceUsd);
  }
</script>

<div class="liquidity-depth-container">
  {#if isLoading}
    <div class="loading-state">
      <div class="shimmer"></div>
    </div>
  {:else if aggregatedBars.length === 0 && !pendingRange}
    <div class="empty-state">
      <span>No liquidity data</span>
    </div>
  {:else}
    <!-- Chart wrapper for ResizeObserver -->
    <div class="chart-wrapper" bind:this={wrapperRef}>
      <!-- Transparent overlay for reliable mouse event capture -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="hover-overlay"
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
      ></div>
      <svg
        class="chart-svg"
        width={chartWidth}
        height={chartHeight}
      >
        <g transform="translate({CHART_PADDING.left}, {CHART_PADDING.top})">
          <!-- Hover beam highlight (full-width glow behind the bar) - rendered first for z-order -->
          {#if hoveredBar}
            {@const barIndex = aggregatedBars.findIndex(b => b.tick === hoveredBar?.tick)}
            {#if barIndex >= 0}
              {@const barY = barIndex * (barHeight + BAR_GAP)}
              <!-- Beam background glow -->
              <rect
                x="-{CHART_PADDING.left}"
                y={barY - 2}
                width={contentWidth + CHART_PADDING.left + CHART_PADDING.right}
                height={barHeight + 4}
                fill={COLORS.textHighlight}
                opacity="0.08"
              />
              <!-- Top edge line -->
              <line
                x1="-{CHART_PADDING.left}"
                x2={contentWidth + CHART_PADDING.right}
                y1={barY - 2}
                y2={barY - 2}
                stroke={COLORS.textHighlight}
                stroke-width="0.5"
                stroke-opacity="0.2"
              />
              <!-- Bottom edge line -->
              <line
                x1="-{CHART_PADDING.left}"
                x2={contentWidth + CHART_PADDING.right}
                y1={barY + barHeight + 2}
                y2={barY + barHeight + 2}
                stroke={COLORS.textHighlight}
                stroke-width="0.5"
                stroke-opacity="0.2"
              />
            {/if}
          {/if}

          <!-- Grid lines (horizontal at price levels) -->
          <g class="grid-lines">
            {#each yAxisLabels as label}
              {#if label.y >= 0 && label.y <= contentHeight}
                <line
                  x1="0"
                  x2={contentWidth}
                  y1={label.y}
                  y2={label.y}
                  stroke={COLORS.grid}
                  stroke-opacity="0.3"
                />
              {/if}
            {/each}
          </g>

          <!-- Liquidity bars (horizontal from right edge) -->
          <!-- Use INDEX-based positioning for discrete bars with gaps (like Uniswap) -->
          <g class="liquidity-bars">
            {#each aggregatedBars as bar, i}
              {@const y = i * (barHeight + BAR_GAP)}
              {@const width = xScale(bar.usdValueLocked)}
              {@const isHovered = hoveredBar?.tick === bar.tick}

              <!-- Bar background (full width for hover detection) -->
              <rect
                x="0"
                {y}
                width={contentWidth}
                height={barHeight}
                fill="transparent"
                class="bar-hitbox"
              />

              {#if bar.usdValueLocked > 0}
                {#if bar.amount0Locked > 0n && bar.amount1Locked > 0n}
                  <!-- Bar with BOTH tokens: split color showing ratio -->
                  {@const token0Usd = getToken0UsdValue(bar.amount0Locked)}
                  {@const token1Usd = getToken1UsdValue(bar.amount1Locked)}
                  {@const ratio = token0Usd / (token0Usd + token1Usd || 1)}

                  <!-- Token1 portion (below/green) - starts from left -->
                  <rect
                    x={0}
                    {y}
                    width={Math.max(1, width * (1 - ratio))}
                    height={barHeight}
                    fill={COLORS.below}
                    opacity={hoveredBar ? (isHovered ? 1 : 0.4) : 0.7}
                    rx="1"
                  />
                  <!-- Token0 portion (above/red) - continues after token1 -->
                  <rect
                    x={width * (1 - ratio)}
                    {y}
                    width={Math.max(1, width * ratio)}
                    height={barHeight}
                    fill={COLORS.above}
                    opacity={hoveredBar ? (isHovered ? 1 : 0.4) : 0.7}
                    rx="1"
                  />
                {:else}
                  <!-- Single token bar -->
                  <rect
                    x={0}
                    {y}
                    width={Math.max(1, width)}
                    height={barHeight}
                    fill={bar.amount0Locked > 0n ? COLORS.above : COLORS.below}
                    opacity={hoveredBar ? (isHovered ? 1 : 0.4) : 0.7}
                    rx="1"
                  />
                {/if}
              {/if}
            {/each}
          </g>

          <!-- User liquidity coverage stripe (left edge, 6px) -->
          {#each positionCoverage as segment}
            {@const y = segment.barIndex * (barHeight + BAR_GAP)}
            <rect
              x={-6}
              {y}
              width={6}
              height={barHeight}
              fill="var(--primary)"
              opacity={segment.opacity}
              rx="1"
            />
          {/each}

          <!-- Position boundary markers (dots on price axis) -->
          {#each positionBoundaryMarkers as marker}
            <circle
              cx={-12}
              cy={marker.y}
              r="2.5"
              fill={marker.inRange ? "var(--primary)" : "var(--muted-foreground)"}
              opacity={marker.inRange ? 0.8 : 0.4}
            />
          {/each}

          <!-- Pending range overlay (prominent band) -->
          {#if pendingRange}
            {@const yTop = tickToY(pendingRange.tickUpper)}
            {@const yBottom = tickToY(pendingRange.tickLower)}
            {@const h = yBottom - yTop}
            {#if h > 0}
              <rect
                x="0"
                y={yTop}
                width={contentWidth}
                height={h}
                fill="var(--primary)"
                opacity="0.12"
                stroke="var(--primary)"
                stroke-width="1.5"
                rx="2"
              />
              <!-- Top edge tick label -->
              <text
                x={contentWidth - 4}
                y={yTop - 3}
                text-anchor="end"
                font-size="9"
                fill="var(--primary)"
                class="price-label"
              >
                {formatPriceDisplay(pendingRange.tickUpper)}
              </text>
              <!-- Bottom edge tick label -->
              <text
                x={contentWidth - 4}
                y={yBottom + 10}
                text-anchor="end"
                font-size="9"
                fill="var(--primary)"
                class="price-label"
              >
                {formatPriceDisplay(pendingRange.tickLower)}
              </text>
            {/if}
          {/if}

          <!-- Current price line -->
          {#if currentPriceInfo}
            <line
              x1="0"
              x2={contentWidth}
              y1={currentPriceInfo.y}
              y2={currentPriceInfo.y}
              stroke={COLORS.below}
              stroke-width={CURRENT_PRICE_LINE_WIDTH}
              stroke-dasharray="3,2"
            />
          {/if}

          <!-- Y axis (price labels) -->
          <g class="y-axis">
            {#each yAxisLabels as label}
              {#if label.y >= 10 && label.y <= contentHeight - 10}
                <text
                  x="-8"
                  y={label.y}
                  text-anchor="end"
                  dominant-baseline="middle"
                  font-size="10"
                  fill={COLORS.text}
                  class="price-label"
                >
                  {formatPriceDisplay(label.tick)}
                </text>
              {/if}
            {/each}
          </g>

        </g>
      </svg>

      <!-- Current price badge (HTML overlay for better styling) -->
      {#if currentPriceInfo}
        {@const displayPrice = referencePriceE12
          ? formatSigFig(Number(referencePriceE12) / 1e12, 5, {
              subscriptZeros: true,
            })
          : formatPriceDisplay(currentTick)}
        <div
          class="current-price-badge"
          style="top: {CHART_PADDING.top + currentPriceInfo.y}px"
        >
          {displayPrice}
        </div>
      {/if}

      <!-- Zoom controls -->
      <div class="zoom-controls">
        <button class="zoom-btn" onclick={zoomIn} aria-label="Zoom in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button class="zoom-btn" onclick={zoomReset} aria-label="Reset zoom">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
          </svg>
        </button>
        <button class="zoom-btn" onclick={zoomOut} aria-label="Zoom out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <!-- Tooltip (follows cursor, flips when near top) -->
      {#if hoveredBar}
        {@const token0Usd = getToken0UsdValue(hoveredBar.amount0Locked)}
        {@const token1Usd = getToken1UsdValue(hoveredBar.amount1Locked)}
        {@const totalUsd = token0Usd + token1Usd}
        {@const token0Pct = totalUsd > 0 ? (token0Usd / totalUsd) * 100 : 0}
        {@const token1Pct = totalUsd > 0 ? (token1Usd / totalUsd) * 100 : 0}
        {@const hasToken0 = hoveredBar.amount0Locked > 0n}
        {@const hasToken1 = hoveredBar.amount1Locked > 0n}
        {@const isTopHalf = mouseY < chartHeight / 2}
        <div
          class="tooltip"
          class:tooltip-below={isTopHalf}
          style="left: {mouseX + 16}px; top: {mouseY + (isTopHalf ? 8 : -8)}px;"
        >
          {#if hasToken0}
            <div class="tooltip-row">
              <div class="tooltip-token">
                <Logo src={token0Logo} alt={token0Symbol} size="xxs" circle={true} />
                <span class="tooltip-symbol">{token0Symbol}</span>
              </div>
              <div class="tooltip-values">
                <span class="tooltip-usd">{formatCompactUSD(token0Usd)}</span>
                <span class="tooltip-pct">{token0Pct.toFixed(0)}%</span>
              </div>
            </div>
          {/if}
          {#if hasToken1}
            <div class="tooltip-row">
              <div class="tooltip-token">
                <Logo src={token1Logo} alt={token1Symbol} size="xxs" circle={true} />
                <span class="tooltip-symbol">{token1Symbol}</span>
              </div>
              <div class="tooltip-values">
                <span class="tooltip-usd">{formatCompactUSD(token1Usd)}</span>
                <span class="tooltip-pct">{token1Pct.toFixed(0)}%</span>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Totals footer -->
    <div class="totals-footer">
      <div class="total-item">
        <Logo src={token0Logo} alt="" size="xxs" circle={true} />
        <span class="total-amount"
          >{formatNumber(fromDecimals(totals.amount0, token0Decimals), {
            maximumFractionDigits: 0,
          })}</span
        >
        <span class="total-usd">{formatCompactUSD(totals.usd0)}</span>
      </div>
      <div class="total-item">
        <Logo src={token1Logo} alt="" size="xxs" circle={true} />
        <span class="total-amount"
          >{formatNumber(fromDecimals(totals.amount1, token1Decimals), {
            maximumFractionDigits: 0,
          })}</span
        >
        <span class="total-usd">{formatCompactUSD(totals.usd1)}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .liquidity-depth-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .chart-wrapper {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .chart-svg {
    display: block;
  }

  .hover-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    cursor: crosshair;
  }

  .price-label {
    font-family: var(--font-numeric, monospace);
    font-size: 10px;
  }

  .current-price-badge {
    position: absolute;
    right: 8px;
    transform: translateY(-50%);
    background: var(--background);
    border: 0.5px solid var(--color-bullish);
    color: var(--color-bullish);
    font-family: var(--font-numeric, monospace);
    font-size: 10px;
    font-weight: 500;
    padding: 1px 5px;
    border-radius: 3px;
    pointer-events: none;
    white-space: nowrap;
  }

  .bar-hitbox {
    cursor: pointer;
  }

  /* Totals footer */
  .totals-footer {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 6px 12px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .total-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .total-amount {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground);
  }

  .total-usd {
    font-family: var(--font-numeric, monospace);
    font-size: 10px;
    color: var(--muted-foreground);
  }

  /* Tooltip - follows cursor */
  .tooltip {
    position: absolute;
    z-index: 100;
    background: var(--popover);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 8px;
    min-width: 140px;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-100%);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* When in top half, show tooltip below cursor */
  .tooltip-below {
    transform: translateY(0);
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .tooltip-token {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tooltip-symbol {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 485;
    color: var(--foreground);
  }

  .tooltip-values {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tooltip-usd {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
  }

  .tooltip-pct {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  /* Zoom controls */
  .zoom-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 20;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .zoom-btn:hover {
    color: var(--foreground);
    border-color: var(--foreground);
  }

  .zoom-btn:active {
    transform: scale(0.92);
  }

  /* Loading/Empty states */
  .loading-state,
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-state {
    color: var(--muted-foreground);
    font-size: 12px;
  }

  .shimmer {
    width: 80%;
    height: 60%;
    background: linear-gradient(
      90deg,
      var(--muted) 25%,
      var(--muted-foreground) 50%,
      var(--muted) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    opacity: 0.3;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
