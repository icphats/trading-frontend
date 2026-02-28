<script lang="ts">
  /**
   * Market Selection Component - Symbol-Based URL Navigation
   * Shows full trading pairs (e.g., PARTY/ICP) with quote token tabs.
   *
   * Key features:
   * - Symbol-based URLs: /trade/{baseSymbol}/{quoteSymbol} (e.g., /trade/BOOM/ICP)
   * - Displays full pairs: BASE/QUOTE (e.g., PARTY/ICP, PARTY/USDC)
   * - Quote token tabs: ICP, USDC, USDT to filter pairs
   * - Uses entityStore for token lookups (symbols and logos)
   */

  import Logo from "$lib/components/ui/Logo.svelte";
  import TokenPairLogo from "$lib/components/ui/TokenPairLogo.svelte";
  import { TableCell, HeaderCell } from "$lib/components/ui/table";
  import { marketSelection } from "$lib/domain/markets";
  import { getMarketsForSearch } from "$lib/domain/orchestration";
  import { userPreferences } from "$lib/domain/user";
  import type { MarketListItem } from 'declarations/indexer/indexer.did';
  import { onMount } from "svelte";
  import { entityStore, type NormalizedMarket } from "$lib/domain/orchestration/entity-store.svelte";
  import { goto } from "$app/navigation";
  import { type QuoteTokenSymbol, normalizeQuoteSymbol, normalizeTokenSymbol } from "$lib/domain/markets";
  import { calculateMarketCapFloat } from "$lib/utils/market-cap.utils";
  import { formatMarketPrice, formatMarketVolume } from "$lib/utils/market.utils";
  import { formatSignedPercent } from "$lib/utils/format.utils";
  import { formatCompactUSD } from "$lib/utils/format.utils";
  import { lockScroll, unlockScroll } from "$lib/components/portal/modals/scroll-lock";
  import { marketItemToUpsert } from "$lib/repositories/indexer.repository";
  import { bpsToPercent } from "$lib/domain/markets/utils/math";
  import { ticker } from "$lib/domain/orchestration/ticker-action";
  import { createSearchState } from "$lib/domain/search";

  // ============================================
  // UI State
  // ============================================

  // Dropdown visibility
  let showMarketDropdown = $state(false);
  let buttonRef = $state<HTMLButtonElement | null>(null);
  let dropdownPosition = $state({ top: 0, left: 0, width: 0 });

  // Search state (shared hook with debounce + cancellation)
  const search = createSearchState({ filter: { markets: null } });
  let searchInputRef = $state<HTMLInputElement | null>(null);

  // Market data
  let spotMarkets = $state<MarketListItem[]>([]);
  let isLoadingMarkets = $state(false);
  let marketDataPrefetched = $state(false);

  // Sorting state (default: volume descending)
  type SortKey = 'price' | 'change' | 'mcap' | 'volume';
  type SortDirection = 'asc' | 'desc' | null;
  let sortKey = $state<SortKey | null>('volume');
  let sortDirection = $state<SortDirection>('desc');

  // ============================================
  // UI-Ready Market Type (Full Pair)
  // ============================================

  type UIMarket = {
    tradingCanisterId: string;
    quoteToken: QuoteTokenSymbol;
    pairSymbol: string; // e.g., "PARTY/ICP"
    baseSymbol: string; // e.g., "PARTY"
    quoteSymbol: string; // e.g., "ICP"
    name: string;
    marketType: "spot";
    baseLogo: string | undefined; // Use undefined for Logo component fallback
    quoteLogo: string | undefined; // Use undefined for Logo component fallback
    baseLedgerId: string | null; // Base token ledger for market cap lookup
    // Price and volume data from Indexer
    priceUsd: bigint; // E12 - price precision (12 decimals)
    priceChange24h: number; // percentage
    volume24h: bigint; // E6 - USD accumulator precision (6 decimals)
  };

  // ============================================
  // Get quote token logo from registry
  // ============================================

  function getQuoteTokenLogo(quote: QuoteTokenSymbol): string | undefined {
    // Map quote token to known ledger canister IDs
    const quoteTokenIds: Record<QuoteTokenSymbol, string> = {
      icp: "ryjl3-tyaaa-aaaaa-aaaba-cai", // ICP ledger
      usdc: "xevnm-gaaaa-aaaar-qafnq-cai", // ckUSDC ledger
      usdt: "cngnf-vqaaa-aaaar-qag4q-cai", // ckUSDT ledger
    };
    const token = entityStore.getToken(quoteTokenIds[quote]);
    return token?.logo ?? undefined;
  }

  // ============================================
  // Formatting Helpers
  // ============================================

  /**
   * Get market cap for a market from entityStore
   * Returns null if totalSupply not available yet
   */
  function getMarketCap(baseLedgerId: string | null, priceUsd: bigint): number | null {
    if (!baseLedgerId) return null;

    const token = entityStore.getToken(baseLedgerId);
    if (!token?.totalSupply) return null;

    const priceFloat = Number(priceUsd) / 1e12;
    return calculateMarketCapFloat(token.totalSupply, priceFloat, token.decimals);
  }

  function formatMarketCap(mcap: number | null): string {
    if (mcap === null || mcap === 0) return "—";
    return formatCompactUSD(mcap);
  }

  // ============================================
  // Column Width Constants
  // ============================================

  const COL_PAIR = 180;
  const COL_PRICE = 85;
  const COL_CHANGE = 85;
  const COL_VOLUME = 85;
  const COL_MCAP = 85;
  const COL_FAV = 32;

  // ============================================
  // Transform MarketListItem → UIMarket
  // Overlays entity store data (kept fresh by ticker/SpotMarket polling)
  // ============================================

  function toUIMarket(m: MarketListItem, liveMarkets: Map<string, NormalizedMarket>): UIMarket {
    const [rawBaseSymbol, rawQuoteSymbol] = m.symbol.split("/");
    const canisterId = m.canister_id.toString();
    const baseLedgerId = m.base_token.toString();

    const baseToken = entityStore.getToken(baseLedgerId);
    const quoteToken = entityStore.getToken(m.quote_token.toString());

    const baseSymbol = baseToken?.displaySymbol ?? rawBaseSymbol ?? "???";
    const quoteSymbol = quoteToken?.displaySymbol ?? rawQuoteSymbol ?? "ICP";
    const quoteTokenType = rawQuoteSymbol ? normalizeQuoteSymbol(rawQuoteSymbol) : null;

    // Entity store has fresher data from ticker polling
    const live = liveMarkets.get(canisterId);

    return {
      tradingCanisterId: canisterId,
      quoteToken: quoteTokenType ?? "icp",
      pairSymbol: `${baseSymbol}/${quoteSymbol}`,
      baseSymbol,
      quoteSymbol,
      name: baseToken?.name ?? baseSymbol,
      marketType: "spot",
      baseLogo: baseToken?.logo ?? undefined,
      quoteLogo: quoteToken?.logo ?? undefined,
      baseLedgerId,
      priceUsd: live?.lastTradePrice ?? m.last_price_usd_e12,
      priceChange24h: live?.priceChange24h ?? bpsToPercent(m.price_change_24h_bps),
      volume24h: live?.volume24h ?? m.volume_24h_usd_e6,
    };
  }

  // Reactive lookup map — re-derives when any market is updated by ticker
  let liveMarketMap = $derived(new Map(entityStore.allMarkets.map(m => [m.canisterId, m])));

  let allMarketsUI = $derived.by((): UIMarket[] => {
    return spotMarkets.map(m => toUIMarket(m, liveMarketMap));
  });

  // ============================================
  // Sorting
  // ============================================

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      // Cycle: asc -> desc -> null
      if (sortDirection === 'asc') {
        sortDirection = 'desc';
      } else if (sortDirection === 'desc') {
        sortDirection = null;
        sortKey = null;
      }
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  function getSortDirection(key: SortKey): SortDirection {
    return sortKey === key ? sortDirection : null;
  }

  // ============================================
  // Filtered markets based on search + sorting (hybrid: frontend + backend)
  // ============================================

  let filteredMarkets = $derived.by(() => {
    // Get active market to highlight and place at top
    const activeMarket = marketSelection.getActiveMarket();
    const activeId = activeMarket?.canister_id;

    // If no search query, return all markets with active at top
    if (!search.normalizedQuery) {
      return applySorting(allMarketsUI, activeId);
    }

    const query = search.normalizedQuery.toLowerCase();

    // 1. Frontend instant results (filter local markets)
    const frontendResults = allMarketsUI.filter(
      (m) =>
        m.pairSymbol.toLowerCase().includes(query) ||
        m.baseSymbol.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query)
    );

    // 2. Backend results (converted to UIMarket via shared transform)
    const backendUIMarkets: UIMarket[] = search.markets.map(m => toUIMarket(m, liveMarketMap));

    // 3. Merge and deduplicate (frontend first, backend fills gaps)
    const seen = new Set<string>();
    const merged: UIMarket[] = [];

    for (const market of frontendResults) {
      if (!seen.has(market.tradingCanisterId)) {
        seen.add(market.tradingCanisterId);
        merged.push(market);
      }
    }

    for (const market of backendUIMarkets) {
      if (!seen.has(market.tradingCanisterId)) {
        seen.add(market.tradingCanisterId);
        merged.push(market);
      }
    }

    return applySorting(merged, activeId);
  });

  /**
   * Apply sorting: active market first, then favorites, then by column or default (volume)
   * IMPORTANT: Create a new array to ensure reactivity - .sort() mutates in place
   */
  function applySorting(markets: UIMarket[], activeId?: string): UIMarket[] {
    return [...markets].sort((a, b) => {
      // Active market always comes first
      if (activeId) {
        const aIsActive = a.tradingCanisterId === activeId;
        const bIsActive = b.tradingCanisterId === activeId;
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
      }

      // Favorites come second
      const aIsFav = userPreferences.isFavoriteMarket(a.tradingCanisterId, a.quoteToken);
      const bIsFav = userPreferences.isFavoriteMarket(b.tradingCanisterId, b.quoteToken);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;

      // Apply column sort if active
      if (sortKey && sortDirection) {
        let aVal: number;
        let bVal: number;

        switch (sortKey) {
          case 'price':
            aVal = Number(a.priceUsd);
            bVal = Number(b.priceUsd);
            break;
          case 'change':
            aVal = a.priceChange24h;
            bVal = b.priceChange24h;
            break;
          case 'mcap':
            aVal = getMarketCap(a.baseLedgerId, a.priceUsd) ?? 0;
            bVal = getMarketCap(b.baseLedgerId, b.priceUsd) ?? 0;
            break;
          case 'volume':
            aVal = Number(a.volume24h);
            bVal = Number(b.volume24h);
            break;
        }

        if (sortDirection === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      }

      // Default: sort by volume descending
      if (a.volume24h > b.volume24h) return -1;
      if (a.volume24h < b.volume24h) return 1;
      return a.baseSymbol.localeCompare(b.baseSymbol);
    });
  }

  // ============================================
  // Current Market (Full Pair)
  // ============================================

  let currentMarketUI = $derived.by((): UIMarket | null => {
    const activeMarket = marketSelection.getActiveMarket();
    if (!activeMarket) return null;

    // Find market by canister ID (unique identifier)
    return allMarketsUI.find((m) => m.tradingCanisterId === activeMarket.canister_id) ?? null;
  });

  // ============================================
  // Market Selection
  // ============================================

  async function selectMarket(canisterId: string, baseSymbol: string, quoteSymbol: string) {
    try {
      // Set pending canister ID so trade page can skip indexer lookup
      marketSelection.setPendingNavigation(canisterId);

      // Normalize symbols (ckBTC -> btc, ckUSDT -> usdt)
      const normalizedBase = normalizeTokenSymbol(baseSymbol);
      const normalizedQuote = normalizeQuoteSymbol(quoteSymbol);
      if (!normalizedQuote) {
        console.error(`[MarketSelection] Invalid quote token: ${quoteSymbol}`);
        return;
      }

      // Navigate using symbol-based URL (human-readable)
      const url = `/trade/${normalizedBase}/${normalizedQuote}`;
      await goto(url);

      showMarketDropdown = false;
      search.reset();
      marketDataPrefetched = false;
      unlockScroll();
    } catch (err) {
      console.error("Failed to navigate to market:", err);
    }
  }

  function toggleFavorite(canisterId: string, quoteToken: QuoteTokenSymbol, event: Event) {
    event.stopPropagation();
    userPreferences.toggleFavoriteMarket(canisterId, quoteToken);
  }

  // ============================================
  // Data Loading
  // ============================================

  /**
   * Prefetch market list data on hover to show fresh data
   * Uses Indexer for price, 24h change, and volume data (sorted by volume)
   */
  async function prefetchMarketListData() {
    // Skip if already prefetched or currently loading
    if (marketDataPrefetched || isLoadingMarkets) return;

    marketDataPrefetched = true;
    isLoadingMarkets = true;

    try {
      const markets = await getMarketsForSearch(100n);
      spotMarkets = markets;

      // Seed entity store so ticker updates flow through reactively
      const upserts = markets.map(marketItemToUpsert);
      entityStore.upsertMarkets(upserts);
    } catch (err) {
      console.error("Failed to prefetch market list data:", err);
      marketDataPrefetched = false; // Reset on error
    } finally {
      isLoadingMarkets = false;
    }
  }

  // ============================================
  // Dropdown Management
  // ============================================

  function toggleDropdown() {
    if (!showMarketDropdown) {
      updateDropdownPosition();
      lockScroll();
    } else {
      unlockScroll();
    }
    showMarketDropdown = !showMarketDropdown;

    // Reset search when closing
    if (!showMarketDropdown) {
      search.reset();
      marketDataPrefetched = false;
    }
  }

  function updateDropdownPosition() {
    if (buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      };
    }
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      !target.closest(".market-selection-container") &&
      !target.closest(".market-dropdown")
    ) {
      showMarketDropdown = false;
      search.reset();
      marketDataPrefetched = false;
      unlockScroll();
    }
  }

  // Handle scroll to reposition dropdown
  function handleScroll() {
    if (showMarketDropdown) {
      updateDropdownPosition();
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  // Load markets on mount
  onMount(() => {
    prefetchMarketListData();
  });

  // Dropdown event handlers
  $effect(() => {
    if (showMarketDropdown) {
      document.addEventListener("click", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", updateDropdownPosition);

      // Auto-focus search input
      setTimeout(() => searchInputRef?.focus(), 50);

      return () => {
        document.removeEventListener("click", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", updateDropdownPosition);
      };
    }
  });
</script>

{#if currentMarketUI}
  <div class="market-selection-container relative h-full flex items-center">
    <button
      bind:this={buttonRef}
      class="flex items-center gap-3 h-full px-3 border-border text-foreground font-semibold text-xs transition-all duration-[var(--transition-price)] market-select-button whitespace-nowrap"
      onmouseenter={prefetchMarketListData}
      onclick={toggleDropdown}
    >
      <div class="flex items-center gap-2 market-select-inner">
        <TokenPairLogo
          baseLogo={currentMarketUI.baseLogo}
          quoteLogo={currentMarketUI.quoteLogo}
          baseSymbol={currentMarketUI.baseSymbol}
          quoteSymbol={currentMarketUI.quoteSymbol}
          size="xs"
        />
        <span class="font-semibold text-base market-select-pair">{currentMarketUI.pairSymbol}</span>
      </div>
      <svg
        class="w-3 h-3 ml-2 transition-transform duration-200 market-select-chevron"
        style="transform: rotate({showMarketDropdown ? '180deg' : '0deg'})"
        viewBox="0 0 12 12"
      >
        <path
          d="M2 4L6 8L10 4"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
{:else}
  <div class="market-selection-container relative h-full flex items-center px-3 border-border">
    <span class="text-muted-foreground text-xs">Loading markets...</span>
  </div>
{/if}

<!-- Dropdown portal - rendered at body level to escape overflow constraints -->
{#if showMarketDropdown}
  <div
    class="market-dropdown"
    style="position: fixed;
           top: {dropdownPosition.top}px;
           left: {dropdownPosition.left}px;
           width: 640px;
           z-index: var(--z-dropdown);"
  >
    <div class="dropdown-content">
      <!-- Search Section -->
      <div class="search-section" role="none" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="search-icon"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          bind:this={searchInputRef}
          bind:value={search.query}
          type="text"
          class="search-input"
          placeholder="Search markets..."
        />
        {#if search.query}
          <button class="clear-button" onclick={() => (search.query = "")} aria-label="Clear search">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>

      <!-- Column Headers (Fixed) -->
      <div class="market-list-header">
        <HeaderCell width={COL_PAIR} align="left" compact grow>Pair</HeaderCell>
        <HeaderCell width={COL_PRICE} compact sortable sortDirection={getSortDirection('price')} onSort={() => handleSort('price')}>Price</HeaderCell>
        <HeaderCell width={COL_CHANGE} compact sortable sortDirection={getSortDirection('change')} onSort={() => handleSort('change')}>24h</HeaderCell>
        <HeaderCell width={COL_VOLUME} compact sortable sortDirection={getSortDirection('volume')} onSort={() => handleSort('volume')}>Volume</HeaderCell>
        <HeaderCell width={COL_MCAP} compact sortable sortDirection={getSortDirection('mcap')} onSort={() => handleSort('mcap')}>MCap</HeaderCell>
        <HeaderCell width={COL_FAV} compact>&nbsp;</HeaderCell>
      </div>

      <!-- Markets List (Scrollable) -->
      <div class="results-container" role="none" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
        {#if isLoadingMarkets}
          <div class="loading-state">
            <p>Loading markets...</p>
          </div>
        {:else if filteredMarkets.length === 0}
          <div class="empty-state">
            {#if search.query}
              <p>No results found for "{search.query}"</p>
              <p class="hint">Try a different search term</p>
            {:else}
              <p>No markets available</p>
            {/if}
          </div>
        {:else}
          {#each filteredMarkets as market}
            {@const isPositive = market.priceChange24h >= 0}
            {@const isFavorite = userPreferences.isFavoriteMarket(market.tradingCanisterId, market.quoteToken)}
            {@const marketCap = getMarketCap(market.baseLedgerId, market.priceUsd)}
            {@const isActive = marketSelection.getActiveMarket()?.canister_id === market.tradingCanisterId}
            <div
              role="button"
              tabindex="0"
              class="market-row"
              class:active={isActive}
              use:ticker={market.tradingCanisterId}
              onclick={() => selectMarket(market.tradingCanisterId, market.baseSymbol, market.quoteSymbol)}
              onkeydown={(e) => e.key === 'Enter' && selectMarket(market.tradingCanisterId, market.baseSymbol, market.quoteSymbol)}
            >
              <TableCell width={COL_PAIR} align="left" compact grow>
                <div class="cell-pair">
                  <TokenPairLogo
                    baseLogo={market.baseLogo}
                    quoteLogo={market.quoteLogo}
                    baseSymbol={market.baseSymbol}
                    quoteSymbol={market.quoteSymbol}
                    size="xxs"
                  />
                  <span class="pair-symbol">{market.pairSymbol}</span>
                </div>
              </TableCell>
              <TableCell width={COL_PRICE} compact>
                {formatMarketPrice(market.priceUsd)}
              </TableCell>
              <TableCell width={COL_CHANGE} compact>
                <span class="price-change {isPositive ? 'positive' : 'negative'}">
                  {formatSignedPercent(market.priceChange24h)}
                </span>
              </TableCell>
              <TableCell width={COL_VOLUME} compact>
                <span class="volume-text">{formatMarketVolume(market.volume24h)}</span>
              </TableCell>
              <TableCell width={COL_MCAP} compact>
                <span class="mcap-text">{formatMarketCap(marketCap)}</span>
              </TableCell>
              <TableCell width={COL_FAV} compact>
                <button
                  class="fav-btn"
                  class:active={isFavorite}
                  onclick={(e) => toggleFavorite(market.tradingCanisterId, market.quoteToken, e)}
                  aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  {#if isFavorite}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  {/if}
                </button>
              </TableCell>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ============================================
     Market select button
     ============================================ */

  .market-select-button {
    min-height: 48px; /* Touch target minimum per 08-Responsive.md */
  }

  .market-select-button:hover {
    background: var(--hover-overlay);
  }

  @media (max-width: 480px) {
    .market-select-button {
      padding-inline: 0.375rem;
      gap: 0.25rem;
      min-height: 40px;
    }

    .market-select-inner {
      gap: 0.25rem;
    }

    .market-select-pair {
      font-size: 0.8125rem; /* 13px, down from 1rem */
    }

    .market-select-chevron {
      margin-left: 0.25rem;
    }
  }

  /* ============================================
     Market dropdown container
     ============================================ */

  .market-dropdown {
    display: flex;
    flex-direction: column;
    height: 435px;
    background: var(--background);
    border: 1px solid oklch(from var(--border) l c h / 0.8);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-elevated);
    overflow: hidden;
    animation: slideDown 0.2s ease-out;
  }

  .dropdown-content {
    display: flex;
    flex-direction: column;
    min-height: 0; /* Critical: allows flex child to shrink below content size */
    flex: 1;
  }

  /* ============================================
     Search Section
     ============================================ */

  .search-section {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--background);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0; /* Prevent search from shrinking */
    transition:
      border-color 200ms ease-out,
      box-shadow 200ms ease-out;
  }

  .search-section:hover {
    border-bottom-color: oklch(from var(--border) l c h / 0.55);
    box-shadow: 0 0 8px oklch(from var(--border) l c h / 0.15);
  }

  .search-section:focus-within {
    border-bottom-color: oklch(from var(--border) l c h / 0.7);
    box-shadow: 0 0 12px oklch(from var(--border) l c h / 0.25);
  }

  .search-icon {
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
    color: var(--foreground);
    font-family: var(--font-sans);
  }

  .search-input::placeholder {
    color: var(--muted-foreground);
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--muted-foreground);
    opacity: 0.6;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }

  .clear-button:hover {
    opacity: 1;
  }

  /* ============================================
     Market List Header (fixed)
     ============================================ */

  .market-list-header {
    display: flex;
    align-items: center;
    flex-shrink: 0; /* Prevent header from shrinking */
  }

  /* ============================================
     Results Container (scrollable)
     ============================================ */

  .results-container {
    flex: 1;
    min-height: 0; /* Critical: allows flex child to shrink and enable scrolling */
    overflow-y: auto;
    background: var(--background);
  }

  .results-container::-webkit-scrollbar {
    width: 4px;
  }

  .results-container::-webkit-scrollbar-track {
    background: oklch(from var(--background) calc(l * 1.1) c h / 1);
    border-radius: 2px;
  }

  .results-container::-webkit-scrollbar-thumb {
    background: oklch(from var(--card) calc(l * 1.3) c h / 1);
    border-radius: 2px;
  }

  .results-container::-webkit-scrollbar-thumb:hover {
    background: oklch(from var(--card) calc(l * 1.5) c h / 1);
  }

  /* ============================================
     Market Row
     ============================================ */

  .market-row {
    display: flex;
    align-items: center;
    width: 100%;
    cursor: pointer;
    border-bottom: 1px solid oklch(from var(--border) l c h / 0.3);
    transition: background-color 0ms;
  }

  .market-row:last-child {
    border-bottom: none;
  }

  .market-row:hover {
    background: var(--hover-overlay-strong);
  }

  .market-row.active {
    background: var(--hover-overlay-strong);
    border-left: 2px solid var(--primary);
  }

  .market-row.active:hover {
    background: var(--hover-overlay-strong);
  }

  /* ============================================
     Cell Content
     ============================================ */

  .cell-pair {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .pair-symbol {
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .price-change {
    font-weight: 500;
  }

  .price-change.positive {
    color: var(--color-bullish, #22c55e);
  }

  .price-change.negative {
    color: var(--color-bearish, #ef4444);
  }

  .volume-text,
  .mcap-text {
    color: var(--muted-foreground);
  }

  /* ============================================
     Favorite Button
     ============================================ */

  .fav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--muted-foreground);
    opacity: 0.4;
    transition: all 0.15s ease;
  }

  .fav-btn:hover {
    opacity: 1;
    background: var(--hover-overlay);
  }

  .fav-btn.active {
    color: var(--yellow-500, #eab308);
    opacity: 1;
  }

  .fav-btn.active:hover {
    opacity: 0.8;
  }

  /* ============================================
     States (Loading/Empty)
     ============================================ */

  .loading-state,
  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
  }

  .loading-state p,
  .empty-state p {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    margin: 0;
  }

  .empty-state .hint {
    font-size: 0.625rem;
    margin-top: 0.5rem;
    opacity: 0.7;
  }

  /* ============================================
     Animation
     ============================================ */

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
