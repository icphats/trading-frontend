<script lang="ts">
  import { onMount } from 'svelte';
  import { scaleLinear, max as d3Max } from 'd3';
  import type { ScaleLinear } from 'd3';
  import { tickToPrice, priceToTick } from '$lib/domain/markets/utils';
  import { formatSigFig } from '$lib/utils/format.utils';

  // ============================================================================
  // Types
  // ============================================================================
  interface TickLiquidityData {
    tick: number;
    liquidity_net: bigint;
    liquidity_gross: bigint;
  }

  interface ChartEntry {
    tick: number;
    price: number;
    activeLiquidity: number;
  }

  interface Props {
    /** Array of tick liquidity data from pool state */
    tickData: TickLiquidityData[];
    /** Current pool tick */
    currentTick: number;
    /** Lower bound tick for position */
    tickLower: number;
    /** Upper bound tick for position */
    tickUpper: number;
    /** Token0 decimals for price conversion */
    baseDecimals?: number;
    /** Token1 decimals for price conversion */
    quoteDecimals?: number;
    /** Quote token symbol */
    quoteSymbol?: string;
    /** Base token symbol */
    baseSymbol?: string;
    /** Callback when range changes */
    onRangeChange?: (tickLower: number, tickUpper: number) => void;
    /** Whether the chart is in loading state */
    isLoading?: boolean;
    /** Tick spacing for the pool */
    tickSpacing?: number;
    /** Whether prices are inverted (show Base/Quote instead of Quote/Base) */
    isInverted?: boolean;
  }

  let {
    tickData,
    currentTick,
    tickLower,
    tickUpper,
    baseDecimals = 8,
    quoteDecimals = 8,
    quoteSymbol = 'Quote',
    baseSymbol = 'Base',
    onRangeChange,
    isLoading = false,
    tickSpacing = 60,
    isInverted = false
  }: Props = $props();

  // ============================================================================
  // Constants
  // ============================================================================
  const CHART_HEIGHT = 200;
  const RANGE_INDICATOR_WIDTH = 16;
  const LIQUIDITY_BAR_WIDTH = 100;
  const BAR_HEIGHT = 3;
  const PRICE_DOT_RADIUS = 4;
  const MIN_RANGE_HEIGHT = 40;

  // Zoom/Pan constants
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 5;

  // ============================================================================
  // State
  // ============================================================================
  let containerRef: HTMLDivElement | null = $state(null);
  let svgRef: SVGSVGElement | null = $state(null);
  let chartWidth = $state(400);

  // Drag state
  let isDragging = $state(false);
  let dragType = $state<'min' | 'max' | 'range' | null>(null);

  // Hover state
  let hoveredY = $state<number | null>(null);
  let hoveredTick = $state<number | null>(null);

  // Zoom/Pan state
  let zoomLevel = $state(1);
  let scrollPosition = $state<number | null>(null); // null = auto-center on currentPrice

  // ============================================================================
  // Derived Values - Core Prices
  // ============================================================================

  // Helper to convert price based on inversion state
  function applyInversion(price: number): number {
    if (!isInverted || price <= 0) return price;
    return 1 / price;
  }

  // Get price for a tick (with inversion applied)
  function getTickPrice(tick: number): number {
    return applyInversion(tickToPrice(tick, baseDecimals, quoteDecimals));
  }

  // Convert ticks to prices (with inversion applied for display)
  const currentPrice = $derived(getTickPrice(currentTick));

  // Calculate displayed prices from both ticks, then determine which is min/max
  // When inverted, the relationship flips: lower tick → higher displayed price
  const priceFromLower = $derived(getTickPrice(tickLower));
  const priceFromUpper = $derived(getTickPrice(tickUpper));

  // Always ensure minPrice < maxPrice for correct visual positioning
  const minPrice = $derived(Math.min(priceFromLower, priceFromUpper));
  const maxPrice = $derived(Math.max(priceFromLower, priceFromUpper));

  // Process tick data into chart entries
  const processedData = $derived.by((): ChartEntry[] => {
    if (!tickData || tickData.length === 0) return [];

    return tickData.map(d => ({
      tick: d.tick,
      price: getTickPrice(d.tick),
      activeLiquidity: Number(d.liquidity_gross)
    })).filter(d => d.price > 0 && isFinite(d.price));
  });

  // Check if full range
  const isFullRange = $derived.by(() => {
    const MAX_TICK = 887272;
    const MIN_TICK = -887272;
    const boundsMin = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
    const boundsMax = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
    return tickLower <= boundsMin && tickUpper >= boundsMax;
  });

  // ============================================================================
  // Tick-Based Scale (scaleBand approach - Uniswap style)
  // Each tick gets equal pixel height regardless of its price value
  // ============================================================================

  // Calculate the required tick range to show the selected position with context
  // This ensures the chart viewport automatically expands to include tickLower/tickUpper
  const requiredTickRange = $derived.by(() => {
    // Start with the selected range
    let minRequired = tickLower;
    let maxRequired = tickUpper;

    // Always include currentTick
    minRequired = Math.min(minRequired, currentTick);
    maxRequired = Math.max(maxRequired, currentTick);

    // Add padding (20% on each side for context)
    const rangeSpan = maxRequired - minRequired;
    const padding = Math.max(rangeSpan * 0.2, tickSpacing * 10); // At least 10 ticks of padding

    return {
      minTick: minRequired - padding,
      maxTick: maxRequired + padding
    };
  });

  // Generate the list of visible ticks based on required range and zoom/scroll
  const visibleTicks = $derived.by((): number[] => {
    const { minTick: reqMin, maxTick: reqMax } = requiredTickRange;
    const fullRange = reqMax - reqMin;

    // Apply zoom: at zoom 1, show full required range; higher zoom = see less
    const visibleRange = fullRange / zoomLevel;

    // Calculate scroll offset
    // scrollPosition: null = center on currentTick, 0-1 = manual position
    let centerTick: number;
    if (scrollPosition === null) {
      // Auto-center on currentTick
      centerTick = Math.round(currentTick / tickSpacing) * tickSpacing;
    } else {
      // Manual scroll: interpolate between min and max of required range
      const scrollableRange = fullRange - visibleRange;
      const offset = scrollPosition * scrollableRange;
      centerTick = reqMin + offset + visibleRange / 2;
      centerTick = Math.round(centerTick / tickSpacing) * tickSpacing;
    }

    // Calculate visible bounds
    const halfVisible = visibleRange / 2;
    let startTick = Math.round((centerTick - halfVisible) / tickSpacing) * tickSpacing;
    let endTick = Math.round((centerTick + halfVisible) / tickSpacing) * tickSpacing;

    // Ensure we have a reasonable number of ticks
    const tickCount = Math.round((endTick - startTick) / tickSpacing);
    if (tickCount < 20) {
      // Expand to at least 20 ticks
      const expand = ((20 - tickCount) / 2) * tickSpacing;
      startTick -= expand;
      endTick += expand;
    }

    // Generate tick list (higher ticks first for proper Y ordering - high price at top)
    const ticks: number[] = [];
    for (let t = endTick; t >= startTick; t -= tickSpacing) {
      ticks.push(t);
    }
    return ticks;
  });

  // Get full tick bounds for the chart (for range calculations)
  const tickBounds = $derived.by(() => {
    if (visibleTicks.length === 0) {
      const { minTick, maxTick } = requiredTickRange;
      return { minTick, maxTick };
    }
    return {
      minTick: Math.min(...visibleTicks),
      maxTick: Math.max(...visibleTicks)
    };
  });

  // Create a tick-based scale where each tick gets equal space
  // Using scaleLinear with ticks (not prices) as domain
  const tickScale = $derived.by((): ScaleLinear<number, number> => {
    const { minTick, maxTick } = tickBounds;
    // Higher ticks (higher prices when not inverted) at top (y=0)
    // Lower ticks at bottom (y=height)
    // When inverted, higher ticks = lower displayed prices, but we still want
    // higher displayed prices at top, so we invert the scale direction
    if (isInverted) {
      return scaleLinear()
        .domain([minTick, maxTick]) // Lower tick → y=0 (higher displayed price)
        .range([0, CHART_HEIGHT])
        .clamp(false);
    } else {
      return scaleLinear()
        .domain([maxTick, minTick]) // Higher tick → y=0 (higher price)
        .range([0, CHART_HEIGHT])
        .clamp(false);
    }
  });

  // Convert tick to Y position
  function tickToY(tick: number): number {
    return tickScale(tick);
  }

  // Convert Y position to tick
  function yToTick(y: number): number {
    return tickScale.invert(y);
  }

  // X scale for liquidity bar widths
  const liquidityScale = $derived.by((): ScaleLinear<number, number> => {
    const maxLiq = d3Max(processedData, d => d.activeLiquidity) ?? 1;
    return scaleLinear()
      .domain([0, maxLiq])
      .range([0, LIQUIDITY_BAR_WIDTH]);
  });

  // Content width
  const contentWidth = $derived(chartWidth - RANGE_INDICATOR_WIDTH);

  // ============================================================================
  // Position Calculations
  // ============================================================================

  // Y positions for key elements (using tick-based scale)
  const currentPriceY = $derived(tickToY(currentTick));

  // For range bounds, use the actual ticks
  // When inverted, tickLower corresponds to maxPrice (displayed), tickUpper to minPrice
  // When not inverted, tickUpper corresponds to maxPrice, tickLower to minPrice
  const maxPriceY = $derived(isInverted ? tickToY(tickLower) : tickToY(tickUpper));
  const minPriceY = $derived(isInverted ? tickToY(tickUpper) : tickToY(tickLower));

  // Range height with minimum constraint
  const rangePositions = $derived.by(() => {
    let topY = maxPriceY;
    let bottomY = minPriceY;
    let height = bottomY - topY;

    // Ensure minimum height
    if (height < MIN_RANGE_HEIGHT) {
      const center = (topY + bottomY) / 2;
      topY = center - MIN_RANGE_HEIGHT / 2;
      bottomY = center + MIN_RANGE_HEIGHT / 2;
      height = MIN_RANGE_HEIGHT;
    }

    return { topY, bottomY, height };
  });

  // Check if elements are in view
  const isMaxHandleVisible = $derived(rangePositions.topY >= 0 && rangePositions.topY <= CHART_HEIGHT);
  const isMinHandleVisible = $derived(rangePositions.bottomY >= 0 && rangePositions.bottomY <= CHART_HEIGHT);
  const isCurrentPriceVisible = $derived(currentPriceY >= 0 && currentPriceY <= CHART_HEIGHT);

  // ============================================================================
  // Color Utilities
  // ============================================================================
  function isInRange(price: number): boolean {
    return price >= minPrice && price <= maxPrice;
  }

  function getBarColor(price: number): string {
    return isInRange(price) ? 'var(--primary)' : 'var(--muted-foreground)';
  }

  function getBarOpacity(price: number, tick?: number): number {
    const baseOpacity = isInRange(price) ? 0.6 : 0.2;

    // If a bar is hovered, dim non-hovered bars
    if (hoveredTick !== null && tick !== undefined) {
      if (tick === hoveredTick) {
        return Math.min(1, baseOpacity * 1.5); // Slightly brighten hovered bar
      }
      return baseOpacity * 0.4; // Dim non-hovered bars
    }

    return baseOpacity;
  }

  // ============================================================================
  // Drag Handlers
  // ============================================================================

  // Get price from Y position (for display/tooltip purposes)
  function yToPrice(y: number): number {
    const tick = yToTick(y);
    return getTickPrice(tick);
  }

  // Round tick to nearest valid tick based on tickSpacing
  function roundToTickSpacing(tick: number): number {
    return Math.round(tick / tickSpacing) * tickSpacing;
  }

  function handleMaxDrag(event: MouseEvent) {
    if (!svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    const y = Math.max(0, Math.min(CHART_HEIGHT, event.clientY - rect.top));

    // Convert Y to tick directly
    const rawTick = yToTick(y);
    const newTick = roundToTickSpacing(rawTick);

    if (isInverted) {
      // When inverted, max displayed price (top) corresponds to tickLower
      // Ensure tickLower < tickUpper
      if (newTick !== tickLower && newTick < tickUpper) {
        onRangeChange?.(newTick, tickUpper);
      }
    } else {
      // When not inverted, max displayed price (top) corresponds to tickUpper
      // Ensure tickLower < tickUpper
      if (newTick !== tickUpper && newTick > tickLower) {
        onRangeChange?.(tickLower, newTick);
      }
    }
  }

  function handleMinDrag(event: MouseEvent) {
    if (!svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    const y = Math.max(0, Math.min(CHART_HEIGHT, event.clientY - rect.top));

    // Convert Y to tick directly
    const rawTick = yToTick(y);
    const newTick = roundToTickSpacing(rawTick);

    if (isInverted) {
      // When inverted, min displayed price (bottom) corresponds to tickUpper
      // Ensure tickLower < tickUpper
      if (newTick !== tickUpper && newTick > tickLower) {
        onRangeChange?.(tickLower, newTick);
      }
    } else {
      // When not inverted, min displayed price (bottom) corresponds to tickLower
      // Ensure tickLower < tickUpper
      if (newTick !== tickLower && newTick < tickUpper) {
        onRangeChange?.(newTick, tickUpper);
      }
    }
  }

  function handleRangeDrag(event: MouseEvent, startY: number, startLower: number, startUpper: number) {
    if (!svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    const currentY = event.clientY - rect.top;
    const deltaY = currentY - startY;

    // Convert deltaY to tick delta
    // Use the scale to determine how many ticks correspond to the pixel delta
    const tickAtStart = yToTick(startY - rect.top + rect.top); // Just startY conceptually
    const tickAtNew = yToTick(currentY);
    const tickDelta = roundToTickSpacing(tickAtNew - tickAtStart);

    // Apply delta to both bounds
    const tickRange = startUpper - startLower;
    const newLower = startLower + tickDelta;
    const newUpper = startUpper + tickDelta;

    onRangeChange?.(newLower, newUpper);
  }

  function startDrag(type: 'min' | 'max' | 'range', event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
    dragType = type;

    const startY = event.clientY;
    const startLower = tickLower;
    const startUpper = tickUpper;

    const onMove = (e: MouseEvent) => {
      if (type === 'max') handleMaxDrag(e);
      else if (type === 'min') handleMinDrag(e);
      else handleRangeDrag(e, startY, startLower, startUpper);
    };

    const onUp = () => {
      isDragging = false;
      dragType = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ============================================================================
  // Wheel Handler (Scroll through tick range)
  // ============================================================================
  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Scroll through the tick range (only when zoomed in)
    if (zoomLevel <= 1) return; // Can't scroll when showing full range

    // Scroll increment based on wheel delta
    const scrollDelta = Math.sign(event.deltaY) * 0.05;

    // Calculate new scroll position
    const currentPos = scrollPosition ?? 0.5;
    const newPosition = Math.max(0, Math.min(1, currentPos + scrollDelta));

    scrollPosition = newPosition;
  }

  // ============================================================================
  // Zoom Controls
  // ============================================================================
  const ZOOM_STEP = 1.3;

  function zoomIn() {
    zoomLevel = Math.min(ZOOM_MAX, zoomLevel * ZOOM_STEP);
  }

  function zoomOut() {
    zoomLevel = Math.max(ZOOM_MIN, zoomLevel / ZOOM_STEP);
  }

  function resetView() {
    zoomLevel = 1; // Default zoom level
    scrollPosition = null; // Auto-center on currentTick
  }

  // ============================================================================
  // Format Utilities
  // ============================================================================
  function formatChartPrice(price: number): string {
    if (!isFinite(price) || price > 1e15) return '∞';
    if (price < 1e-15) return '0';
    return formatSigFig(price, 5);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================
  onMount(() => {
    if (!containerRef) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chartWidth = entry.contentRect.width;
      }
    });

    resizeObserver.observe(containerRef);
    chartWidth = containerRef.clientWidth;

    return () => resizeObserver.disconnect();
  });
</script>

<div class="chart-container" bind:this={containerRef}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    bind:this={svgRef}
    width={chartWidth}
    height={CHART_HEIGHT}
    class="chart-svg"
    class:loading={isLoading}
    onwheel={handleWheel}
    onmousemove={(e) => {
      const rect = svgRef?.getBoundingClientRect();
      if (rect) hoveredY = e.clientY - rect.top;
    }}
    onmouseleave={() => hoveredY = null}
  >
    <!-- Clip path to constrain bars to visible chart area -->
    <defs>
      <clipPath id="chart-clip">
        <rect x="0" y="0" width={contentWidth} height={CHART_HEIGHT} />
      </clipPath>
    </defs>

    {#if isLoading}
      <rect x="0" y="0" width={chartWidth} height={CHART_HEIGHT} fill="var(--muted)" class="shimmer" />
    {:else}
      <!-- Selected Range Background -->
      {#if isFullRange}
        <!-- Full range: cover entire chart area with lighter fill -->
        <rect
          x="0"
          y="0"
          width={contentWidth}
          height={CHART_HEIGHT}
          fill="var(--primary)"
          opacity="0.08"
        />
      {:else}
        <rect
          x="0"
          y={rangePositions.topY}
          width={contentWidth}
          height={rangePositions.height}
          fill="var(--primary)"
          opacity="0.12"
        />
      {/if}

      <!-- Liquidity Bars (using tick-based Y positioning) -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        class="liquidity-bars"
        clip-path="url(#chart-clip)"
        onmouseleave={() => hoveredTick = null}
      >
        {#each processedData as bar}
          {@const barY = tickToY(bar.tick)}
          {@const barWidth = liquidityScale(bar.activeLiquidity)}
          {#if barY >= -BAR_HEIGHT && barY <= CHART_HEIGHT + BAR_HEIGHT}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <rect
              x={contentWidth - barWidth}
              y={barY - BAR_HEIGHT / 2}
              width={barWidth}
              height={BAR_HEIGHT}
              fill={getBarColor(bar.price)}
              opacity={getBarOpacity(bar.price, bar.tick)}
              rx="1"
              class="liquidity-bar"
              onmouseenter={() => hoveredTick = bar.tick}
            />
          {/if}
        {/each}
      </g>

      <!-- Current Price Line -->
      {#if isCurrentPriceVisible}
        <line
          x1="0"
          x2={contentWidth}
          y1={currentPriceY}
          y2={currentPriceY}
          stroke="var(--muted-foreground)"
          stroke-width="1"
          stroke-dasharray="4,4"
          opacity="0.5"
        />
        <circle
          cx={contentWidth - LIQUIDITY_BAR_WIDTH / 2}
          cy={currentPriceY}
          r={PRICE_DOT_RADIUS}
          fill={isInRange(currentPrice) ? 'var(--primary)' : 'var(--muted-foreground)'}
        />
      {/if}

      <!-- Range Indicator Strip -->
      <g class="range-indicator">
        <!-- Background -->
        <rect
          x={contentWidth}
          y="0"
          width={RANGE_INDICATOR_WIDTH}
          height={CHART_HEIGHT}
          fill="var(--muted)"
          rx="4"
        />

        {#if isFullRange}
          <!-- Full range: fill entire indicator strip -->
          <rect
            x={contentWidth}
            y="0"
            width={RANGE_INDICATOR_WIDTH}
            height={CHART_HEIGHT}
            fill="var(--primary)"
            opacity="0.6"
            rx="4"
          />
        {:else}
          <!-- Active Range -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <rect
            x={contentWidth}
            y={rangePositions.topY}
            width={RANGE_INDICATOR_WIDTH}
            height={rangePositions.height}
            fill="var(--primary)"
            rx="8"
            cursor="move"
            onmousedown={(e) => startDrag('range', e)}
          />

          <!-- Max Handle (top) -->
          {#if isMaxHandleVisible}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              cx={contentWidth + RANGE_INDICATOR_WIDTH / 2}
              cy={rangePositions.topY + 8}
              r="6"
              fill="white"
              stroke="rgba(0,0,0,0.15)"
              stroke-width="1"
              class="drag-handle"
              cursor="ns-resize"
              onmousedown={(e) => startDrag('max', e)}
            />
          {/if}

          <!-- Min Handle (bottom) -->
          {#if isMinHandleVisible}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              cx={contentWidth + RANGE_INDICATOR_WIDTH / 2}
              cy={rangePositions.bottomY - 8}
              r="6"
              fill="white"
              stroke="rgba(0,0,0,0.15)"
              stroke-width="1"
              class="drag-handle"
              cursor="ns-resize"
              onmousedown={(e) => startDrag('min', e)}
            />
          {/if}

          <!-- Center Handle -->
          {@const centerY = (rangePositions.topY + rangePositions.bottomY) / 2}
          {#if isMaxHandleVisible && isMinHandleVisible}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <rect
              x={contentWidth + RANGE_INDICATOR_WIDTH / 2 - 6}
              y={centerY - 3}
              width="12"
              height="6"
              fill="white"
              stroke="rgba(0,0,0,0.15)"
              stroke-width="1"
              rx="2"
              class="drag-handle"
              cursor="move"
              onmousedown={(e) => startDrag('range', e)}
            />
            <!-- Grip lines -->
            {#each [-1, 0, 1] as i}
              <line
                x1={contentWidth + RANGE_INDICATOR_WIDTH / 2 + i * 2}
                x2={contentWidth + RANGE_INDICATOR_WIDTH / 2 + i * 2}
                y1={centerY - 1.5}
                y2={centerY + 1.5}
                stroke="rgba(0,0,0,0.3)"
                stroke-width="0.5"
              />
            {/each}
          {/if}
        {/if}
      </g>

      <!-- Price Labels -->
      <g class="price-labels" font-size="10" fill="var(--muted-foreground)">
        {#if isFullRange}
          <!-- Full range labels -->
          <text x="4" y="12" dominant-baseline="auto">
            ∞ {quoteSymbol}
          </text>
          <text x="4" y={CHART_HEIGHT - 4} dominant-baseline="auto">
            0 {quoteSymbol}
          </text>
        {:else}
          <!-- Max price label -->
          {#if isMaxHandleVisible}
            <text x="4" y={rangePositions.topY - 4} dominant-baseline="auto">
              {formatChartPrice(maxPrice)} {quoteSymbol}
            </text>
          {/if}

          <!-- Min price label -->
          {#if isMinHandleVisible}
            <text x="4" y={rangePositions.bottomY + 12} dominant-baseline="auto">
              {formatChartPrice(minPrice)} {quoteSymbol}
            </text>
          {/if}
        {/if}

        <!-- Current price label (always shown when visible) -->
        {#if isCurrentPriceVisible}
          {@const labelY = currentPriceY}
          {@const tooCloseToMax = !isFullRange && Math.abs(labelY - rangePositions.topY) < 20}
          {@const tooCloseToMin = !isFullRange && Math.abs(labelY - rangePositions.bottomY) < 20}
          {@const tooCloseToTop = isFullRange && labelY < 25}
          {@const tooCloseToBottom = isFullRange && labelY > CHART_HEIGHT - 18}
          {#if !tooCloseToMax && !tooCloseToMin && !tooCloseToTop && !tooCloseToBottom}
            <text x="4" y={labelY - 4} dominant-baseline="auto" fill="var(--foreground)">
              {formatChartPrice(currentPrice)}
            </text>
          {/if}
        {/if}
      </g>

      <!-- Hover tooltip -->
      {#if hoveredY !== null && !isDragging}
        {@const hoveredPrice = yToPrice(hoveredY)}
        {#if hoveredPrice > 0 && isFinite(hoveredPrice)}
          <g transform="translate({contentWidth - 70}, {Math.max(12, Math.min(CHART_HEIGHT - 12, hoveredY))})">
            <rect x="0" y="-10" width="65" height="20" fill="var(--card)" stroke="var(--border)" rx="4" />
            <text x="32" y="0" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--foreground)">
              {formatChartPrice(hoveredPrice)}
            </text>
          </g>
        {/if}
      {/if}
    {/if}
  </svg>

  <!-- Zoom Controls -->
  <div class="zoom-controls">
    <button class="zoom-btn" onclick={zoomOut} title="Zoom out" aria-label="Zoom out" disabled={zoomLevel <= ZOOM_MIN}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
        <path d="M8 11h6"/>
      </svg>
    </button>
    <button class="zoom-btn" onclick={resetView} title="Reset view" aria-label="Reset view">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    </button>
    <button class="zoom-btn" onclick={zoomIn} title="Zoom in" aria-label="Zoom in" disabled={zoomLevel >= ZOOM_MAX}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
        <path d="M11 8v6"/>
        <path d="M8 11h6"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .chart-container {
    position: relative;
    width: 100%;
    padding: 12px 0;
    border-top: 1px solid var(--border);
    overflow: hidden;
  }

  .chart-svg {
    display: block;
    touch-action: none;
    cursor: grab;
  }

  .chart-svg:active {
    cursor: grabbing;
  }

  .chart-svg.loading {
    opacity: 0.6;
    cursor: default;
  }

  .liquidity-bar {
    transition: opacity 0.15s ease;
    pointer-events: all;
  }

  .drag-handle {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    transition: transform 0.1s ease;
  }

  .drag-handle:hover {
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
  }

  /* Zoom controls */
  .zoom-controls {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: hidden;
    z-index: 10;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    background: var(--card);
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .zoom-btn:not(:last-child) {
    border-right: 1px solid var(--border);
  }

  .zoom-btn:hover:not(:disabled) {
    background: var(--muted);
    color: var(--foreground);
  }

  .zoom-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @keyframes shimmer {
    0% { opacity: 0.5; }
    50% { opacity: 0.8; }
    100% { opacity: 0.5; }
  }

  .shimmer {
    animation: shimmer 1.5s infinite;
  }
</style>
