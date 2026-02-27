import { Principal } from "@icp-sdk/core/principal";
import { untrack } from "svelte";
import { entityStore } from "$lib/domain/orchestration";
import { indexerRepository, tokenItemToUpsert, marketItemToUpsert, type SearchFilter } from "$lib/repositories/indexer.repository";
import type { MarketListItem, TokenListItem } from 'declarations/indexer/indexer.did';

export interface SearchStateOptions {
  filter: SearchFilter;
  limit?: bigint;
  debounceMs?: number;
  minChars?: number;
}

export function createSearchState(options: SearchStateOptions) {
  const {
    filter,
    limit = 20n,
    debounceMs = 250,
    minChars = 2,
  } = options;

  // ---- bindable raw input ----
  let query = $state("");

  // ---- derived ----
  let normalizedQuery = $derived(query.trim());
  let isSearching = $derived(normalizedQuery.length > 0);

  let isPrincipal = $derived.by(() => {
    try {
      Principal.fromText(normalizedQuery);
      return true;
    } catch {
      return false;
    }
  });

  // ---- backend results ----
  let tokens = $state<TokenListItem[]>([]);
  let markets = $state<MarketListItem[]>([]);
  let isLoading = $state(false);

  // ---- internal debounce state ----
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- debounced backend search effect ----
  $effect(() => {
    // Read reactive deps
    const q = normalizedQuery;
    const principal = isPrincipal;

    // Clear previous timer on every keystroke
    clearTimeout(debounceTimer);

    // Principal queries are handled by the consumer, not here
    if (principal) {
      if (tokens.length > 0) tokens = [];
      if (markets.length > 0) markets = [];
      isLoading = false;
      return;
    }

    // Below minChars — clear results immediately (no debounce)
    if (q.length < minChars) {
      if (tokens.length > 0) tokens = [];
      if (markets.length > 0) markets = [];
      isLoading = false;
      return;
    }

    // Set loading immediately so the UI can show a spinner
    isLoading = true;

    debounceTimer = setTimeout(() => {
      // Fire the actual backend search
      (async () => {
        try {
          const result = await indexerRepository.search(q, limit, filter, true);

          // Stale-query guard: if query changed while awaiting, discard
          if (normalizedQuery !== q) return;

          if ("ok" in result) {
            const { tokens: t, markets: m } = result.ok;

            // Seed entity store (wrapped in untrack to avoid cascading reactivity)
            untrack(() => {
              if (t.length > 0) entityStore.upsertTokens(t.map(tokenItemToUpsert));
              if (m.length > 0) entityStore.upsertMarkets(m.map(marketItemToUpsert));
            });

            tokens = t;
            markets = m;
          } else {
            console.error("Backend search failed:", result.err);
            tokens = [];
            markets = [];
          }
        } catch (error) {
          if (normalizedQuery === q) {
            console.error("Backend search error:", error);
            tokens = [];
            markets = [];
          }
        } finally {
          if (normalizedQuery === q) {
            isLoading = false;
          }
        }
      })();
    }, debounceMs);

    // Cleanup: cancel timer when effect re-runs or component unmounts
    return () => {
      clearTimeout(debounceTimer);
    };
  });

  function reset() {
    clearTimeout(debounceTimer);
    query = "";
    tokens = [];
    markets = [];
    isLoading = false;
  }

  return {
    get query() { return query; },
    set query(v: string) { query = v; },
    get normalizedQuery() { return normalizedQuery; },
    get isPrincipal() { return isPrincipal; },
    get isSearching() { return isSearching; },
    get isLoading() { return isLoading; },
    get tokens() { return tokens; },
    get markets() { return markets; },
    reset,
  };
}
