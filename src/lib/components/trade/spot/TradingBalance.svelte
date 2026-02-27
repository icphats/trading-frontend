<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { bigIntToString } from "$lib/domain/markets/utils";
  import { user } from "$lib/domain/user/auth.svelte";
  import { accountDrawer } from "$lib/components/portal/drawers/specific/AccountDrawer";
  import TokenBalanceRow from "./TokenBalanceRow.svelte";
  import ToolbarButton from "$lib/components/ui/ToolbarButton.svelte";
  import TradingBalanceTransferModal from "$lib/components/portal/modals/specific/TradingBalanceTransferModal.svelte";
  import LockedBalancesModal from "$lib/components/portal/modals/specific/LockedBalancesModal.svelte";
  import type { ClaimTokenId } from "$lib/actors/services/spot.service";

  let { spot }: { spot: SpotMarket | undefined } = $props();

  // Modal state
  let transferModalOpen = $state(false);
  let lockedModalOpen = $state(false);
  let selectedToken = $state<ClaimTokenId>({ quote: null });

  // Get token metadata from entityStore
  let token0 = $derived.by(() =>
    spot?.tokens?.[0] ? entityStore.getToken(spot.tokens[0].toString()) : null
  );
  let token1 = $derived.by(() =>
    spot?.tokens?.[1] ? entityStore.getToken(spot.tokens[1].toString()) : null
  );

  // Format available balances
  let formattedAvailableBase = $derived.by(() =>
    token0 && spot ? bigIntToString(spot.availableBase, token0.decimals) : "0"
  );
  let formattedAvailableQuote = $derived.by(() =>
    token1 && spot ? bigIntToString(spot.availableQuote, token1.decimals) : "0"
  );

  // Calculate USD values
  function calculateUsdValue(balance: bigint, price: bigint, decimals: number): number {
    if (balance === 0n || price === 0n) return 0;
    const balanceFloat = Number(balance) / (10 ** decimals);
    const priceFloat = Number(price) / 1e12;
    return balanceFloat * priceFloat;
  }

  function formatUsd(value: number): string {
    if (value === 0) return "";
    if (value < 0.01) return "<$0.01";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  }

  let baseUsdValue = $derived.by(() => {
    if (!spot || !token0) return "";
    const value = calculateUsdValue(spot.availableBase, token0.priceUsd, token0.decimals);
    return formatUsd(value);
  });

  let quoteUsdValue = $derived.by(() => {
    if (!spot || !token1) return "";
    const value = calculateUsdValue(spot.availableQuote, token1.priceUsd, token1.decimals);
    return formatUsd(value);
  });

  // Handle row click - open transfer modal directly
  function handleRowClick(type: "base" | "quote") {
    selectedToken = type === "base" ? { base: null } : { quote: null };
    transferModalOpen = true;
  }
</script>

{#if spot}
  <div class="balance-container">
    {#if user.isReady && user.isAuthenticated}
      <!-- Header -->
      <div class="balance-header">
        <span class="balance-title">Trading Balance</span>
        <ToolbarButton onclick={() => lockedModalOpen = true} ariaLabel="View balance breakdown">
          Show All
        </ToolbarButton>
      </div>

      <!-- Balance Rows -->
      <div class="balance-rows">
        <TokenBalanceRow
          symbol={token0?.displaySymbol ?? 'BASE'}
          balance={formattedAvailableBase}
          usdValue={baseUsdValue || undefined}
          logo={token0?.logo ?? undefined}
          onclick={() => handleRowClick("base")}
        />
        <TokenBalanceRow
          symbol={token1?.displaySymbol ?? 'QUOTE'}
          balance={formattedAvailableQuote}
          usdValue={quoteUsdValue || undefined}
          logo={token1?.logo ?? undefined}
          onclick={() => handleRowClick("quote")}
        />
      </div>

      <!-- Transfer Modal (Deposit/Withdraw) -->
      <TradingBalanceTransferModal
        bind:open={transferModalOpen}
        {spot}
        tokenId={selectedToken}
        onClose={() => transferModalOpen = false}
      />

      <!-- Balance Breakdown Modal -->
      <LockedBalancesModal
        bind:open={lockedModalOpen}
        {spot}
        onClose={() => lockedModalOpen = false}
      />
    {:else}
      <!-- Connect Prompt for unauthenticated users -->
      <div class="connect-prompt">
        <span class="connect-message">Connect to view balances</span>
        <button class="connect-button" onclick={() => accountDrawer.open()}>
          Connect
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .balance-container {
    border-bottom: 1px solid var(--border);
  }

  /* Header */
  .balance-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .balance-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--foreground);
  }


  /* Balance rows container */
  .balance-rows {
    display: flex;
    flex-direction: column;
  }

  /* Connect prompt for unauthenticated users */
  .connect-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.5rem 0.75rem;
  }

  .connect-message {
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }

  .connect-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    background: var(--primary);
    border: 1px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 535;
    line-height: 14px;
    color: white;
    transition: opacity 0.15s ease, transform 0.1s ease;
    white-space: nowrap;
  }

  .connect-button:hover {
    opacity: 0.9;
  }

  .connect-button:active {
    transform: scale(0.98);
  }
</style>
