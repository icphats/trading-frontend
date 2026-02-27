<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Tabs from "$lib/components/ui/Tabs.svelte";
  import ToggleGroup from "$lib/components/ui/ToggleGroup.svelte";
  import type { ToggleOption } from "$lib/components/ui/ToggleGroup.svelte";
  import SpotMarketOrder from "./SpotMarketOrder.svelte";
  import SpotLimitOrder from "./SpotLimitOrder.svelte";
  import SpotTriggerOrder from "./SpotTriggerOrder.svelte";
  import SpotPoolForm from "./SpotPoolForm.svelte";
  import TradingBalanceTransferModal from "$lib/components/portal/modals/specific/TradingBalanceTransferModal.svelte";
  import type { ClaimTokenId } from "$lib/actors/services/spot.service";

  // Receive typed Spot instance as prop
  interface Props {
    spot: SpotMarket | undefined;
    onPoolTabChange?: (isActive: boolean) => void;
    onPoolRangeChange?: (tickLower: number, tickUpper: number, feePips: number) => void;
  }
  let { spot, onPoolTabChange, onPoolRangeChange }: Props = $props();

  // ============================================
  // Local UI State (owned by this component)
  // ============================================

  let activeTab = $state<"limit" | "market" | "tpsl" | "pool">("market");
  let side = $state<"Buy" | "Sell">("Buy");

  // ============================================
  // Deposit Modal (shared across all tabs)
  // ============================================

  let depositModalOpen = $state(false);
  let depositTokenId = $state<ClaimTokenId>({ quote: null });

  function openDepositBase() {
    depositTokenId = { base: null };
    depositModalOpen = true;
  }

  function openDepositQuote() {
    depositTokenId = { quote: null };
    depositModalOpen = true;
  }

  // ============================================
  // Toggle Options
  // ============================================

  const sideOptions: ToggleOption<"Buy" | "Sell">[] = [
    { value: "Buy", label: "Buy", variant: "green" },
    { value: "Sell", label: "Sell", variant: "red" },
  ];

  const orderTypeTabs = [
    { id: "limit", label: "Limit" },
    { id: "market", label: "Market" },
    { id: "tpsl", label: "Pro" },
    { id: "pool", label: "Pool" },
  ];

  $effect(() => {
    onPoolTabChange?.(activeTab === "pool");
  });
</script>

{#if !spot}
  <div class="text-card-foreground overflow-hidden border-border p-4">
    <p class="text-muted-foreground">Loading market data...</p>
  </div>
{:else}
  <div class="text-card-foreground overflow-hidden border-border">
    <!-- Order Type Tabs (Limit/Market/Pro) -->
    <Tabs
      tabs={orderTypeTabs}
      {activeTab}
      onTabChange={(tabId) => {
        activeTab = tabId as "limit" | "market" | "tpsl" | "pool";
      }}
    >
      {#snippet children(activeTab)}
        {#if activeTab === "limit" || activeTab === "market"}
          <!-- Buy/Sell Selection (shared for limit/market) -->
          <div class="p-4 pb-0">
            <ToggleGroup
              options={sideOptions}
              value={side}
              onValueChange={(value) => side = value as "Buy" | "Sell"}
              size="md"
              fullWidth
              ariaLabel="Select order side"
            />
          </div>

          {#if activeTab === "limit"}
            <SpotLimitOrder {spot} {side} {openDepositBase} {openDepositQuote} />
          {:else if activeTab === "market"}
            <SpotMarketOrder {spot} {side} {openDepositBase} {openDepositQuote} />
          {/if}
        {:else if activeTab === "tpsl"}
          <!-- Pro Tab: Trigger Orders (manages its own side) -->
          <SpotTriggerOrder {spot} {openDepositBase} {openDepositQuote} />
        {:else if activeTab === "pool"}
          <!-- Pool Tab: Add Liquidity (manages its own UI) -->
          <SpotPoolForm {spot} onRangeChange={onPoolRangeChange} {openDepositBase} {openDepositQuote} />
        {/if}
      {/snippet}
    </Tabs>
  </div>

  <TradingBalanceTransferModal
    bind:open={depositModalOpen}
    {spot}
    tokenId={depositTokenId}
    initialTab="deposit"
    onClose={() => depositModalOpen = false}
  />
{/if}
