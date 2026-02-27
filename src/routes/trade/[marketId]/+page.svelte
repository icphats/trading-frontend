<script lang="ts">
  /**
   * Trade Page Redirect - Legacy Principal-Based URL
   * Route: /trade/{marketId}
   *
   * Backwards compatibility redirect: resolves canister principal to symbols
   * and redirects to /trade/{baseSymbol}/{quoteSymbol}.
   */

  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { api } from "$lib/actors/api.svelte";
  import { DEFAULT_QUOTE_TOKEN_SYMBOL } from "$lib/domain/markets";

  const marketId = $derived(page.params.marketId);

  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      // Check if marketId looks like a principal (contains dashes)
      if (!marketId.includes("-")) {
        // Already a symbol - redirect to add quote symbol
        await goto(`/trade/${marketId.toLowerCase()}/${DEFAULT_QUOTE_TOKEN_SYMBOL.toLowerCase()}`, { replaceState: true });
        return;
      }

      // Fetch market info to get symbol
      if (!api.indexer) {
        error = "Indexer not initialized";
        return;
      }

      const response = await api.indexer.get_markets({ limit: 100n, cursor: [] });
      const market = response.data.find(m => m.canister_id.toString() === marketId);

      if (!market) {
        error = "Market not found";
        return;
      }

      // Parse symbol and redirect
      const [baseSymbol, quoteSymbol] = market.symbol.split("/");
      if (!baseSymbol || !quoteSymbol) {
        error = "Invalid market symbol";
        return;
      }

      await goto(`/trade/${baseSymbol.toLowerCase()}/${quoteSymbol.toLowerCase()}`, { replaceState: true });
    } catch (err) {
      console.error("[Trade Legacy Redirect] Failed:", err);
      error = "Failed to resolve market";
    }
  });
</script>

<!-- Loading state during redirect -->
{#if error}
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <p class="text-destructive text-lg font-semibold">{error}</p>
      <p class="mt-2 text-muted-foreground">Could not redirect legacy URL</p>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p class="mt-4 text-muted-foreground">Redirecting...</p>
    </div>
  </div>
{/if}
