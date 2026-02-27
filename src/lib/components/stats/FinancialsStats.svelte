<script lang="ts">
  import TreasuryChart from '$lib/components/stats/TreasuryChart.svelte';
  import TreasuryTable from '$lib/components/stats/TreasuryTable.svelte';
</script>

<div class="financials-stats">
  <TreasuryTable />
  <TreasuryChart />
</div>

<style>
  .financials-stats {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 48px;
  }
</style>
