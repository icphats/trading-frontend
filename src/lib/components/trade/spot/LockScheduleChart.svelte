<script lang="ts">
  import { scaleLinear, scaleBand } from "d3";
  import {
    formatToken,
    formatCompactUSD,
    fromDecimals,
  } from "$lib/utils/format.utils";
  import Logo from "$lib/components/ui/Logo.svelte";
  import type { LockScheduleEntry } from "declarations/spot/spot.did";

  // ============================================================================
  // Types
  // ============================================================================

  interface Props {
    schedule: LockScheduleEntry[];
    totalLockedBase: bigint;
    totalLockedQuote: bigint;
    totalUnlockedBase: bigint;
    totalUnlockedQuote: bigint;
    lockedCount: bigint;
    totalCount: bigint;
    baseDecimals: number;
    quoteDecimals: number;
    baseSymbol?: string;
    quoteSymbol?: string;
    baseLogo?: string;
    quoteLogo?: string;
  }

  interface MonthBucket {
    key: string; // "YYYY-MM"
    label: string; // "Mar '26"
    amountBase: bigint;
    amountQuote: bigint;
    baseUsd: number;
    quoteUsd: number;
    usdValue: number;
    positionCount: number;
  }

  let {
    schedule,
    totalLockedBase,
    totalLockedQuote,
    totalUnlockedBase,
    totalUnlockedQuote,
    lockedCount,
    totalCount,
    baseDecimals,
    quoteDecimals,
    baseSymbol = "Base",
    quoteSymbol = "Quote",
    baseLogo,
    quoteLogo,
  }: Props = $props();

  // ============================================================================
  // Constants
  // ============================================================================

  const CHART_PADDING = { top: 8, right: 12, bottom: 28, left: 12 };
  const BAR_GAP = 4;

  const COLORS = {
    base: "var(--color-bearish)",
    quote: "var(--color-bullish)",
    text: "var(--muted-foreground)",
    grid: "var(--border)",
  };

  const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // ============================================================================
  // State
  // ============================================================================

  let chartWidth = $state(300);
  let chartHeight = $state(200);
  let wrapperRef: HTMLDivElement | null = $state(null);

  let hoveredBucket: MonthBucket | null = $state(null);
  let mouseX = $state(0);
  let mouseY = $state(0);

  // ============================================================================
  // Derived Values
  // ============================================================================

  const contentWidth = $derived(
    chartWidth - CHART_PADDING.left - CHART_PADDING.right
  );
  const contentHeight = $derived(
    chartHeight - CHART_PADDING.top - CHART_PADDING.bottom
  );

  /** Group schedule entries by month */
  const monthBuckets = $derived.by((): MonthBucket[] => {
    if (!schedule || schedule.length === 0) return [];

    const map = new Map<string, MonthBucket>();

    for (const entry of schedule) {
      const ms = Number(entry.locked_until_ms);
      const date = new Date(ms);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const label = `${MONTH_LABELS[month]} '${String(year).slice(2)}`;

      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          label,
          amountBase: 0n,
          amountQuote: 0n,
          baseUsd: 0,
          quoteUsd: 0,
          usdValue: 0,
          positionCount: 0,
        };
        map.set(key, bucket);
      }

      bucket.amountBase += entry.amount_base;
      bucket.amountQuote += entry.amount_quote;
      bucket.baseUsd += fromDecimals(entry.base_usd_e6, 6);
      bucket.quoteUsd += fromDecimals(entry.quote_usd_e6, 6);
      bucket.usdValue += fromDecimals(entry.base_usd_e6 + entry.quote_usd_e6, 6);
      bucket.positionCount += 1;
    }

    // Sort by key (chronological)
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  });

  /** Maximum USD value across all buckets (for bar height scaling) */
  const maxUsdValue = $derived.by(() => {
    if (monthBuckets.length === 0) return 1;
    return (
      monthBuckets.reduce(
        (max, b) => (b.usdValue > max ? b.usdValue : max),
        0
      ) || 1
    );
  });

  /** Y scale: USD value to bar height */
  const yScale = $derived.by(() => {
    return scaleLinear().domain([0, maxUsdValue]).range([0, contentHeight]);
  });

  /** X scale: band scale for month buckets */
  const xScale = $derived.by(() => {
    return scaleBand()
      .domain(monthBuckets.map((b) => b.key))
      .range([0, contentWidth])
      .padding(0.15);
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function handleMouseMove(event: MouseEvent) {
    if (!wrapperRef || monthBuckets.length === 0) return;
    const rect = wrapperRef.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;

    // Determine which bar is hovered based on x position
    const contentX = mouseX - CHART_PADDING.left;
    const bandwidth = xScale.bandwidth();
    const step = xScale.step();

    let found: MonthBucket | null = null;
    for (const bucket of monthBuckets) {
      const x = xScale(bucket.key) ?? 0;
      if (contentX >= x && contentX <= x + bandwidth) {
        found = bucket;
        break;
      }
    }
    hoveredBucket = found;
  }

  function handleMouseLeave() {
    hoveredBucket = null;
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
</script>

<div class="lock-schedule-container">
  {#if monthBuckets.length === 0}
    <div class="empty-state">
      <span>No active locks</span>
    </div>
  {:else}
    <!-- Chart wrapper for ResizeObserver -->
    <div class="chart-wrapper" bind:this={wrapperRef}>
      <!-- Transparent overlay for mouse events -->
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
          <!-- Bars -->
          {#each monthBuckets as bucket}
            {@const barX = xScale(bucket.key) ?? 0}
            {@const barW = xScale.bandwidth()}
            {@const totalH = yScale(bucket.usdValue)}
            {@const barY = contentHeight - totalH}
            {@const isHovered = hoveredBucket?.key === bucket.key}

            <!-- Stacked bar: base (bottom) + quote (top), split by USD value -->
            {#if bucket.baseUsd > 0 && bucket.quoteUsd > 0}
              {@const baseRatio = bucket.baseUsd / (bucket.baseUsd + bucket.quoteUsd || 1)}
              {@const baseH = totalH * baseRatio}
              {@const quoteH = totalH * (1 - baseRatio)}

              <!-- Clip to rounded outer shape -->
              <clipPath id="lock-clip-{bucket.key}">
                <rect x={barX} y={barY} width={barW} height={Math.max(1, totalH)} rx="3" />
              </clipPath>
              <g clip-path="url(#lock-clip-{bucket.key})">
                <!-- Base portion (bottom) -->
                <rect
                  x={barX}
                  y={contentHeight - baseH}
                  width={barW}
                  height={Math.max(1, baseH)}
                  fill={COLORS.base}
                  opacity={hoveredBucket ? (isHovered ? 1 : 0.4) : 0.7}
                />
                <!-- Quote portion (top) -->
                <rect
                  x={barX}
                  y={contentHeight - totalH}
                  width={barW}
                  height={Math.max(1, quoteH)}
                  fill={COLORS.quote}
                  opacity={hoveredBucket ? (isHovered ? 1 : 0.4) : 0.7}
                />
              </g>
            {:else}
              <!-- Single token bar -->
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={Math.max(1, totalH)}
                fill={bucket.amountBase > 0n ? COLORS.base : COLORS.quote}
                opacity={hoveredBucket ? (isHovered ? 1 : 0.4) : 0.7}
                rx="3"
              />
            {/if}

          {/each}

          <!-- X axis: month labels -->
          {#each monthBuckets as bucket}
            {@const barX = xScale(bucket.key) ?? 0}
            {@const barW = xScale.bandwidth()}
            <text
              x={barX + barW / 2}
              y={contentHeight + 16}
              text-anchor="middle"
              font-size="10"
              fill={COLORS.text}
              class="axis-label"
            >
              {bucket.label}
            </text>
          {/each}

          <!-- Bottom axis line -->
          <line
            x1="0"
            x2={contentWidth}
            y1={contentHeight}
            y2={contentHeight}
            stroke={COLORS.grid}
            stroke-opacity="0.5"
          />
        </g>
      </svg>

      <!-- Tooltip -->
      {#if hoveredBucket}
        {@const isLeftHalf = mouseX < chartWidth / 2}
        {@const isTopHalf = mouseY < chartHeight / 2}
        <div
          class="tooltip"
          class:tooltip-below={isTopHalf}
          style="left: {mouseX + 16}px; top: {mouseY + (isTopHalf ? 8 : -8)}px;"
        >
          <div class="tooltip-header">{hoveredBucket.label}</div>
          {#if hoveredBucket.amountBase > 0n}
            <div class="tooltip-row">
              <div class="tooltip-token">
                <Logo src={baseLogo} alt={baseSymbol} size="xxs" circle={true} />
                <span class="tooltip-symbol">{baseSymbol}</span>
              </div>
              <div class="tooltip-values">
                <span class="tooltip-amount">
                  {formatToken({ value: hoveredBucket.amountBase, unitName: baseDecimals, short: true })}
                </span>
              </div>
            </div>
          {/if}
          {#if hoveredBucket.amountQuote > 0n}
            <div class="tooltip-row">
              <div class="tooltip-token">
                <Logo src={quoteLogo} alt={quoteSymbol} size="xxs" circle={true} />
                <span class="tooltip-symbol">{quoteSymbol}</span>
              </div>
              <div class="tooltip-values">
                <span class="tooltip-amount">
                  {formatToken({ value: hoveredBucket.amountQuote, unitName: quoteDecimals, short: true })}
                </span>
              </div>
            </div>
          {/if}
          <div class="tooltip-footer">
            <span class="tooltip-usd">{formatCompactUSD(hoveredBucket.usdValue)}</span>
            <span class="tooltip-count">{hoveredBucket.positionCount} position{hoveredBucket.positionCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Totals footer -->
    <div class="totals-footer">
      <div class="total-item">
        <Logo src={baseLogo} alt="" size="xxs" circle={true} />
        <span class="total-amount">
          {formatToken({ value: totalLockedBase, unitName: baseDecimals, short: true })}
        </span>
        <span class="total-usd">({Number(lockedCount)} locked)</span>
      </div>
      <div class="total-item">
        <Logo src={quoteLogo} alt="" size="xxs" circle={true} />
        <span class="total-amount">
          {formatToken({ value: totalLockedQuote, unitName: quoteDecimals, short: true })}
        </span>
        <span class="total-usd">({Number(lockedCount)} locked)</span>
      </div>
    </div>
    {#if totalUnlockedBase > 0n || totalUnlockedQuote > 0n}
      <div class="totals-footer unlocked-footer">
        {#if totalUnlockedBase > 0n}
          <div class="total-item">
            <Logo src={baseLogo} alt="" size="xxs" circle={true} />
            <span class="total-amount">
              {formatToken({ value: totalUnlockedBase, unitName: baseDecimals, short: true })}
            </span>
            <span class="total-usd">({Number(totalCount - lockedCount)} unlocked)</span>
          </div>
        {/if}
        {#if totalUnlockedQuote > 0n}
          <div class="total-item">
            <Logo src={quoteLogo} alt="" size="xxs" circle={true} />
            <span class="total-amount">
              {formatToken({ value: totalUnlockedQuote, unitName: quoteDecimals, short: true })}
            </span>
            <span class="total-usd">({Number(totalCount - lockedCount)} unlocked)</span>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .lock-schedule-container {
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

  .bar-label {
    font-family: var(--font-numeric, monospace);
    font-size: 9px;
    pointer-events: none;
  }

  .axis-label {
    font-family: var(--font-sans);
    font-size: 10px;
    pointer-events: none;
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

  .unlocked-footer {
    border-top: 1px dashed var(--border);
    opacity: 0.7;
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

  .tooltip-below {
    transform: translateY(0);
  }

  .tooltip-header {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    color: var(--foreground);
    padding-bottom: 2px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2px;
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

  .tooltip-amount {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
  }

  .tooltip-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 2px;
    border-top: 1px solid var(--border);
    margin-top: 2px;
  }

  .tooltip-usd {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
  }

  .tooltip-count {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    font-size: 12px;
  }
</style>
