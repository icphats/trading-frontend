<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { createChart, AreaSeries, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
  import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

  import ChartToggle from '../primitives/ChartToggle.svelte';
  import ChartContainer from '../primitives/ChartContainer.svelte';
  import PriceOverlay from '../primitives/PriceOverlay.svelte';
  import LiquidityExploreChart from './LiquidityExploreChart.svelte';

  import {
    type TimeInterval,
    type DataType,
    type RawCandle,
    EXPLORE_INTERVAL_CONFIG,
    DEFAULT_PRICE_FORMAT,
  } from '../core/chart.constants';
  import { getExploreChartColors, getCurrentThemeColors, hexWithAlpha } from '../core/chart.colors';
  import { transformExploreCandles, transformPoolCandles, calculatePriceChange, getLatestPrice } from '../core/chart.data';
  import { formatVolume } from '../core/chart.format';

  import type { PoolDepthRow } from '$lib/components/trade/shared/orderbook.utils';

  type ChartType = 'line' | 'candle';
  type DisplayMode = 'token' | 'pool';

  // Pool snapshot data point (enriched: fees, volume, TVL per bar)
  export interface FeeDataPoint {
    timestamp: number;  // Unix seconds (converted from ms at source)
    fees: number;       // Fees in USD (already divided by 1e6)
    volume: number;     // Volume in USD (already divided by 1e6)
    tvl: number;        // TVL in USD (already divided by 1e6)
  }

  // TVL data point for market TVL charts
  export interface TvlDataPoint {
    timestamp: number;  // Unix seconds (converted from ms at source)
    tvl: number;        // TVL in USD (already divided by 1e6)
  }

  interface Props {
    // Data fetching
    fetchData: (interval: TimeInterval) => Promise<RawCandle[]>;

    // Fees data fetching (for pool mode)
    fetchFeesData?: (interval: TimeInterval) => Promise<FeeDataPoint[]>;

    // TVL data fetching (for token mode)
    fetchTvlData?: (interval: TimeInterval) => Promise<TvlDataPoint[]>;

    // Display mode
    mode?: DisplayMode;

    // For pool mode - token symbols
    token0Symbol?: string;
    token1Symbol?: string;

    // For pool mode - price inversion
    isReversed?: boolean;

    // External price (optional, overrides calculated)
    currentPrice?: number;
    priceChange?: number;

    // Token decimals for volume scaling (default 8 for ICP)
    baseTokenDecimals?: number;

    // Pool liquidity chart data (for pool mode with liquidity view)
    poolDepthData?: PoolDepthRow[];
    isLoadingDepth?: boolean;
    token0Decimals?: number;
    token1Decimals?: number;
    token0Logo?: string;
    token1Logo?: string;
    token0PriceUsd?: bigint | null;
    token1PriceUsd?: bigint | null;
  }

  let {
    fetchData,
    fetchFeesData,
    fetchTvlData,
    mode = 'token',
    token0Symbol = '',
    token1Symbol = '',
    isReversed = false,
    currentPrice,
    priceChange,
    baseTokenDecimals = 8,
    poolDepthData = [],
    isLoadingDepth = false,
    token0Decimals = 8,
    token1Decimals = 8,
    token0Logo,
    token1Logo,
    token0PriceUsd = null,
    token1PriceUsd = null,
  }: Props = $props();

  // UI State
  let selectedInterval = $state<TimeInterval>('1D');
  let chartType = $state<ChartType>('line');
  // Default to 'price' for token mode, 'fees' (Volume) for pool mode
  let dataType = $state<DataType>(mode === 'pool' ? 'fees' : 'price');

  // Data type dropdown options - different for token vs pool mode
  // Token mode: Price, Volume, TVL (TVL enabled when fetchTvlData is provided)
  // Pool mode: Liquidity, Fees (pool-specific data)
  const tokenDataTypeOptions = $derived<{ value: DataType; label: string; disabled?: boolean }[]>([
    { value: 'price', label: 'Price' },
    // Use 'fees' dataType (snapshot-based volume with fees overlay) when fetchFeesData is available
    // Falls back to 'volume' (candle-derived) when only candle data is available
    fetchFeesData
      ? { value: 'fees', label: 'Volume' }
      : { value: 'volume', label: 'Volume' },
    { value: 'tvl', label: 'TVL', disabled: !fetchTvlData && !fetchFeesData },
  ]);

  const POOL_DATA_TYPE_OPTIONS: { value: DataType; label: string; disabled?: boolean }[] = [
    { value: 'fees', label: 'Volume' },
    { value: 'tvl', label: 'TVL' },
    { value: 'liquidity', label: 'Liquidity' },
  ];

  // Select options based on mode
  const dataTypeOptions = $derived(mode === 'pool' ? POOL_DATA_TYPE_OPTIONS : tokenDataTypeOptions);

  // Whether to show the LiquidityExploreChart instead of lightweight-charts
  const showLiquidityChart = $derived(mode === 'pool' && dataType === 'liquidity');

  // Chart state
  let chartContainer: HTMLElement | null = $state(null);
  let chart: IChartApi | null = $state(null);
  let areaSeries: ISeriesApi<'Area'> | null = $state(null);
  let candlestickSeries: ISeriesApi<'Candlestick'> | null = $state(null);
  let volumeSeries: ISeriesApi<'Histogram'> | null = $state(null);

  // Data state
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let rawCandles = $state<RawCandle[]>([]);
  let feesData = $state<FeeDataPoint[]>([]);
  let tvlData = $state<TvlDataPoint[]>([]);

  // Hover state
  let hoverPrice = $state<number | null>(null);
  let hoverChange = $state<number | null>(null);
  let hoveredTime = $state<number | null>(null);

  // Hover beam position (synced to actual bar position from chart)
  let hoverBeamX = $state<number | null>(null);
  let hoverBeamWidth = $state<number>(20);
  let hoverBeamBottom = $state<number>(30); // Bottom offset to avoid time scale

  // Fees tooltip state (shown on volume bar hover)
  let hoveredFees = $state<number | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let chartWrapperEl: HTMLElement | null = $state(null);

  function handleChartMouseMove(e: MouseEvent) {
    if (!chartWrapperEl) return;
    const rect = chartWrapperEl.getBoundingClientRect();
    tooltipX = e.clientX - rect.left;
    tooltipY = e.clientY - rect.top;
  }

  // Derived token display (for pool mode)
  const displayToken0 = $derived(isReversed ? token1Symbol : token0Symbol);
  const displayToken1 = $derived(isReversed ? token0Symbol : token1Symbol);

  // Transform data based on mode
  const chartData = $derived.by(() => {
    const colors = getCurrentThemeColors();
    if (mode === 'pool') {
      return transformPoolCandles(rawCandles, colors, isReversed, baseTokenDecimals);
    }
    return transformExploreCandles(rawCandles, colors, baseTokenDecimals);
  });

  // Helper to get bar color based on hover state
  // When hovering: hovered bar is bright, others are dimmed (0.4x opacity like LiquidityDensityChart)
  // When not hovering: all bars at normal opacity
  function getBarColor(time: number, baseColor: string): string {
    if (hoveredTime === null) return baseColor;
    // Extract base hex color (strip any existing alpha)
    const cleanHex = baseColor.replace('#', '').slice(0, 6);
    if (time === hoveredTime) {
      // Hovered bar: full opacity
      return `#${cleanHex}`;
    }
    // Dim non-hovered bars (0.4x base opacity = ~40% of 255 = 102)
    return hexWithAlpha(`#${cleanHex}`, 102);
  }

  // Transform pool snapshot data for histogram display (bars show volume)
  const feesChartData = $derived.by(() => {
    const colors = getCurrentThemeColors();
    return feesData.map((d) => ({
      time: d.timestamp as UTCTimestamp,
      value: d.volume,
      color: getBarColor(d.timestamp, colors.primary),
    }));
  });

  // Transform TVL data for histogram display (token mode - from fetchTvlData)
  const tvlChartData = $derived.by(() => {
    const colors = getCurrentThemeColors();
    return tvlData.map((d) => ({
      time: d.timestamp as UTCTimestamp,
      value: d.tvl,
      color: getBarColor(d.timestamp, colors.primary),
    }));
  });

  // Transform pool TVL data for histogram display (pool mode - from fetchFeesData snapshots)
  const poolTvlChartData = $derived.by(() => {
    const colors = getCurrentThemeColors();
    return feesData.map((d) => ({
      time: d.timestamp as UTCTimestamp,
      value: d.tvl,
      color: getBarColor(d.timestamp, colors.primary),
    }));
  });

  // Transform volume data with hover styling
  const volumeChartData = $derived.by(() => {
    const colors = getCurrentThemeColors();
    return chartData.volumeData.map((d) => ({
      ...d,
      color: getBarColor(d.time as number, d.color ?? colors.primary),
    }));
  });

  // Calculated values from data (price for token mode, fees for pool mode, TVL for token mode)
  const calculatedPrice = $derived.by(() => {
    if (dataType === 'fees' && feesData.length > 0) {
      return feesData[feesData.length - 1]?.volume ?? 0;
    }
    if (dataType === 'tvl' && feesData.length > 0) {
      return feesData[feesData.length - 1]?.tvl ?? 0;
    }
    if (dataType === 'tvl' && tvlChartData.length > 0) {
      return tvlChartData[tvlChartData.length - 1]?.value ?? 0;
    }
    return getLatestPrice(chartData.lineData);
  });
  const calculatedChange = $derived.by(() => {
    if (dataType === 'fees' && feesData.length > 0) {
      const first = feesData[0]?.volume ?? 0;
      const last = feesData[feesData.length - 1]?.volume ?? 0;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
    if (dataType === 'tvl' && feesData.length > 0) {
      const first = feesData[0]?.tvl ?? 0;
      const last = feesData[feesData.length - 1]?.tvl ?? 0;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
    if (dataType === 'tvl' && tvlChartData.length > 0) {
      const first = tvlChartData[0]?.value ?? 0;
      const last = tvlChartData[tvlChartData.length - 1]?.value ?? 0;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
    return calculatePriceChange(chartData.lineData);
  });

  // Display values (hover or current)
  const displayPrice = $derived(hoverPrice ?? currentPrice ?? calculatedPrice);
  const displayChange = $derived(hoverChange ?? priceChange ?? calculatedChange);

  // Price overlay mode
  // Maps data types to display formats:
  // - price: USD price format
  // - volume/liquidity/fees/tvl: volume format (large numbers)
  // - pool mode with price data: ratio format (token0/token1)
  const overlayMode = $derived.by(() => {
    if (dataType === 'volume' || dataType === 'liquidity' || dataType === 'fees' || dataType === 'tvl') {
      return 'volume' as const;
    }
    if (mode === 'pool') return 'ratio' as const;
    return 'price' as const;
  });

  // Fetch chart data (candles, fees, or TVL depending on dataType)
  async function loadChartData() {
    // Liquidity chart uses poolDepthData prop, not fetched data - skip
    if (dataType === 'liquidity') {
      return;
    }

    isLoading = true;
    error = null;

    try {
      if ((dataType === 'fees' || (dataType === 'tvl' && fetchFeesData)) && fetchFeesData) {
        // Pool mode: fetch snapshot data (has volume, fees, TVL)
        const fees = await fetchFeesData(selectedInterval);
        feesData = fees;
        rawCandles = [];
        tvlData = [];
      } else if (dataType === 'tvl' && fetchTvlData) {
        // Token mode: fetch TVL data
        const tvl = await fetchTvlData(selectedInterval);
        tvlData = tvl;
        rawCandles = [];
        feesData = [];
      } else {
        // Fetch OHLCV candle data (price/volume)
        const candles = await fetchData(selectedInterval);
        rawCandles = candles;
        feesData = []; // Clear fees data when showing other types
        tvlData = [];  // Clear TVL data
      }
    } catch (err) {
      console.error('[ExploreChart] Failed to fetch data:', err);
      error = 'Failed to load chart';
      rawCandles = [];
      feesData = [];
      tvlData = [];
    } finally {
      isLoading = false;
    }
  }

  // Get colors based on direction
  function getColors() {
    return getExploreChartColors(displayChange >= 0);
  }

  // Get time scale formatter based on interval
  // 1D/1W: Show time (hours)
  // 1M/1Y: Show date (day/month)
  function getTickMarkFormatter(interval: TimeInterval) {
    return (time: number) => {
      const date = new Date(time * 1000);
      if (interval === '1D' || interval === '1W') {
        // Show time: "14:00"
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else {
        // Show date: "Jan 15"
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    };
  }

  // Initialize chart
  function initializeChart() {
    if (!chartContainer || chart) return;

    const colors = getColors();

    chart = createChart(chartContainer, {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
      layout: {
        background: { type: 'solid', color: colors.background },
        textColor: colors.textColor,
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
        timeVisible: false, // We use custom tickMarkFormatter instead
        fixLeftEdge: true,
        fixRightEdge: true,
        minBarSpacing: 6, // Prevents bars from becoming too wide with sparse data
        tickMarkFormatter: getTickMarkFormatter(selectedInterval),
      },
      crosshair: {
        vertLine: {
          visible: false, // Hidden - using custom hover beam instead
          labelVisible: false,
        },
        horzLine: {
          visible: false, // Hidden for cleaner look
          labelVisible: false,
        },
      },
      handleScale: false,
      handleScroll: false,
    } as any);

    // Area series
    areaSeries = chart.addSeries(AreaSeries, {
      lineColor: colors.lineColor,
      topColor: colors.areaTopColor,
      bottomColor: colors.areaBottomColor,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: colors.lineColor,
      crosshairMarkerBorderColor: '#fff',
      crosshairMarkerBorderWidth: 2,
      priceFormat: DEFAULT_PRICE_FORMAT,
    } as any);

    // Candlestick series
    candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.bullish,
      downColor: colors.bearish,
      borderUpColor: colors.bullish,
      borderDownColor: colors.bearish,
      wickUpColor: colors.bullish,
      wickDownColor: colors.bearish,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: DEFAULT_PRICE_FORMAT,
    } as any);

    // Volume series
    volumeSeries = chart.addSeries(HistogramSeries, {
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
        hoverPrice = null;
        hoverChange = null;
        hoveredTime = null;
        hoverBeamX = null;
        hoveredFees = null;
        return;
      }

      // Track hovered time for bar highlighting
      const newHoveredTime = param.time as number;
      if (hoveredTime !== newHoveredTime) {
        hoveredTime = newHoveredTime;
      }

      // Get actual bar position from chart's time scale (not cursor position)
      const timeScale = chart!.timeScale();
      const barX = timeScale.timeToCoordinate(param.time);
      if (barX !== null) {
        hoverBeamX = barX;

        // Get actual bar width from chart's barSpacing option
        const barSpacing = (timeScale.options() as any).barSpacing ?? 6;
        hoverBeamWidth = Math.max(8, barSpacing);

        // Get time scale height to position beam above it
        hoverBeamBottom = timeScale.height();
      }

      let value: number | null = null;
      const isVolumeType = dataType === 'volume' || dataType === 'liquidity' || dataType === 'fees' || dataType === 'tvl';

      if (dataType === 'price') {
        if (chartType === 'line' && areaSeries) {
          const data = param.seriesData.get(areaSeries);
          if (data && 'value' in data) value = data.value as number;
        } else if (chartType === 'candle' && candlestickSeries) {
          const data = param.seriesData.get(candlestickSeries);
          if (data && 'close' in data) value = data.close as number;
        }
      } else if (isVolumeType && volumeSeries) {
        const data = param.seriesData.get(volumeSeries);
        if (data && 'value' in data) {
          if (dataType === 'fees') {
            // Bars and overlay both show volume; tooltip shows fees
            const point = feesData.find((d) => d.timestamp === (param.time as number));
            value = point?.volume ?? data.value as number;
            hoveredFees = point?.fees ?? null;
          } else {
            hoveredFees = null;
            value = data.value as number;
          }
        }
      }

      if (value !== null) {
        hoverPrice = value;
        // Get first value for calculating change percentage
        let firstValue: number | undefined;
        if (dataType === 'fees') {
          firstValue = feesData[0]?.volume;
        } else if (dataType === 'tvl' && feesData.length > 0) {
          firstValue = feesData[0]?.tvl;
        } else if (dataType === 'tvl') {
          firstValue = tvlChartData[0]?.value;
        } else if (isVolumeType) {
          firstValue = chartData.volumeData[0]?.value;
        } else {
          firstValue = chartData.lineData[0]?.value;
        }
        hoverChange = firstValue && firstValue > 0 ? ((value - firstValue) / firstValue) * 100 : 0;
      }
    });

    updateChartDisplay();
  }

  // Update chart display
  function updateChartDisplay() {
    if (!chart || !areaSeries || !candlestickSeries || !volumeSeries) return;

    const colors = getColors();

    // Update area colors based on direction
    areaSeries.applyOptions({
      lineColor: colors.lineColor,
      topColor: colors.areaTopColor,
      bottomColor: colors.areaBottomColor,
      crosshairMarkerBackgroundColor: colors.lineColor,
    } as any);

    // Set visibility
    // Price data types use line/candle charts
    // Volume-like data types (volume, liquidity, fees, tvl) use histogram
    const showLine = dataType === 'price' && chartType === 'line';
    const showCandle = dataType === 'price' && chartType === 'candle';
    const showVolume = dataType === 'volume' || dataType === 'liquidity' || dataType === 'fees' || dataType === 'tvl';

    areaSeries.applyOptions({ visible: showLine } as any);
    candlestickSeries.applyOptions({ visible: showCandle } as any);
    volumeSeries.applyOptions({ visible: showVolume } as any);

    // Set data
    if (showLine && chartData.lineData.length > 0) {
      areaSeries.setData(chartData.lineData);
    }
    if (showCandle && chartData.candleData.length > 0) {
      candlestickSeries.setData(chartData.candleData as any);
    }
    if (showVolume) {
      // Use appropriate data source for histogram
      if (dataType === 'fees' && feesChartData.length > 0) {
        volumeSeries.setData(feesChartData as any);
      } else if (dataType === 'tvl' && poolTvlChartData.length > 0) {
        volumeSeries.setData(poolTvlChartData as any);
      } else if (dataType === 'tvl' && tvlChartData.length > 0) {
        volumeSeries.setData(tvlChartData as any);
      } else if (volumeChartData.length > 0) {
        volumeSeries.setData(volumeChartData as any);
      }
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

  // Fetch data when interval or dataType changes
  $effect(() => {
    selectedInterval;
    dataType;
    untrack(() => {
      loadChartData();
    });
  });

  // Update chart when data or options change
  $effect(() => {
    rawCandles;
    feesData;
    tvlData;
    chartType;
    dataType;
    isReversed;
    hoveredTime; // Re-render when hover changes for bar highlighting
    if (chart) {
      updateChartDisplay();
    }
  });

  // Update time scale formatter when interval changes
  $effect(() => {
    const interval = selectedInterval; // Track the interval
    if (chart) {
      chart.timeScale().applyOptions({
        tickMarkFormatter: getTickMarkFormatter(interval),
      } as any);
    }
  });

  // Handle chart lifecycle when switching between liquidity and other views
  // The {#if} conditional destroys/recreates the chartContainer DOM element
  $effect(() => {
    const isLiquidity = showLiquidityChart;

    if (isLiquidity && chart) {
      // Switching TO liquidity - destroy chart (container will be unmounted)
      chart.remove();
      chart = null;
      areaSeries = null;
      candlestickSeries = null;
      volumeSeries = null;
    }

    if (!isLiquidity && !chart) {
      // Switching FROM liquidity - wait for DOM to mount new container
      queueMicrotask(() => {
        if (chartContainer && !chart) {
          initializeChart();
        }
      });
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

<div class="explore-chart">
  <div class="chart-wrapper" bind:this={chartWrapperEl} onmousemove={handleChartMouseMove}>
    {#if showLiquidityChart}
      <!-- Pool Liquidity Distribution Chart -->
      <LiquidityExploreChart
        pools={poolDepthData}
        {token0Decimals}
        {token1Decimals}
        token0Symbol={displayToken0}
        token1Symbol={displayToken1}
        token0Logo={isReversed ? token1Logo : token0Logo}
        token1Logo={isReversed ? token0Logo : token1Logo}
        token0PriceUsd={isReversed ? token1PriceUsd : token0PriceUsd}
        token1PriceUsd={isReversed ? token0PriceUsd : token1PriceUsd}
        isLoading={isLoadingDepth}
        height="356px"
      />
    {:else}
      <!-- Price/Volume/Fees Chart using lightweight-charts -->
      <PriceOverlay
        value={displayPrice}
        change={displayChange}
        mode={overlayMode}
        token0Symbol={displayToken0}
        token1Symbol={displayToken1}
      />

      <ChartContainer
        {isLoading}
        {error}
        isEmpty={!isLoading && !error && rawCandles.length === 0 && feesData.length === 0 && tvlData.length === 0}
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
    {/if}

    <!-- Fees tooltip (shown on volume bar hover) -->
    {#if hoveredFees !== null && dataType === 'fees'}
      <div class="fees-tooltip" style="left: {tooltipX + 16}px; top: {tooltipY - 16}px;">
        <span class="fees-tooltip-label">Fees</span>
        <span class="fees-tooltip-value">{formatVolume(hoveredFees)}</span>
      </div>
    {/if}
  </div>

  <div class="chart-controls">
    <div class="controls-right">
      {#if dataType === 'price'}
        {#snippet lineIcon()}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h4l3-9 4 18 3-9h4"/>
          </svg>
        {/snippet}
        {#snippet candleIcon()}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="8" width="4" height="8" rx="1"/>
          </svg>
        {/snippet}
        <ChartToggle
          options={[
            { value: 'line', icon: lineIcon, label: 'Line', ariaLabel: 'Line chart' },
            { value: 'candle', icon: candleIcon, label: 'Candle', ariaLabel: 'Candlestick chart' },
          ]}
          bind:value={chartType}
          ariaLabel="Chart type"
        />
      {/if}

      <ChartToggle
        options={dataTypeOptions.filter(o => !o.disabled).map(o => ({ value: o.value, label: o.label }))}
        bind:value={dataType}
        ariaLabel="Data type"
      />
    </div>

    {#if !showLiquidityChart}
      <ChartToggle
        options={Object.keys(EXPLORE_INTERVAL_CONFIG).map((interval) => ({
          value: interval,
          label: interval,
        }))}
        bind:value={selectedInterval}
        ariaLabel="Time interval"
      />
    {/if}
  </div>
</div>

<style>
  .explore-chart {
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

  .chart-area {
    width: 100%;
    height: 356px;
    position: relative;
    background-image: radial-gradient(circle, oklch(from var(--muted-foreground) l c h / 0.2) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: 0 0;
  }

  /* Hover beam - vertical highlight synced to actual bar position */
  .hover-beam {
    position: absolute;
    top: 10%;
    /* bottom is set via inline style based on time scale height */
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
    flex-direction: row-reverse;
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
    /* On mobile, controls become dropdowns - keep in one row */
    .chart-controls {
      flex-direction: row-reverse;
      gap: 8px;
    }

    .controls-right {
      display: flex;
      gap: 8px;
    }
  }
</style>
