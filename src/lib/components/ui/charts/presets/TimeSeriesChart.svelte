<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { createChart, HistogramSeries } from 'lightweight-charts';
  import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

  import ChartToggle from '../primitives/ChartToggle.svelte';
  import ChartContainer from '../primitives/ChartContainer.svelte';

  import {
    type TimeInterval,
    EXPLORE_INTERVAL_CONFIG,
  } from '../core/chart.constants';
  import { getCurrentThemeColors, hexWithAlpha } from '../core/chart.colors';
  import { formatChange, getChangeClass } from '../core/chart.format';

  // Data point interface for time series data
  export interface DataPoint {
    timestamp: number;  // Unix seconds (converted from ms at source)
    value: number;
  }

  import type { Snippet } from 'svelte';

  interface Props {
    // Data fetching - returns array of { timestamp: number, value: number }
    fetchData: (interval: TimeInterval) => Promise<DataPoint[]>;

    // Display
    title?: string;
    valuePrefix?: string;  // e.g., "$" for USD, "" for cycles
    valueSuffix?: string;  // e.g., " ICP", " cycles"

    // Optional formatting
    formatValue?: (value: number) => string;

    // Optional tooltip on bar hover (e.g., fees overlay on volume bars)
    getTooltip?: (timestamp: number) => { label: string; value: string } | null;

    // Optional right-side controls (rendered next to time interval toggle)
    rightControls?: Snippet;
  }

  let {
    fetchData,
    title = '',
    valuePrefix = '',
    valueSuffix = '',
    formatValue,
    getTooltip,
    rightControls,
  }: Props = $props();

  // UI State
  let selectedInterval = $state<TimeInterval>('1D');

  // Chart state
  let chartContainer: HTMLElement | null = $state(null);
  let chart: IChartApi | null = $state(null);
  let histogramSeries: ISeriesApi<'Histogram'> | null = $state(null);

  // Data state
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let data = $state<DataPoint[]>([]);

  // Hover state
  let hoverValue = $state<number | null>(null);
  let hoverChange = $state<number | null>(null);
  let hoveredTime = $state<number | null>(null);

  // Hover beam position (synced to actual bar position from chart)
  let hoverBeamX = $state<number | null>(null);
  let hoverBeamWidth = $state<number>(20);
  let hoverBeamBottom = $state<number>(30);

  // Tooltip state (shown on bar hover when getTooltip is provided)
  let hoveredTooltip = $state<{ label: string; value: string } | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let chartWrapperEl: HTMLElement | null = $state(null);

  function handleChartMouseMove(e: MouseEvent) {
    if (!chartWrapperEl) return;
    const rect = chartWrapperEl.getBoundingClientRect();
    tooltipX = e.clientX - rect.left;
    tooltipY = e.clientY - rect.top;
  }

  // Default value formatter
  function defaultFormatValue(value: number): string {
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toFixed(2);
  }

  // Use provided formatter or default
  const valueFormatter = $derived(formatValue ?? defaultFormatValue);

  // Format display value with prefix/suffix
  function formatDisplayValue(value: number): string {
    return `${valuePrefix}${valueFormatter(value)}${valueSuffix}`;
  }

  // Helper to get bar color based on hover state
  function getBarColor(time: number, baseColor: string): string {
    if (hoveredTime === null) return baseColor;
    const cleanHex = baseColor.replace('#', '').slice(0, 6);
    if (time === hoveredTime) {
      return `#${cleanHex}`;
    }
    return hexWithAlpha(`#${cleanHex}`, 102);
  }

  // Transform data for histogram display
  const chartData = $derived.by(() => {
    const colors = getCurrentThemeColors();
    return data.map((d) => ({
      time: d.timestamp as UTCTimestamp,
      value: d.value,
      color: getBarColor(d.timestamp, colors.primary),
    }));
  });

  // Calculated values from data
  const calculatedValue = $derived.by(() => {
    if (chartData.length === 0) return 0;
    return chartData[chartData.length - 1]?.value ?? 0;
  });

  const calculatedChange = $derived.by(() => {
    if (chartData.length < 2) return 0;
    const first = chartData[0]?.value ?? 0;
    const last = chartData[chartData.length - 1]?.value ?? 0;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  });

  // Display values (hover or current)
  const displayValue = $derived(hoverValue ?? calculatedValue);
  const displayChange = $derived(hoverChange ?? calculatedChange);
  const changeClass = $derived(getChangeClass(displayChange));

  // Fetch chart data
  async function loadChartData() {
    isLoading = true;
    error = null;

    try {
      const result = await fetchData(selectedInterval);
      data = result;
    } catch (err) {
      console.error('[TimeSeriesChart] Failed to fetch data:', err);
      error = 'Failed to load chart';
      data = [];
    } finally {
      isLoading = false;
    }
  }

  // Get time scale formatter based on interval
  function getTickMarkFormatter(interval: TimeInterval) {
    return (time: number) => {
      const date = new Date(time * 1000);
      if (interval === '1D' || interval === '1W') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    };
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
        scaleMargins: { top: 0.25, bottom: 0.05 },
      },
      timeScale: {
        visible: true,
        borderVisible: false,
        ticksVisible: false,
        timeVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        minBarSpacing: 6,
        tickMarkFormatter: getTickMarkFormatter(selectedInterval),
      },
      crosshair: {
        vertLine: {
          visible: false,
          labelVisible: false,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      handleScale: false,
      handleScroll: false,
    } as any);

    // Histogram series for bar display
    histogramSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false,
    } as any);

    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.25, bottom: 0 },
    });

    // Crosshair hover subscription
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        hoverValue = null;
        hoverChange = null;
        hoveredTime = null;
        hoverBeamX = null;
        hoveredTooltip = null;
        return;
      }

      const newHoveredTime = param.time as number;
      if (hoveredTime !== newHoveredTime) {
        hoveredTime = newHoveredTime;
      }

      const timeScale = chart!.timeScale();
      const barX = timeScale.timeToCoordinate(param.time);
      if (barX !== null) {
        hoverBeamX = barX;
        const barSpacing = (timeScale.options() as any).barSpacing ?? 6;
        hoverBeamWidth = Math.max(8, barSpacing);
        hoverBeamBottom = timeScale.height();
      }

      if (histogramSeries) {
        const seriesData = param.seriesData.get(histogramSeries);
        if (seriesData && 'value' in seriesData) {
          const value = seriesData.value as number;
          hoverValue = value;
          const firstValue = chartData[0]?.value;
          hoverChange = firstValue && firstValue > 0 ? ((value - firstValue) / firstValue) * 100 : 0;
        }
      }

      // Call getTooltip if provided
      if (getTooltip) {
        hoveredTooltip = getTooltip(param.time as number);
      }
    });

    updateChartDisplay();
  }

  // Update chart display
  function updateChartDisplay() {
    if (!chart || !histogramSeries) return;

    if (chartData.length > 0) {
      histogramSeries.setData(chartData as any);
    }

    chart.timeScale().fitContent();
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

  // Fetch data when interval changes
  $effect(() => {
    selectedInterval;
    untrack(() => {
      loadChartData();
    });
  });

  // Update chart when data changes
  $effect(() => {
    data;
    hoveredTime;
    if (chart) {
      updateChartDisplay();
    }
  });

  // Update time scale formatter when interval changes
  $effect(() => {
    const interval = selectedInterval;
    if (chart) {
      chart.timeScale().applyOptions({
        tickMarkFormatter: getTickMarkFormatter(interval),
      } as any);
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
</script>

<div class="time-series-chart">
  <div class="chart-wrapper" bind:this={chartWrapperEl} onmousemove={handleChartMouseMove}>
    <!-- Value Overlay -->
    <div class="value-overlay">
      {#if title}
        <div class="chart-title">{title}</div>
      {/if}
      <div class="value-display">{formatDisplayValue(displayValue)}</div>
      <span class="value-change {changeClass}">
        {formatChange(displayChange)}
      </span>
    </div>

    <ChartContainer
      {isLoading}
      {error}
      isEmpty={!isLoading && !error && data.length === 0}
      height="356px"
    >
      <div class="chart-area" bind:this={chartContainer}>
        {#if hoverBeamX !== null}
          <div
            class="hover-beam"
            style="left: {hoverBeamX}px; width: {hoverBeamWidth}px; bottom: {hoverBeamBottom}px;"
          ></div>
        {/if}
      </div>
    </ChartContainer>

    <!-- Tooltip (shown on bar hover when getTooltip is provided) -->
    {#if hoveredTooltip !== null}
      <div class="fees-tooltip" style="left: {tooltipX + 16}px; top: {tooltipY - 16}px;">
        <span class="fees-tooltip-label">{hoveredTooltip.label}</span>
        <span class="fees-tooltip-value">{hoveredTooltip.value}</span>
      </div>
    {/if}
  </div>

  <div class="chart-controls">
    <ChartToggle
      options={Object.keys(EXPLORE_INTERVAL_CONFIG).map((interval) => ({
        value: interval,
        label: interval,
      }))}
      bind:value={selectedInterval}
      ariaLabel="Time interval"
    />

    {#if rightControls}
      <div class="controls-right">
        {@render rightControls()}
      </div>
    {/if}
  </div>
</div>

<style>
  .time-series-chart {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background);
    border-radius: 16px;
  }

  .chart-wrapper {
    position: relative;
    width: 100%;
  }

  .value-overlay {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
  }

  .chart-title {
    font-family: 'Basel', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .value-display {
    font-family: 'Basel', sans-serif;
    font-size: 36px;
    line-height: 44px;
    font-weight: 500;
    color: var(--foreground);
  }

  .value-change {
    font-family: 'Basel', sans-serif;
    font-size: 17px;
    line-height: 22px;
    font-weight: 485;
    padding: 4px 8px;
    border-radius: 8px;
    width: fit-content;
  }

  .value-change.positive {
    color: var(--color-bullish, #22c55e);
    background: rgba(34, 197, 94, 0.12);
  }

  .value-change.negative {
    color: var(--color-bearish, #ef4444);
    background: rgba(239, 68, 68, 0.12);
  }

  .value-change.neutral {
    color: var(--muted-foreground);
    background: var(--muted);
  }

  .chart-area {
    width: 100%;
    height: 356px;
    position: relative;
    background-image: radial-gradient(circle, oklch(from var(--muted-foreground) l c h / 0.2) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: 0 0;
  }

  .hover-beam {
    position: absolute;
    top: 10%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    pointer-events: none;
    z-index: 1;
  }

  /* Fees tooltip - follows cursor on volume bars */
  .fees-tooltip {
    position: absolute;
    z-index: 100;
    background: var(--popover);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 8px 12px;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-100%);
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  .fees-tooltip-label {
    font-family: 'Basel', sans-serif;
    font-size: 13px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  .fees-tooltip-value {
    font-family: 'Basel', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
  }

  .chart-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    gap: 8px;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  @media (max-width: 768px) {
    .value-display {
      font-size: 28px;
      line-height: 36px;
    }
  }
</style>
