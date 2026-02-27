<script lang="ts">
  import TimeSeriesChart from '$lib/components/ui/charts/presets/TimeSeriesChart.svelte';
  import ChartToggle from '$lib/components/ui/charts/primitives/ChartToggle.svelte';
  import type { TimeInterval } from '$lib/components/ui/charts/core/chart.constants';
  import { treasuryState, type TreasuryMetric, type TreasuryDataPoint } from '$lib/domain/treasury';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';

  // ============================================
  // Types
  // ============================================

  type PrimaryCategory = 'fees' | 'cycles_out';
  type UnitType = 'native' | 'usd';

  interface MetricConfig {
    title: string;
    valuePrefix: string;
    valueSuffix: string;
    formatValue: (value: number) => string;
  }

  // ============================================
  // Configuration
  // ============================================

  const METRIC_CONFIG: Record<TreasuryMetric, MetricConfig> = {
    fees_icp: {
      title: 'DAILY FEES (ICP)',
      valuePrefix: '',
      valueSuffix: ' ICP',
      formatValue: formatICP,
    },
    fees_usd_e6: {
      title: 'DAILY FEES (USD)',
      valuePrefix: '$',
      valueSuffix: '',
      formatValue: formatUSD,
    },
    cycles_out: {
      title: 'DAILY CYCLES OUT',
      valuePrefix: '',
      valueSuffix: '',
      formatValue: formatCycles,
    },
    cycles_expense_usd_e6: {
      title: 'DAILY CYCLES EXPENSE (USD)',
      valuePrefix: '$',
      valueSuffix: '',
      formatValue: formatUSD,
    },
  };

  const PRIMARY_OPTIONS: { value: PrimaryCategory; label: string }[] = [
    { value: 'fees', label: 'Fees' },
    { value: 'cycles_out', label: 'Cycles' },
  ];

  // ============================================
  // State
  // ============================================

  let selectedCategory = $state<PrimaryCategory>('fees');
  let selectedUnit = $state<UnitType>('native');
  let currentInterval = $state<TimeInterval>('1W');

  // ============================================
  // Derived
  // ============================================

  const selectedMetric = $derived.by((): TreasuryMetric => {
    if (selectedCategory === 'fees') {
      return selectedUnit === 'native' ? 'fees_icp' : 'fees_usd_e6';
    } else {
      return selectedUnit === 'native' ? 'cycles_out' : 'cycles_expense_usd_e6';
    }
  });

  const currentConfig = $derived(METRIC_CONFIG[selectedMetric]);

  const secondaryOptions = $derived.by(() => {
    const nativeLabel = selectedCategory === 'fees' ? 'ICP' : 'Cycles';
    return [
      { value: 'native' as UnitType, label: nativeLabel },
      { value: 'usd' as UnitType, label: 'USD' },
    ];
  });

  const chartData = $derived.by(() => {
    return entityStore.getTreasurySnapshots(currentInterval, selectedMetric);
  });

  // ============================================
  // Data Fetching
  // ============================================

  async function fetchData(interval: TimeInterval): Promise<TreasuryDataPoint[]> {
    currentInterval = interval;
    await treasuryState.fetchSnapshots(interval, selectedMetric);
    return entityStore.getTreasurySnapshots(interval, selectedMetric);
  }

  const fetchDataFn = $derived(() => fetchData);

  // ============================================
  // Formatters
  // ============================================

  function formatCycles(value: number): string {
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toFixed(0);
  }

  function formatICP(value: number): string {
    const icp = value / 100_000_000;
    if (icp >= 1_000_000) return `${(icp / 1_000_000).toFixed(2)}M`;
    if (icp >= 1_000) return `${(icp / 1_000).toFixed(2)}K`;
    if (icp >= 1) return icp.toFixed(2);
    return icp.toFixed(4);
  }

  function formatUSD(value: number): string {
    const usd = value / 1_000_000; // e6 to dollars
    if (usd >= 1_000_000) return `${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `${(usd / 1_000).toFixed(2)}K`;
    if (usd >= 1) return usd.toFixed(2);
    return usd.toFixed(4);
  }
</script>

{#snippet toggleControls()}
  <div class="toggle-controls">
    <ChartToggle
      options={PRIMARY_OPTIONS}
      bind:value={selectedCategory}
      ariaLabel="Category"
    />
    <ChartToggle
      options={secondaryOptions}
      bind:value={selectedUnit}
      ariaLabel="Unit"
    />
  </div>
{/snippet}

<div class="treasury-chart">
  {#key selectedMetric}
    <TimeSeriesChart
      fetchData={fetchDataFn()}
      title={currentConfig.title}
      valuePrefix={currentConfig.valuePrefix}
      valueSuffix={currentConfig.valueSuffix}
      formatValue={currentConfig.formatValue}
      rightControls={toggleControls}
    />
  {/key}
</div>

<style>
  .treasury-chart {
    position: relative;
    width: 100%;
  }

  .toggle-controls {
    display: flex;
    gap: 8px;
  }
</style>
