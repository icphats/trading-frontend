<script lang="ts">
  /**
   * Trade Page - Symbol-Based Market Resolution
   * Route: /trade/{baseSymbol}/{quoteSymbol}
   *
   * Resolves market from token symbols (e.g., /trade/BOOM/ICP).
   * On in-app navigation: uses pending canister ID (skips indexer lookup)
   * On direct URL access: resolves symbols via indexer
   */

  import TradingLayout from "$lib/components/trade/layouts/TradingLayout.svelte";
  import { marketSelection, marketRegistry } from "$lib/domain/markets";
  import { user } from "$lib/domain/user/auth.svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { indexerRepository } from "$lib/repositories/indexer.repository";
  import {
    isValidQuoteToken,
    toQuoteToken,
    DEFAULT_QUOTE_TOKEN_SYMBOL,
    denormalizeTokenSymbol,
    type QuoteTokenSymbol
  } from "$lib/domain/markets";

  // Get parameters from URL
  const baseSymbol = $derived(page.params.baseSymbol as string);
  const quoteSymbol = $derived(page.params.quoteSymbol as string);

  // Derive active market instance from marketRegistry (for TradingLayout)
  let activeMarketInstance = $derived.by(() => {
    const activeId = marketSelection.getActiveId();
    return activeId ? marketRegistry.getMarket(activeId) : null;
  });

  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Track which market we've loaded to detect changes
  let loadedMarketKey = $state<string | null>(null);

  /**
   * Load market by canister ID
   */
  async function loadMarket(canisterId: string, quoteToken: ReturnType<typeof toQuoteToken>) {
    try {
      await marketSelection.selectMarket(canisterId, quoteToken);
      loadedMarketKey = `${baseSymbol}/${quoteSymbol}`;
      isLoading = false;
      error = null;
    } catch (err) {
      console.error(`[Trade Page] Failed to load market:`, err);
      error = "Failed to load market";
      isLoading = false;
    }
  }

  /**
   * Resolve market from URL params
   * Uses pending canister ID if available (in-app navigation), otherwise indexer lookup
   */
  async function resolveAndLoadMarket() {
    const currentKey = `${baseSymbol}/${quoteSymbol}`;

    // Skip if already loaded this market
    if (loadedMarketKey === currentKey && !isLoading) {
      return;
    }

    isLoading = true;
    error = null;

    // Validate quote token
    const quoteSymbolLower = quoteSymbol.toLowerCase();
    if (!isValidQuoteToken(quoteSymbolLower)) {
      console.warn(`[Trade Page] Invalid quote token: ${quoteSymbol}, redirecting to default`);
      await goto(`/trade/${baseSymbol.toLowerCase()}/${DEFAULT_QUOTE_TOKEN_SYMBOL.toLowerCase()}`, { replaceState: true });
      return;
    }

    const quoteToken = toQuoteToken(quoteSymbolLower as QuoteTokenSymbol);

    // Check for pending canister ID (set by in-app navigation)
    let spotCanisterId = marketSelection.consumePendingNavigation();

    if (spotCanisterId) {
      // In-app navigation - use pending ID directly
      await loadMarket(spotCanisterId, quoteToken);
      return;
    }

    // Direct URL access - resolve via indexer (denormalize for backend: btc → ckbtc)
    const result = await indexerRepository.getMarketBySymbols(
      denormalizeTokenSymbol(baseSymbol),
      denormalizeTokenSymbol(quoteSymbol)
    );

    if ('err' in result || !result.ok) {
      console.error(`[Trade Page] Market not found: ${baseSymbol}/${quoteSymbol}`);
      error = "Market not found";
      isLoading = false;
      return;
    }

    await loadMarket(result.ok.toString(), quoteToken);
  }

  // Initial load and react to URL param changes
  $effect(() => {
    // Track both params to ensure effect runs on any navigation
    const _base = baseSymbol;
    const _quote = quoteSymbol;

    resolveAndLoadMarket();
  });

  // Cleanup on unmount
  onMount(() => {
    return () => {
      marketSelection.deselectMarket();
    };
  });

  // Re-hydrate market when user authenticates
  $effect(() => {
    if (user.agent && marketSelection.hasActiveMarket()) {
      const activeId = marketSelection.getActiveId();
      if (activeId) {
        marketRegistry.getMarket(activeId)?.hydrateAll();
      }
    }
  });
</script>

{#if error}
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <p class="text-destructive text-lg font-semibold">{error}</p>
      <p class="mt-2 text-muted-foreground">Market "{baseSymbol}/{quoteSymbol}" not found</p>
    </div>
  </div>
{:else if isLoading || !activeMarketInstance}
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p class="mt-4 text-muted-foreground">Loading {baseSymbol}/{quoteSymbol}...</p>
    </div>
  </div>
{:else}
  <TradingLayout market={activeMarketInstance} />
{/if}
