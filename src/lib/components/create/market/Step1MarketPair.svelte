<script lang="ts">
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import TokenSelectionModal from "$lib/components/portal/modals/specific/TokenSelectionModal.svelte";
  import { marketCreation } from "$lib/domain/markets";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import type { TokenMetadata } from "$lib/repositories/token.repository";

  // Get quote tokens in specific order: ICP, USDT, USDC
  const quoteTokens = $derived(
    entityStore.allTokens
      .filter((t) => t.isQuoteToken)
      .sort((a, b) => {
        const order = ["ICP", "USDT", "USDC"];
        return order.indexOf(a.symbol) - order.indexOf(b.symbol);
      })
  );

  // Memoize the restrictToTokens prop to prevent new array reference on every render
  // This prevents infinite loops when entityStore updates trigger parent re-renders
  const restrictedQuoteTokens = $derived(
    quoteTokens.map((t) => ({
      canisterId: t.canisterId,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logo: t.logo ?? undefined,
    }))
  );

  interface Props {
    onNext: () => void;
    onCancel: () => void;
  }

  let { onNext, onCancel }: Props = $props();

  // Token selection modal state
  let tokenModalOpen = $state(false);
  let quoteTokenModalOpen = $state(false);

  function openTokenModal() {
    tokenModalOpen = true;
  }

  function openQuoteTokenModal() {
    quoteTokenModalOpen = true;
  }

  function handleTokenSelect(token: TokenMetadata) {
    marketCreation.selectedToken = token;
    marketCreation.checkMarketExists();
  }

  function handleQuoteTokenSelect(token: TokenMetadata) {
    marketCreation.selectedQuoteToken = token;
    marketCreation.checkMarketExists();
  }
</script>

<div class="space-y-6">
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-6 space-y-6 overflow-hidden">
    <div>
      <h3 class="text-lg font-semibold">Select Token Pair</h3>
      <p class="text-sm text-[color:var(--muted-foreground)] mt-1">
        Choose the token pair for your new spot market. Select a base token and a quote token (ICP, USDT, or USDC).
      </p>
    </div>

    <!-- Token Pair Selection -->
    <div>
      <div class="grid grid-cols-2 gap-3">
        <!-- Base Token Selection -->
        <button onclick={openTokenModal} class="token-dropdown-button">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            {#if marketCreation.selectedToken}
              <Logo src={marketCreation.selectedToken.logo} alt={marketCreation.selectedToken.symbol} size="lg" />
              <span class="font-semibold text-base truncate">{marketCreation.selectedToken.symbol}</span>
            {:else}
              <div class="w-[42px] h-[42px] rounded-full bg-[color:var(--muted)] flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-[color:var(--muted-foreground)]" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
              </div>
              <span class="font-semibold text-base text-[color:var(--muted-foreground)]">Select base token</span>
            {/if}
          </div>
          <svg class="w-5 h-5 text-[color:var(--muted-foreground)] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <!-- Quote Token Selection -->
        <button onclick={openQuoteTokenModal} class="token-dropdown-button">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            {#if marketCreation.selectedQuoteToken}
              <Logo src={marketCreation.selectedQuoteToken.logo} alt={marketCreation.selectedQuoteToken.symbol} size="lg" />
              <span class="font-semibold text-base truncate">{marketCreation.selectedQuoteToken.symbol}</span>
            {:else}
              <div class="w-[42px] h-[42px] rounded-full bg-[color:var(--muted)] flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-[color:var(--muted-foreground)]" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
              </div>
              <span class="font-semibold text-base text-[color:var(--muted-foreground)]">Select quote token</span>
            {/if}
          </div>
          <svg class="w-5 h-5 text-[color:var(--muted-foreground)] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Validation Feedback -->
    {#if marketCreation.checkingMarketExists}
      <div class="bg-blue-500/10 border border-blue-500/20 rounded-[var(--radius-md)] p-4">
        <p class="text-sm text-blue-500">Checking if market exists...</p>
      </div>
    {:else if marketCreation.step1Error}
      <div class="bg-red-500/10 border border-red-500/20 rounded-[var(--radius-md)] p-4">
        <p class="text-sm font-semibold text-red-500">{marketCreation.step1Error}</p>
      </div>
    {/if}

    <!-- Info Box -->
    <div class="bg-blue-500/10 border border-blue-500/20 rounded-[var(--radius-md)] p-4">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-semibold text-blue-500">What is a Market?</p>
          <p class="text-xs text-[color:var(--muted-foreground)] mt-1">A spot market is a trading canister that enables liquidity pools and trades for a specific token pair. Once created, users can add liquidity and trade this pair.</p>
        </div>
      </div>
    </div>

    <!-- Footer: Action Buttons -->
    <div class="flex items-center justify-between gap-4 mt-6">
      <ButtonV2 variant="secondary" size="xl" onclick={onCancel}>Cancel</ButtonV2>
      <ButtonV2 variant="primary" size="xl" onclick={onNext} disabled={!marketCreation.step1Valid}>Next</ButtonV2>
    </div>
  </div>
</div>

<!-- Token Selection Modals - conditionally mounted to prevent reactive chain interference -->
{#if tokenModalOpen}
  <TokenSelectionModal bind:open={tokenModalOpen} title="Select Base Token" onSelect={handleTokenSelect} />
{/if}
{#if quoteTokenModalOpen}
  <TokenSelectionModal bind:open={quoteTokenModalOpen} title="Select Quote Token" onSelect={handleQuoteTokenSelect} restrictToTokens={restrictedQuoteTokens} />
{/if}

<style>
  .token-dropdown-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 52px;
    padding: 0.75rem 1rem;
    background: var(--card);
    border: none;
    border-radius: var(--radius-md);
    color: var(--foreground);
    text-align: left;
    transition: background-color 150ms ease;
    cursor: pointer;
    outline: none;
    appearance: none;
  }

  .token-dropdown-button:hover {
    background: var(--muted);
  }

  .token-dropdown-button:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .token-dropdown-button:active {
    transform: scale(0.99);
  }
</style>
