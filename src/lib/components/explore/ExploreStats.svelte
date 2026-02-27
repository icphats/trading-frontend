<script lang="ts">
  import { onMount } from 'svelte';
  import { platformState } from '$lib/domain/platform';
  import { formatToken, formatDecimal } from '$lib/utils/format.utils';
  import StatsGrid from "$lib/components/ui/StatsGrid.svelte";

  // Fetch platform stats on mount (if not already loaded)
  onMount(() => {
    if (!platformState.hasData) {
      platformState.fetchStats();
    }
  });

  /**
   * Format percentage change, returning undefined when no meaningful data
   * Returns undefined for 0 values (indicates no historical data for comparison)
   */
  function formatChange(value: number): string | undefined {
    // Treat 0 as "no data" - the backend returns 0 when there's insufficient history
    if (value === 0) return undefined;
    return formatDecimal({ value, displayDecimals: 2, showPlusSign: true }) + '%';
  }

  // Derived stats from platformState (single source of truth)
  let stats = $derived.by(() => {
    if (!platformState.hasData) {
      // Loading state - show dashes for values, no change row
      return [
        { label: "Total TVL", value: "—" },
        { label: "Total Volume", value: "—" },
        { label: "24h Volume", value: "—" },
        { label: "24h Fees", value: "—" },
        { label: "Total Transactions", value: "—" }
      ];
    }

    const tvlChange = formatChange(Number(platformState.tvlChange24h));
    const volumeChange = formatChange(Number(platformState.volumeChange24h));

    return [
      {
        label: "Total TVL",
        value: `$${formatToken({ value: platformState.tvl, unitName: 6, short: true })}`,
        change: tvlChange,
        isPositive: platformState.tvlChange24h >= 0
      },
      {
        label: "Total Volume",
        value: `$${formatToken({ value: platformState.totalVolumeCumulative, unitName: 6, short: true })}`
      },
      {
        label: "24h Volume",
        value: `$${formatToken({ value: platformState.volume24h, unitName: 6, short: true })}`,
        change: volumeChange,
        isPositive: platformState.volumeChange24h >= 0
      },
      {
        label: "24h Fees",
        value: `$${formatToken({ value: platformState.poolFees24h, unitName: 6, short: true })}`
      },
      {
        label: "Total Transactions",
        value: Number(platformState.totalTransactions).toLocaleString()
      }
    ];
  });
</script>

<StatsGrid {stats} />
