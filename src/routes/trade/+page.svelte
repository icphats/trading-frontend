<script lang="ts">
  /**
   * Trade Page Redirect - Symbol-Based Market Selection
   * Route: /trade (base route)
   *
   * Automatically redirects to /trade/{baseSymbol}/{quoteSymbol} for the first available market.
   * This ensures clean, shareable URLs with token symbols in the path.
   */

  import { api } from "$lib/actors/api.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { normalizeTokenSymbol, normalizeQuoteSymbol } from "$lib/domain/markets";

  let isRedirecting = $state(true);

  onMount(async () => {
    try {
      // Get first available market from Indexer
      if (!api.indexer) {
        console.error("[Trade Base] Indexer not initialized");
        isRedirecting = false;
        return;
      }

      const response = await api.indexer.get_markets({ limit: 1n, cursor: [] });
      const firstMarket = response.data[0];

      if (!firstMarket) {
        console.error("[Trade Base] No markets available");
        isRedirecting = false;
        return;
      }

      // Parse symbol (e.g., "ckBTC/ckUSDT" -> ["ckBTC", "ckUSDT"])
      const [baseSymbol, quoteSymbol] = firstMarket.symbol.split("/");

      if (!baseSymbol || !quoteSymbol) {
        console.error("[Trade Base] Invalid market symbol:", firstMarket.symbol);
        isRedirecting = false;
        return;
      }

      // Normalize symbols for URL (ckBTC → btc, ckUSDT → usdt)
      const normalizedBase = normalizeTokenSymbol(baseSymbol);
      const normalizedQuote = normalizeQuoteSymbol(quoteSymbol);

      if (!normalizedQuote) {
        console.error("[Trade Base] Invalid quote token:", quoteSymbol);
        isRedirecting = false;
        return;
      }

      // Redirect using normalized symbol-based URL
      await goto(`/trade/${normalizedBase}/${normalizedQuote}`, { replaceState: true });
    } catch (err) {
      console.error("[Trade Base] Failed to redirect:", err);
      isRedirecting = false;
    }
  });
</script>

<!-- Loading state during redirect -->
{#if isRedirecting}
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p class="mt-4 text-muted-foreground">Loading markets...</p>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <p class="text-destructive text-lg font-semibold">No markets available</p>
      <p class="mt-2 text-muted-foreground">Please check your configuration</p>
    </div>
  </div>
{/if}
