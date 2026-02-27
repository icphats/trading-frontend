<script lang="ts">
  import {
    chartSettings,
    setChartView,
    toggleLayer,
    toggleTradingOverlay,
    setPriceBasis,
    setChartInterval,
    type ChartView,
    type PriceBasis,
    type ChartInterval,
  } from "./chart-controls.svelte";
  import ChartToggle from "$lib/components/ui/charts/primitives/ChartToggle.svelte";
  import ChartDropdown from "$lib/components/ui/charts/primitives/ChartDropdown.svelte";

  interface Props {
    isStablecoinQuote?: boolean;
  }

  let { isStablecoinQuote = false }: Props = $props();

  // Overlay option keys - combines layer and trading overlay keys we care about
  type OverlayKey = "volume" | "triggers" | "limitOrders";

  // Options for the overlay dropdown
  const OVERLAY_OPTIONS: { value: OverlayKey; label: string }[] = [
    { value: "volume", label: "Volume" },
    { value: "triggers", label: "Triggers" },
    { value: "limitOrders", label: "Limit Orders" },
  ];

  const PRICE_BASIS_OPTIONS: { value: PriceBasis; label: string }[] = [
    { value: "icp", label: "ICP" },
    { value: "usd", label: "USD" },
  ];

  const INTERVAL_OPTIONS: { value: ChartInterval; label: string }[] = [
    { value: "1m", label: "1m" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "4h", label: "4h" },
    { value: "1d", label: "1d" },
  ];

  const currentView = $derived(chartSettings.view);
  const priceBasis = $derived(chartSettings.priceBasis);
  const currentInterval = $derived(chartSettings.interval);

  // Derive selected overlay values from the chart settings
  const selectedOverlays = $derived.by(() => {
    const selected: OverlayKey[] = [];
    if (chartSettings.layers.volume) selected.push("volume");
    if (chartSettings.trading.triggers) selected.push("triggers");
    if (chartSettings.trading.limitOrders) selected.push("limitOrders");
    return selected;
  });

  function handleOverlayToggle(key: OverlayKey) {
    if (key === "volume") {
      toggleLayer("volume");
    } else {
      toggleTradingOverlay(key);
    }
  }

  function selectView(option: ChartView) {
    setChartView(option);
  }

  function onPriceBasisSelect(basis: PriceBasis) {
    setPriceBasis(basis);
  }

  function onIntervalSelect(interval: ChartInterval) {
    setChartInterval(interval);
  }
</script>

<div class="chart-controls">
  <div class="controls-left">
    <ChartDropdown
      options={OVERLAY_OPTIONS}
      values={selectedOverlays}
      onToggle={handleOverlayToggle}
      multiSelect={true}
      label="Show"
      ariaLabel="Chart overlays"
    />
  </div>

  <div class="controls-right">
    {#snippet candleIcon()}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <rect x="9" y="5" width="6" height="10" rx="1"/>
        <line x1="12" y1="2" x2="12" y2="5"/>
        <line x1="12" y1="15" x2="12" y2="22"/>
      </svg>
    {/snippet}
    {#snippet lineIcon()}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    {/snippet}
    <ChartToggle
      options={[
        { value: 'candle' as ChartView, icon: candleIcon, label: 'Candle', ariaLabel: 'Candlestick chart' },
        { value: 'line' as ChartView, icon: lineIcon, label: 'Line', ariaLabel: 'Line chart' }
      ]}
      value={currentView}
      onValueChange={(v) => selectView(v as ChartView)}
      ariaLabel="Chart type"
    />

    {#if !isStablecoinQuote}
      <ChartToggle
        options={PRICE_BASIS_OPTIONS}
        value={priceBasis}
        onValueChange={(v) => onPriceBasisSelect(v as PriceBasis)}
        ariaLabel="Quote basis"
      />
    {/if}

    <ChartToggle
      options={INTERVAL_OPTIONS}
      value={currentInterval}
      onValueChange={(v) => onIntervalSelect(v as ChartInterval)}
      ariaLabel="Chart interval"
    />
  </div>
</div>

<style>
  .chart-controls {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 1rem;
  }

  .controls-left,
  .controls-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
