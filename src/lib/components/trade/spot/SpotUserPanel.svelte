<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import SpotOpenOrders from "./SpotOpenOrders.svelte";
  import SpotTransactions from "./SpotTransactions.svelte";
  import SpotTriggers from "./SpotTriggers.svelte";
  import SpotPositions from "./SpotPositions.svelte";
  import SpotActivity from "./SpotActivity.svelte";
  import Tabs from "$lib/components/ui/Tabs.svelte";

  // Receive typed SpotMarket instance as prop
  let { spot }: { spot: SpotMarket } = $props();

  const tabs = [
    { id: "transactions", label: "Transactions" },
    { id: "orders", label: "Orders" },
    { id: "triggers", label: "Triggers" },
    { id: "pools", label: "Pools" },
    { id: "activity", label: "Activity" },
  ];
</script>

<div class="user-panel">
  <Tabs {tabs}>
    {#snippet children(activeTab)}
      <!-- Table scroll container - scrolls independently from tabs -->
      <div class="table-scroll">
        <div class="table-content">
          {#if activeTab === "orders"}
            <SpotOpenOrders {spot} />
          {:else if activeTab === "transactions"}
            <SpotTransactions {spot} />
          {:else if activeTab === "triggers"}
            <SpotTriggers {spot} />
          {:else if activeTab === "pools"}
            <SpotPositions {spot} />
          {:else if activeTab === "activity"}
            <SpotActivity {spot} />
          {/if}
        </div>
      </div>
    {/snippet}
  </Tabs>
</div>

<style>
  /* Main container - no horizontal scroll here */
  .user-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Horizontal scroll ONLY for table content */
  .table-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    height: 360px;
  }

  /* Table content - width driven by table columns, not arbitrary fixed value */
  .table-content {
    min-width: max-content; /* Let table determine its own width */
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
