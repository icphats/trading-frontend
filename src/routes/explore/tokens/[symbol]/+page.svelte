<script lang="ts">
  /**
   * Explore Token Page - Symbol-Based Resolution
   * Route: /explore/tokens/{symbol}
   *
   * Resolves token from URL symbol (e.g., /explore/tokens/btc).
   * Supports backward-compat redirect from canister IDs.
   */

  import TokenDetail from '$lib/components/explore/TokenDetail.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { denormalizeTokenSymbol, normalizeTokenSymbol } from '$lib/domain/markets';
  import { indexerRepository, tokenItemToUpsert } from '$lib/repositories/indexer.repository';

  const symbol = $derived(page.params.symbol as string);

  let ledger = $state<string | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let loadedSymbol = $state<string | null>(null);

  /**
   * Check if a string looks like a canister ID (e.g., mxzaz-hqaaa-aaaar-qaada-cai)
   */
  function looksLikeCanisterId(s: string): boolean {
    return /^[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{3}$/.test(s);
  }

  async function resolveToken() {
    const currentSymbol = symbol;
    if (loadedSymbol === currentSymbol && !isLoading) return;

    isLoading = true;
    error = null;

    // Backward compat: redirect canister IDs to symbol-based URL
    if (looksLikeCanisterId(currentSymbol)) {
      const token = entityStore.getToken(currentSymbol);
      if (token) {
        const normalized = normalizeTokenSymbol(token.displaySymbol);
        await goto(`/explore/tokens/${normalized}`, { replaceState: true });
        return;
      }
      // If not in entityStore, try indexer search
      const result = await indexerRepository.search(currentSymbol, 1n, { tokens: null });
      if ('ok' in result && result.ok.tokens.length > 0) {
        const found = result.ok.tokens[0];
        const normalized = normalizeTokenSymbol(found.symbol);
        await goto(`/explore/tokens/${normalized}`, { replaceState: true });
        return;
      }
      error = 'Token not found';
      isLoading = false;
      return;
    }

    // Normal flow: resolve symbol to ledger canisterId
    const denormalized = denormalizeTokenSymbol(currentSymbol); // btc → ckbtc

    // Fast path: entityStore lookup
    const token = entityStore.getTokenBySymbol(denormalized);
    if (token) {
      ledger = token.canisterId;
      loadedSymbol = currentSymbol;
      isLoading = false;
      return;
    }

    // Fallback: indexer search (cold load)
    try {
      const result = await indexerRepository.search(denormalized, 10n, { tokens: null });
      if ('ok' in result) {
        const match = result.ok.tokens.find(
          (t) => t.symbol.toLowerCase() === denormalized.toLowerCase()
        );
        if (match) {
          entityStore.upsertToken(tokenItemToUpsert(match));
          ledger = match.token_ledger.toString();
          loadedSymbol = currentSymbol;
          isLoading = false;
          return;
        }
      }
    } catch (err) {
      console.error('[Explore Token] Indexer search failed:', err);
    }

    error = 'Token not found';
    isLoading = false;
  }

  // React to URL param changes
  $effect(() => {
    const _s = symbol;
    resolveToken();
  });

  // Re-resolve when entityStore hydrates (tokens may appear after initial load)
  $effect(() => {
    if (!ledger && !error && symbol) {
      const denormalized = denormalizeTokenSymbol(symbol);
      const token = entityStore.getTokenBySymbol(denormalized);
      if (token) {
        ledger = token.canisterId;
        loadedSymbol = symbol;
        isLoading = false;
      }
    }
  });
</script>

{#if error}
  <div class="resolve-state">
    <p class="error-text">{error}</p>
    <p class="error-detail">Could not find token "{symbol}"</p>
  </div>
{:else if isLoading || !ledger}
  <div class="resolve-state">
    <div class="spinner"></div>
    <p class="loading-text">Loading {symbol}...</p>
  </div>
{:else}
  <TokenDetail {ledger} />
{/if}

<style>
  .resolve-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60vh;
    gap: 8px;
  }

  .error-text {
    color: var(--destructive);
    font-size: 18px;
    font-weight: 600;
  }

  .error-detail {
    color: var(--muted-foreground);
    font-size: 14px;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 2px solid transparent;
    border-bottom-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    color: var(--muted-foreground);
    margin-top: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
