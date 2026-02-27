<script lang="ts">
  /**
   * LiquidityExploreChart - Liquidity Depth Visualization for Explore Page
   *
   * Displays liquidity distribution across price ticks using lightweight-charts
   * with a custom LiquidityBarSeries. Shows:
   * - Liquidity bars colored by position relative to current price
   * - Stacked bars showing token0/token1 ratio when both present
   * - Hover tooltip with price and USD values (fixed top-right)
   * - Price labels overlay on the left side
   * - Current tick highlight
   *
   * Uses shared utilities from $lib/domain/markets/utils/liquidity-depth/
   */
  import { onMount } from 'svelte';
  import { createChart, type IChartApi, type UTCTimestamp } from 'lightweight-charts';

  import ChartContainer from '../primitives/ChartContainer.svelte';
  import { LiquidityBarSeries, type LiquidityBarData as SeriesBarData } from '../series/liquidity-bar';
  import { getCurrentThemeColors } from '../core/chart.colors';
  import { formatVolume } from '../core/chart.format';
  import {
    type PoolDepthRow,
    type LiquidityBucket,
    aggregateIntoBuckets,
    calculateTickRange,
    calculateBucketSize,
    getCurrentTickFromPools,
    getMaxTickSpacing,
    calculateTotalAmounts,
    calculateToken0UsdValue,
    calculateToken1UsdValue,
    TICK_WINDOW_HALF,
    TICK_WINDOW_HALF_FULL,
    NUM_BUCKETS,
    NUM_BUCKETS_FULL,
  } from '$lib/domain/markets/utils/liquidity-depth';
  import { fromDecimals, formatCompactUSD, formatSigFig } from '$lib/utils/format.utils';
  import { tickToPrice } from '$lib/domain/markets/utils/math';
  import Logo from '$lib/components/ui/Logo.svelte';

  interface Props {
    /** Pool depth data with initialized ticks */
    pools: PoolDepthRow[];
    /** Current tick of the most liquid pool */
    currentTick?: number;
    /** Token0 decimals for calculations */
    token0Decimals: number;
    /** Token1 decimals for calculations */
    token1Decimals: number;
    /** Token0 symbol for tooltip */
    token0Symbol?: string;
    /** Token1 symbol for tooltip */
    token1Symbol?: string;
    /** Token0 logo URL */
    token0Logo?: string;
    /** Token1 logo URL */
    token1Logo?: string;
    /** Token0 USD price in E12 format */
    token0PriceUsd?: bigint | null;
    /** Token1 USD price in E12 format */
    token1PriceUsd?: bigint | null;
    /** Loading state */
    isLoading?: boolean;
    /** Chart height */
    height?: string;
  }

  let {
    pools,
    currentTick,
    token0Decimals,
    token1Decimals,
    token0Symbol = 'Token0',
    token1Symbol = 'Token1',
    token0Logo,
    token1Logo,
    token0PriceUsd = null,
    token1PriceUsd = null,
    isLoading = false,
    height = '356px',
  }: Props = $props();

  // Chart state
  let chartContainer: HTMLElement | null = $state(null);
  let chart: IChartApi | null = $state(null);
  let customSeries: ReturnType<IChartApi['addCustomSeries']> | null = $state(null);
  let liquidityBarSeries: LiquidityBarSeries | null = $state(null);

  // Hover state
  let hoveredBucket: LiquidityBucket | null = $state(null);
  let showTooltip = $state(false);
  let mouseX = $state(0);
  let mouseY = $state(0);

  // Re-entry guard to prevent infinite loop when applyOptions triggers crosshair updates
  let isUpdatingHover = false;

  // Track mouse position relative to chart wrapper
  let chartWrapper: HTMLElement | null = $state(null);
  function handleMouseMove(e: MouseEvent) {
    if (!chartWrapper) return;
    const rect = chartWrapper.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }

  // Derived: Active tick from pools or prop
  const activeTick = $derived(currentTick ?? getCurrentTickFromPools(pools));

  // Helper: Calculate USD value for token0 amount
  function getToken0UsdValue(amount: bigint): number {
    return calculateToken0UsdValue(amount, token0Decimals, token0PriceUsd);
  }

  // Helper: Calculate USD value for token1 amount
  function getToken1UsdValue(amount: bigint): number {
    return calculateToken1UsdValue(amount, token1Decimals, token1PriceUsd);
  }

  // Derived: Aggregate buckets from pool data (full range for zoom out capability)
  const liquidityBuckets = $derived.by(() => {
    if (!pools || pools.length === 0) return [];

    const tick = activeTick;
    // Use full tick range for data so users can zoom out to see all liquidity
    const tickRange = calculateTickRange({ currentTick: tick, halfWindow: TICK_WINDOW_HALF_FULL });
    const tickSpacing = getMaxTickSpacing(pools);
    // Use more buckets to maintain granularity across the larger range
    const bucketSize = calculateBucketSize(tickRange, NUM_BUCKETS_FULL, tickSpacing);

    return aggregateIntoBuckets(pools, {
      tickRange,
      bucketSize,
      currentTick: tick,
      token0Decimals,
      token1Decimals,
      token0PriceUsd,
      token1PriceUsd,
    });
  });

  // Derived: Calculate initial visible range indices (for default zoom level)
  const initialVisibleRange = $derived.by(() => {
    if (liquidityBuckets.length === 0) return { from: 0, to: 50 };

    // Find the index of the current tick bucket in the sorted data
    const sortedByTick = [...liquidityBuckets].sort((a, b) => a.tick - b.tick);
    const currentTickIndex = sortedByTick.findIndex(b => b.isCurrentTick);
    const centerIndex = currentTickIndex >= 0 ? currentTickIndex : Math.floor(sortedByTick.length / 2);

    // Show approximately NUM_BUCKETS worth of data centered on current tick
    const halfVisible = Math.floor(NUM_BUCKETS / 2);
    const from = Math.max(0, centerIndex - halfVisible);
    const to = Math.min(sortedByTick.length - 1, centerIndex + halfVisible);

    return { from, to };
  });

  // Derived: Transform buckets to chart series format
  const chartData = $derived.by((): SeriesBarData[] => {
    if (liquidityBuckets.length === 0) return [];

    // Buckets are sorted by tick descending (high price at top)
    // For the chart, we need them in ascending order by time (index)
    const sortedByTick = [...liquidityBuckets].sort((a, b) => a.tick - b.tick);

    return sortedByTick.map((bucket, index) => {
      const amount0 = Number(fromDecimals(bucket.amount0Locked, token0Decimals));
      const amount1 = Number(fromDecimals(bucket.amount1Locked, token1Decimals));
      const usd0 = getToken0UsdValue(bucket.amount0Locked);
      const usd1 = getToken1UsdValue(bucket.amount1Locked);
      const totalUsd = usd0 + usd1;
      const token0Ratio = totalUsd > 0 ? usd0 / totalUsd : 0;

      return {
        time: index as UTCTimestamp,
        tick: bucket.tick,
        liquidity: bucket.usdValueLocked,
        amount0Locked: amount0,
        amount1Locked: amount1,
        usd0Locked: usd0,
        usd1Locked: usd1,
        token0Ratio,
        price: bucket.price,
        isCurrentTick: bucket.isCurrentTick,
      };
    });
  });

  // Derived: Total amounts for summary display
  const totals = $derived.by(() => {
    if (liquidityBuckets.length === 0) {
      return { amount0: 0n, amount1: 0n, usd0: 0, usd1: 0, totalUsd: 0 };
    }
    return calculateTotalAmounts(
      liquidityBuckets,
      token0Decimals,
      token1Decimals,
      token0PriceUsd,
      token1PriceUsd
    );
  });

  // Derived: Price labels for Y-axis overlay (8-10 evenly distributed)
  const priceLabels = $derived.by(() => {
    if (liquidityBuckets.length === 0) return [];

    const sortedByTick = [...liquidityBuckets].sort((a, b) => a.tick - b.tick);
    const numLabels = Math.min(8, sortedByTick.length);
    if (numLabels < 2) return [];

    const labels: Array<{ tick: number; price: number; yPercent: number }> = [];
    const step = (sortedByTick.length - 1) / (numLabels - 1);

    for (let i = 0; i < numLabels; i++) {
      const index = Math.round(i * step);
      const bucket = sortedByTick[index];
      if (bucket) {
        // yPercent is inverted because higher ticks = higher prices = lower y position
        const yPercent = ((sortedByTick.length - 1 - index) / (sortedByTick.length - 1)) * 100;
        labels.push({
          tick: bucket.tick,
          price: bucket.price,
          yPercent,
        });
      }
    }

    return labels;
  });

  // Check if data is empty
  const isEmpty = $derived(!isLoading && (!pools || pools.length === 0 || liquidityBuckets.length === 0));

  // Derived: Current active tick bucket for default price display
  const activeTickBucket = $derived<LiquidityBucket | undefined>(liquidityBuckets.find(b => b.isCurrentTick) ?? liquidityBuckets[0]);

  // Derived: Display price (hovered or active tick)
  const displayPrice = $derived((hoveredBucket as LiquidityBucket | null)?.price ?? activeTickBucket?.price ?? 0);
  const isShowingActiveTick = $derived(!(hoveredBucket as LiquidityBucket | null) || (hoveredBucket as unknown as LiquidityBucket).isCurrentTick);

  // Format price ratio for display
  function formatPriceRatio(price: number): string {
    if (price === 0) return '0';
    return formatSigFig(price, 6);
  }

  // Initialize chart
  function initializeChart() {
    if (!chartContainer || chart) return;

    const colors = getCurrentThemeColors();

    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: colors.mutedForeground,
        fontFamily: "'Basel', sans-serif",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.35, bottom: 0 },
      },
      timeScale: {
        visible: false,
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: 0, // Normal mode but we hide all visual elements
        vertLine: {
          visible: false,
          labelVisible: false,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
    } as any);

    // Create custom series instance
    liquidityBarSeries = new LiquidityBarSeries({
      tokenAboveColor: colors.bearish,
      tokenBelowColor: colors.bullish,
      currentTickColor: colors.primary,
      activeTick,
      radius: 8,
      barSpacing: 1,
      inactiveOpacity: 0.4,
    });

    // Add custom series to chart
    customSeries = chart.addCustomSeries(liquidityBarSeries, {
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => formatVolume(price),
      },
      priceLineVisible: false,
      lastValueVisible: false,
    } as any);

    // Subscribe to crosshair move for tooltip
    chart.subscribeCrosshairMove((param) => {
      // Re-entry guard: skip if we're already processing a hover update
      // This prevents infinite loop when applyOptions triggers crosshair updates
      if (isUpdatingHover) return;

      if (!param.point || !param.time) {
        if (showTooltip) {
          showTooltip = false;
          hoveredBucket = null;
          isUpdatingHover = true;
          if (customSeries) {
            customSeries.applyOptions({ hoveredTick: undefined } as any);
          }
          isUpdatingHover = false;
        }
        return;
      }

      // Find the bucket at this time index
      const timeIndex = param.time as number;
      const sortedByTick = [...liquidityBuckets].sort((a, b) => a.tick - b.tick);
      const bucket = sortedByTick[timeIndex];

      if (bucket && bucket.usdValueLocked > 0) {
        // Only update if the hovered bucket actually changed
        if (hoveredBucket?.tick !== bucket.tick) {
          hoveredBucket = bucket;
          showTooltip = true;

          isUpdatingHover = true;
          if (customSeries) {
            customSeries.applyOptions({ hoveredTick: bucket.tick } as any);
          }
          isUpdatingHover = false;
        }
      } else {
        if (showTooltip) {
          showTooltip = false;
          hoveredBucket = null;
          isUpdatingHover = true;
          if (customSeries) {
            customSeries.applyOptions({ hoveredTick: undefined } as any);
          }
          isUpdatingHover = false;
        }
      }
    });

    updateChartData();
  }

  // Track if initial view has been set
  let hasSetInitialView = false;

  // Update chart data
  function updateChartData() {
    if (!chart || !customSeries || chartData.length === 0) return;

    customSeries.setData(chartData);

    // Update active tick
    if (liquidityBarSeries) {
      liquidityBarSeries.setActiveTick(activeTick);
    }
    if (customSeries) {
      customSeries.applyOptions({
        activeTick,
      } as any);
    }

    // Set initial visible range centered on current tick (only on first load)
    if (!hasSetInitialView) {
      chart.timeScale().setVisibleLogicalRange({
        from: initialVisibleRange.from,
        to: initialVisibleRange.to,
      });
      hasSetInitialView = true;
    }
  }

  // Resize handler
  function handleResize() {
    if (chart && chartContainer) {
      chart.applyOptions({
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
      });
    }
  }

  // Update chart when data changes
  $effect(() => {
    chartData;
    activeTick;
    if (chart && customSeries) {
      updateChartData();
    }
  });

  onMount(() => {
    initializeChart();

    const ro = new ResizeObserver(handleResize);
    if (chartContainer) ro.observe(chartContainer);

    return () => {
      ro.disconnect();
      if (chart) {
        chart.remove();
        chart = null;
      }
    };
  });

  // Format price for display
  function formatPriceDisplay(tick: number): string {
    const price = tickToPrice(tick, token0Decimals, token1Decimals);
    return formatSigFig(price, 4, { subscriptZeros: true });
  }
</script>

<div
  class="pool-liquidity-chart"
  bind:this={chartWrapper}
  onmousemove={handleMouseMove}
>
  <!-- Price overlay showing dual price ratios (updates on hover) -->
  <div class="price-overlay">
    <div class="price-ratio">
      <span class="price-ratio-value">1 {token0Symbol} = {formatPriceRatio(displayPrice)} {token1Symbol}</span>
    </div>
    <div class="price-ratio">
      <span class="price-ratio-value">1 {token1Symbol} = {formatPriceRatio(displayPrice > 0 ? 1 / displayPrice : 0)} {token0Symbol}</span>
    </div>
    {#if isShowingActiveTick && activeTickBucket}
      <span class="active-range-label">Active Range</span>
    {/if}
  </div>

  <!-- Price labels overlay (left side) -->
  {#if priceLabels.length > 0 && !isEmpty}
    <div class="price-labels-overlay">
      {#each priceLabels as label}
        <div class="price-label" style="top: calc({label.yPercent}% + 36px);">
          {formatPriceDisplay(label.tick)}
        </div>
      {/each}
    </div>
  {/if}

  <ChartContainer {isLoading} {isEmpty} emptyMessage="No liquidity data available" {height}>
    <div class="chart-area" style:height bind:this={chartContainer}></div>
  </ChartContainer>

  <!-- Tooltip (follows cursor) -->
  {#if showTooltip && hoveredBucket}
    {@const token0Usd = getToken0UsdValue(hoveredBucket.amount0Locked)}
    {@const token1Usd = getToken1UsdValue(hoveredBucket.amount1Locked)}
    {@const totalUsd = token0Usd + token1Usd}
    {@const token0Pct = totalUsd > 0 ? (token0Usd / totalUsd) * 100 : 0}
    {@const token1Pct = totalUsd > 0 ? (token1Usd / totalUsd) * 100 : 0}
    {@const hasToken0 = hoveredBucket.amount0Locked > 0n}
    {@const hasToken1 = hoveredBucket.amount1Locked > 0n}
    <div class="tooltip" style="left: {mouseX + 16}px; top: {mouseY - 16}px;">
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

<style>
  .pool-liquidity-chart {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background);
    border-radius: 16px;
  }

  /* Price overlay with dual price ratios */
  .price-overlay {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 2px;
    pointer-events: none;
  }

  .price-ratio {
    display: flex;
    align-items: baseline;
  }

  .price-ratio-value {
    font-family: 'Basel', sans-serif;
    font-size: 28px;
    line-height: 36px;
    font-weight: 500;
    color: var(--foreground);
  }

  .active-range-label {
    font-family: 'Basel', sans-serif;
    font-size: 14px;
    line-height: 20px;
    font-weight: 485;
    color: var(--muted-foreground);
    margin-top: 4px;
  }

  /* Price labels overlay (left side) - hidden, using right axis instead */
  .price-labels-overlay {
    display: none;
  }

  .price-label {
    position: absolute;
    left: 4px;
    transform: translateY(-50%);
    font-family: 'Basel', sans-serif;
    font-size: 10px;
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .chart-area {
    width: 100%;
    position: relative;
    /* Dotted background pattern matching Uniswap */
    background-image: radial-gradient(circle, oklch(from var(--muted-foreground) l c h / 0.2) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: 0 0;
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
    font-family: 'Basel', sans-serif;
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
    font-family: 'Basel', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
  }

  .tooltip-pct {
    font-family: 'Basel', sans-serif;
    font-size: 13px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  @media (max-width: 768px) {
    .price-ratio-value {
      font-size: 20px;
      line-height: 28px;
    }
  }
</style>
