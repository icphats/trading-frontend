<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { browser } from "$app/environment";
  import {
    createChart,
    CandlestickSeries,
    LineSeries,
    HistogramSeries,
  } from "lightweight-charts";
  import type {
    IChartApi,
    ISeriesApi,
    UTCTimestamp,
    IPriceLine,
  } from "lightweight-charts";
  import ChartControls from "$lib/components/trade/charts/ChartControls.svelte";
  import { chartSettings } from "$lib/components/trade/charts/chart-controls.svelte";
  import type { ChartInterval as UIChartInterval } from "$lib/components/trade/charts/chart-controls.svelte";
  import { app } from "$lib/state/app.state.svelte";
  import { marketSelection } from "$lib/domain/markets";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { SpotChartInterval } from "$lib/domain/markets";

  type BackendChartInterval = SpotChartInterval;

  import { deriveSpotBaseData } from "../charts/chart.derived";
  import { findNearestRate } from "$lib/utils/price.utils";
  import type { BaseChartData } from "../charts/chart.derived";
  import {
    extractThemeColors,
    getChartOptions,
    getCandlestickOptions,
    getLineOptions,
    getVolumeOptions,
    E12_SCALE,
    getVolumeScale,
    ensureArray,
    TRADING_VISIBLE_CANDLES,
  } from "$lib/components/ui/charts/core";
  import type { ThemeColors } from "$lib/components/ui/charts/core";
  import {
    deriveSpotLimitOrderLines,
    deriveSpotTriggerOrderLines,
    getLineColor,
    getLineLabel,
  } from "../charts/chart.lines";
  import type { PriceLine } from "../charts/chart.lines";
  import { oracleRepository } from "$lib/repositories";
  import { STABLECOIN_SYMBOLS } from "$lib/constants/app.constants";
  import type { PriceEntry } from "$lib/repositories/cache";

  interface ChartProps {
    market: SpotMarket;
    enableRealtime?: boolean;
    showControls?: boolean;
  }

  const EMPTY_BASE_DATA: BaseChartData = {
    candles: [],
    ohlc: [],
    line: [],
    oracle: [],
    volume: [],
  };

  /**
   * Convert UI chart interval format to backend ChartInterval variant
   */
  function mapIntervalToBackend(
    interval: UIChartInterval,
  ): BackendChartInterval {
    switch (interval) {
      case "1m":
        return { min1: null };
      case "15m":
        return { min15: null };
      case "1h":
        return { hour1: null };
      case "4h":
        return { hour4: null };
      case "1d":
        return { day1: null };
      default:
        return { hour1: null };
    }
  }

  /**
   * Check if UI interval matches backend interval
   */
  function intervalsMatch(
    uiInterval: UIChartInterval,
    backendInterval: BackendChartInterval,
  ): boolean {
    const mapped = mapIntervalToBackend(uiInterval);
    return JSON.stringify(mapped) === JSON.stringify(backendInterval);
  }

  // Prefer `showControls`, fall back to legacy `enableRealtime`
  let {
    market,
    enableRealtime: _enableRealtime = true,
    showControls = _enableRealtime,
  }: ChartProps = $props();

  let chartContainer: HTMLElement | null = $state(null);
  let chart: IChartApi | null = $state(null);
  let candlestickSeries: ISeriesApi<"Candlestick"> | null = $state(null);
  let lineSeries: ISeriesApi<"Line"> | null = $state(null);
  let volumeSeries: ISeriesApi<"Histogram"> | null = $state(null);

  let dataInitialized = $state(false);
  let isLoadingInterval = $state(false);

  // Price line management for limit orders
  let priceLineMap = new Map<
    string,
    { series: ISeriesApi<"Candlestick"> | ISeriesApi<"Line">; line: IPriceLine }
  >();

  const currentChartType = $derived(chartSettings.view);
  const priceBasis = $derived(chartSettings.priceBasis);
  const showVolume = $derived(chartSettings.layers.volume);
  const showLimitOrders = $derived(chartSettings.trading.limitOrders);
  const showTriggers = $derived(chartSettings.trading.triggers);

  let oraclePrices = $state<PriceEntry[]>([]);
  const quoteSymbol = $derived(market.getQuoteTokenSymbol());
  const isStablecoinQuote = $derived(STABLECOIN_SYMBOLS.has(quoteSymbol));

  let themeColors: ThemeColors = $state(
    extractThemeColors()[
      browser && document.documentElement.classList.contains("dark") ? "dark" : "light"
    ],
  );

  function snapshotBaseData(): BaseChartData {
    const data = baseData ?? EMPTY_BASE_DATA;
    return {
      candles: ensureArray(data.candles),
      ohlc: ensureArray(data.ohlc),
      line: ensureArray(data.line),
      oracle: ensureArray(data.oracle),
      volume: ensureArray(data.volume),
    };
  }

  /**
   * Clear all chart series data synchronously
   * Called before interval changes to prevent "Cannot update oldest data" errors
   */
  function clearAllSeries() {
    if (candlestickSeries) {
      candlestickSeries.setData([]);
    }
    if (lineSeries) {
      lineSeries.setData([]);
    }
    if (volumeSeries) {
      volumeSeries.setData([]);
    }
  }

  const baseData = $derived.by(() => {
    return deriveSpotBaseData(
      market.chartData ?? [],
      themeColors,
      priceBasis,
      market.baseTokenDecimals,
      oraclePrices,
    );
  });

  // Derive limit order lines from user orders
  const rawLimitOrderLines = $derived.by(() =>
    deriveSpotLimitOrderLines(market.userOrders ?? [], market.baseTokenDecimals, market.quoteTokenDecimals),
  );
  const rawTriggerOrderLines = $derived.by(() =>
    deriveSpotTriggerOrderLines(market.userTriggers ?? [], market.baseTokenDecimals, market.quoteTokenDecimals),
  );

  const allPriceLines = $derived([
    ...(showLimitOrders ? rawLimitOrderLines : []),
    ...(showTriggers ? rawTriggerOrderLines : []),
  ]);

  $effect(() => {
    if (!browser) return;
    const currentTheme =
      app.theme ??
      (document.documentElement.classList.contains("dark") ? "dark" : "light");
    themeColors = extractThemeColors()[currentTheme] ?? themeColors;
  });

  const INTERVAL_STEP_MS: Record<string, bigint> = {
    '1m': 60_000n, '15m': 900_000n, '1h': 3_600_000n,
    '4h': 14_400_000n, '1d': 86_400_000n,
  };

  // Fetch oracle prices for USD conversion
  $effect(() => {
    const chartData = market.chartData;
    const needsOracle = priceBasis === "usd" && !isStablecoinQuote && chartData && chartData.length > 0;

    if (!needsOracle) {
      oraclePrices = [];
      return;
    }

    const symbol = quoteSymbol;
    const fromMs = BigInt(Number(chartData[0][0]));
    const toMs = BigInt(Number(chartData[chartData.length - 1][0]));
    const stepMs = INTERVAL_STEP_MS[chartSettings.interval] ?? 3_600_000n;

    oracleRepository.fetchPriceArchive(symbol, fromMs, toMs, stepMs).then((result) => {
      if ('ok' in result) {
        oraclePrices = result.ok;
      }
    });
  });

  function initializeChart() {
    if (!chartContainer || chart) {
      return;
    }

    const colors = themeColors;
    const chartOptions = getChartOptions(
      chartContainer.clientWidth,
      chartContainer.clientHeight,
      colors,
    );

    chart = createChart(chartContainer, chartOptions as any);

    candlestickSeries = chart.addSeries(
      CandlestickSeries,
      getCandlestickOptions(colors) as any,
    );
    lineSeries = chart.addSeries(LineSeries, getLineOptions(colors) as any);
    volumeSeries = chart.addSeries(
      HistogramSeries,
      getVolumeOptions(colors) as any,
    );

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const baseSnapshot = snapshotBaseData();

    if (candlestickSeries) candlestickSeries.setData(baseSnapshot.ohlc as any);
    if (lineSeries) lineSeries.setData(baseSnapshot.line as any);
    if (volumeSeries) volumeSeries.setData(baseSnapshot.volume as any);

    applyVisibility();
    applyVisibleRange(baseSnapshot.ohlc);
    dataInitialized = true;
  }

  /**
   * Set visible range based on interval's configured candle count
   */
  function applyVisibleRange(ohlc: { time: UTCTimestamp }[]) {
    if (!chart) return;

    // If no historical data, use fitContent to show placeholder candle
    if (ohlc.length === 0) {
      chart.timeScale().fitContent();
      return;
    }

    const interval = chartSettings.interval;
    const visibleCount = TRADING_VISIBLE_CANDLES[interval] ?? 48;
    const startIndex = Math.max(0, ohlc.length - visibleCount);

    chart.timeScale().setVisibleRange({
      from: ohlc[startIndex].time,
      to: ohlc[ohlc.length - 1].time,
    });
  }

  $effect(() => {
    if (!chart || !dataInitialized) {
      return;
    }
    if (!candlestickSeries || !lineSeries || !volumeSeries) {
      return;
    }

    const baseSnapshot = snapshotBaseData();

    // Only call setData() if data changed (backend now includes live candle)
    const currentLength = baseSnapshot.ohlc.length;
    if (currentLength !== lastHistoricalDataLength) {
      const isNewDataLoad = lastHistoricalDataLength === 0;

      // Backend now includes live candle - no placeholder needed
      candlestickSeries.setData(baseSnapshot.ohlc as any);
      lineSeries.setData(baseSnapshot.line as any);
      volumeSeries.setData(baseSnapshot.volume as any);
      lastHistoricalDataLength = currentLength;

      // Apply visible range on fresh data loads (interval/market change)
      if (isNewDataLoad) {
        applyVisibleRange(baseSnapshot.ohlc);
      }
    }

    applyVisibility();
  });

  let lastSpotLiveUpdate: { signature: string } | null = null;
  let lastHistoricalDataLength = $state(0);

  // Operation ID for tracking async operations - prevents stale closure bugs
  let intervalOperationId = 0;

  // Consolidated effect for market changes and interval changes
  // Prevents race conditions from duplicate setChartInterval calls
  $effect(() => {
    // Track dependencies: market instance and UI interval
    const currentMarket = market;
    const uiInterval = chartSettings.interval;

    // Reset tracking state
    lastSpotLiveUpdate = null;
    lastHistoricalDataLength = 0;

    if (!dataInitialized) return;

    // Clear series to prevent stale data
    clearAllSeries();

    // Use untrack to read market.chartInterval without creating dependency
    // This prevents infinite loop when setChartInterval updates market.chartInterval
    const marketInterval = untrack(() => currentMarket.chartInterval);

    // Only fetch if intervals don't match
    if (!intervalsMatch(uiInterval, marketInterval)) {
      // Increment operation ID to invalidate any pending async handlers
      const thisOpId = ++intervalOperationId;

      isLoadingInterval = true;

      const backendInterval = mapIntervalToBackend(uiInterval);
      currentMarket
        .setChartInterval(backendInterval)
        .then(() => {
          // Only update state if this is still the current operation
          if (thisOpId === intervalOperationId) {
            setTimeout(() => {
              isLoadingInterval = false;
            }, 100);
          }
        })
        .catch((error) => {
          // Only update state if this is still the current operation
          if (thisOpId === intervalOperationId) {
            console.error("Failed to change chart interval:", error);
            isLoadingInterval = false;
          }
        });
    }
  });

  $effect(() => {
    priceBasis;
    lastSpotLiveUpdate = null;
    lastHistoricalDataLength = 0;

    // Clear series when changing price basis (ICP ↔ USD) to prevent stale data
    if (dataInitialized) {
      clearAllSeries();
    }
  });

  $effect(() => {
    if (!chart || !dataInitialized) return;
    if (!candlestickSeries || !lineSeries || !volumeSeries) return;

    // Block live candle updates during interval transitions
    if (market.isTransitioningInterval || isLoadingInterval) {
      return;
    }

    const live = market.liveCandle;
    if (!live) return;

    const time = (Number(live[0]) / 1000) as UTCTimestamp;
    if (!time) return;

    // Check if live candle timestamp is OLDER than historical data
    // Only skip if live candle is from a previous period (stale data)
    // When timestamps match (same period), the live candle has fresher OHLCV data from recent trades
    const baseSnapshot = snapshotBaseData();

    // Only check staleness if we have historical data
    // (When empty, placeholder candle was added and needs updating)
    if (baseSnapshot.ohlc.length > 0) {
      const lastHistoricalTime =
        baseSnapshot.ohlc[baseSnapshot.ohlc.length - 1].time;
      if (time < lastHistoricalTime) {
        // Live candle is older than last historical candle - skip stale update
        return;
      }
    }

    const volumeScale = getVolumeScale(market.baseTokenDecimals);

    // Extract and scale OHLC values (E12 precision)
    const openQuote = Number(live[1]) / E12_SCALE;
    const highQuote = Number(live[2]) / E12_SCALE;
    const lowQuote = Number(live[3]) / E12_SCALE;
    const closeQuote = Number(live[4]) / E12_SCALE;
    // Volume uses native token decimals, NOT E12
    const volumeNative = Number(live[5]) / volumeScale;
    const quoteUsdRate = priceBasis === "usd" ? findNearestRate(oraclePrices, Number(live[0])) : 0;

    // Apply price basis conversion
    const priceFactor = priceBasis === "usd" ? quoteUsdRate : 1;

    const open = openQuote * priceFactor;
    const high = highQuote * priceFactor;
    const low = lowQuote * priceFactor;
    const close = closeQuote * priceFactor;

    // USD volume = quantity × price × usdRate (actual USD value traded)
    // Quote volume = quantity (native units)
    const vol = priceBasis === "usd"
      ? volumeNative * closeQuote * quoteUsdRate
      : volumeNative;

    // Include all fields in signature for proper deduplication
    const signature = `${live[0]}-${live[1]}-${live[2]}-${live[3]}-${live[4]}-${live[5]}-${oraclePrices.length}-${priceBasis}`;
    if (lastSpotLiveUpdate?.signature === signature) {
      return;
    }

    const color =
      close >= open
        ? (themeColors?.bullish ?? "#10b981")
        : (themeColors?.bearish ?? "#ef4444");

    candlestickSeries.update({ time, open, high, low, close } as any);
    lineSeries.update({ time, value: close } as any);
    volumeSeries.update({ time, value: vol, color } as any);

    lastSpotLiveUpdate = { signature };
  });

  function applyVisibility() {
    if (!candlestickSeries || !lineSeries || !volumeSeries) return;

    candlestickSeries.applyOptions({
      visible: currentChartType === "candle",
    } as any);
    lineSeries.applyOptions({ visible: currentChartType !== "candle" } as any);
    volumeSeries.applyOptions({ visible: showVolume } as any);
  }

  function applySize() {
    if (chart && chartContainer) {
      (chart as any).applyOptions({
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight || 400,
      });
    }
  }

  $effect(() => {
    if (!chart) return;

    const colors = themeColors;
    if (!colors?.background) return;

    const chartOptions = getChartOptions(
      chartContainer?.clientWidth || 600,
      chartContainer?.clientHeight || 400,
      colors,
    );

    (chart as any).applyOptions(chartOptions);

    if (candlestickSeries) {
      candlestickSeries.applyOptions(getCandlestickOptions(colors) as any);
    }
    if (lineSeries) {
      lineSeries.applyOptions(getLineOptions(colors) as any);
    }
    if (volumeSeries) {
      const { volume } = snapshotBaseData();
      volumeSeries.setData(volume as any);
    }
  });

  $effect(() => {
    currentChartType;
    applyVisibility();
  });

  // Render price lines for limit orders
  $effect(() => {
    if (!chart || !dataInitialized) return;

    const mainSeries =
      currentChartType === "candle" ? candlestickSeries : lineSeries;
    if (!mainSeries) return;

    // If no price lines to show, clear all existing lines
    if (allPriceLines.length === 0) {
      for (const [key, entry] of priceLineMap) {
        try {
          entry?.series?.removePriceLine?.(entry.line);
        } catch (e) {
          // Ignore errors when removing price lines
        }
      }
      priceLineMap.clear();
      return;
    }

    const colors = themeColors;
    const currentKeys = new Set(allPriceLines.map((item) => item.key));

    // Remove price lines that are no longer in allPriceLines
    for (const [key, entry] of priceLineMap) {
      if (!currentKeys.has(key)) {
        try {
          entry?.series?.removePriceLine?.(entry.line);
        } catch (e) {
          // Ignore errors when removing price lines
        }
        priceLineMap.delete(key);
      }
    }

    // Add or update price lines
    allPriceLines.forEach(({ type, price, key }) => {
      if (!priceLineMap.has(key) && mainSeries) {
        const line = mainSeries.createPriceLine({
          price,
          color: getLineColor(type, colors),
          lineWidth: 1,
          lineStyle: 2, // Dashed line
          axisLabelVisible: true,
          title: getLineLabel(type),
        });
        priceLineMap.set(key, { series: mainSeries, line });
      }
    });
  });

  // NOTE: Interval change handling is consolidated into the market/interval effect above (line ~284)
  // This prevents race conditions from duplicate setChartInterval calls

  onMount(() => {
    initializeChart();

    const ro = new ResizeObserver(() => applySize());
    if (chartContainer) ro.observe(chartContainer);

    return () => {
      ro.disconnect();

      // Clean up price lines before removing chart
      for (const [key, entry] of priceLineMap) {
        try {
          entry?.series?.removePriceLine?.(entry.line);
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      priceLineMap.clear();

      if (chart) {
        (chart as any).remove();
      }
    };
  });
</script>

<div class="flex flex-col w-full h-full">
  {#if showControls}
    <ChartControls {isStablecoinQuote} />
  {/if}
  <div class="relative flex-1 min-h-0">
    <div bind:this={chartContainer} class="w-full h-full"></div>

    {#if isLoadingInterval}
      <div
        class="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-200"
      >
        <img src="/assets/loading.gif" alt="Loading" class="w-8 h-8" />
      </div>
    {/if}
  </div>
</div>
