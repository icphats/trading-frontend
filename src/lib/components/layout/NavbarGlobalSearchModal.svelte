<script lang="ts">
  import { Principal } from "@icp-sdk/core/principal";
  import { goto } from "$app/navigation";
  import { untrack } from "svelte";
  import {
    entityStore,
    discoverToken,
    getMarketsForSearch,
    type NormalizedToken,
    type NormalizedMarket,
  } from "$lib/domain/orchestration";
  import { userPreferences } from "$lib/domain/user";
  import { marketItemToUpsert } from "$lib/repositories/indexer.repository";
  import type { MarketListItem } from 'declarations/indexer/indexer.did';
  import { bpsToPercent } from "$lib/domain/markets/utils/math";
  import { normalizeTokenSymbol, normalizeQuoteSymbol, CK_DISPLAY_NAMES } from "$lib/domain/markets";
  import { marketSelection } from "$lib/domain/markets";
  import { createSearchState } from "$lib/domain/search";
  import { formatVolumeFloat } from "$lib/utils/market.utils";

  /** Normalize raw symbol for display (ckBTC → BTC, PARTY → PARTY) */
  function displaySymbol(raw: string): string {
    return normalizeTokenSymbol(raw).toUpperCase();
  }

  /** Normalize raw name for display (Chain Key USDT → Tether USD) */
  function displayName(raw: string, rawSymbol: string): string {
    const normalized = normalizeTokenSymbol(rawSymbol).toLowerCase();
    return CK_DISPLAY_NAMES[normalized] ?? raw;
  }
  import { ticker, tokenTicker } from "$lib/domain/orchestration/ticker-action";
  import { SearchInput, SectionHeader, EmptyState, UnifiedListRow } from "$lib/components/ui";
  import Modal from "$lib/components/portal/modals/Modal.svelte";

  // Default quote token for market favorites
  const ICP_QUOTE = "icp";
  const COLLAPSED_LIMIT = 3;

  // ============================================
  // UI-Ready Types
  // ============================================

  type UIToken = {
    canisterId: string;
    symbol: string;
    name: string;
    logo: string | null;
    decimals: number;
    fee: bigint;
    priceUsd: number;
    priceChange24h: number;
    volume24h: number;
  };

  type UIMarket = {
    tradingCanisterId: string;
    symbol: string;
    name: string;
    marketType: "spot";
    logoSrc: string;
    baseLogo?: string;
    quoteLogo?: string;
    baseSymbol?: string;
    quoteSymbol?: string;
    priceUsd: number;
    priceChange24h: number;
    volume24h: number;
  };

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open = $bindable(false), onClose }: Props = $props();

  // ============================================
  // State
  // ============================================

  // Shared search state with debounce + cancellation
  const search = createSearchState({ filter: { all: null } });

  // Expand state for sections
  let tokensExpanded = $state(false);
  let marketsExpanded = $state(false);

  // Token data
  let fetchedToken = $state<NormalizedToken | null>(null);
  let isLoadingToken = $state(false);

  // Market data (from Indexer - includes price/volume)
  let spotMarkets = $state<MarketListItem[]>([]);
  let isLoadingMarkets = $state(false);

  // ============================================
  // All Tokens (platform-wide from entityStore)
  // ============================================

  const platformTokens = $derived.by((): UIToken[] => {
    return entityStore.allTokens
      .map((t): UIToken => ({
        canisterId: t.canisterId,
        symbol: t.displaySymbol,
        name: t.displayName,
        logo: t.logo,
        decimals: t.decimals,
        fee: t.fee,
        priceUsd: Number(t.priceUsd) / 1e12, // E12 per 06-Precision.md
        priceChange24h: t.priceChange24h,
        volume24h: Number(t.volume24h) / 1e6, // E6 - USD accumulator precision
      }))
      .sort((a, b) => b.volume24h - a.volume24h); // Sort by volume
  });

  // ============================================
  // All Markets (source data)
  // ============================================

  // Live market data from entity store (reactive — updates when ticker or SpotMarket writes)
  let liveMarketMap = $derived(
    new Map(entityStore.allMarkets.map((m) => [m.canisterId, m]))
  );

  let allMarketsUI = $derived.by((): UIMarket[] => {
    return spotMarkets.map((m) => {
      const canisterId = m.canister_id.toString();
      // Parse raw symbol from backend (e.g., "ckBTC/ckUSDT")
      const [rawBaseSymbol, rawQuoteSymbol] = m.symbol.split("/");

      // Use canonical principals for token lookups
      const baseToken = entityStore.getToken(m.base_token.toString());
      const quoteToken = entityStore.getToken(m.quote_token.toString());

      const baseSymbol = baseToken?.displaySymbol ?? (rawBaseSymbol ? displaySymbol(rawBaseSymbol) : "???");
      const quoteSymbol = quoteToken?.displaySymbol ?? (rawQuoteSymbol ? displaySymbol(rawQuoteSymbol) : "ICP");
      const pairSymbol = `${baseSymbol}/${quoteSymbol}`;
      const baseLogo = baseToken?.logo ?? undefined;

      // Overlay entity store live data (falls back to indexer snapshot)
      const live = liveMarketMap.get(canisterId);

      return {
        tradingCanisterId: canisterId,
        symbol: pairSymbol,
        name: baseToken?.displayName ?? baseSymbol,
        marketType: "spot" as const,
        logoSrc: baseLogo ?? "",
        baseLogo: baseLogo,
        quoteLogo: quoteToken?.logo ?? undefined,
        baseSymbol: baseSymbol,
        quoteSymbol: quoteSymbol,
        priceUsd: live?.lastTradePrice ? Number(live.lastTradePrice) / 1e12 : Number(m.last_price_usd_e12) / 1e12,
        priceChange24h: live?.priceChange24h ?? bpsToPercent(m.price_change_24h_bps),
        volume24h: live?.volume24h ? Number(live.volume24h) / 1e6 : Number(m.volume_24h_usd_e6) / 1e6,
      };
    });
  });

  // ============================================
  // Favorites Section
  // ============================================

  // Favorite tokens with full data
  let favoriteTokens = $derived.by((): UIToken[] => {
    return platformTokens.filter(t => userPreferences.isFavorite(t.canisterId));
  });

  // Favorite markets with full data
  let favoriteMarkets = $derived.by((): UIMarket[] => {
    return allMarketsUI.filter(m =>
      userPreferences.isFavoriteMarket(m.tradingCanisterId, ICP_QUOTE)
    );
  });

  // Combined favorites count
  let totalFavorites = $derived(favoriteTokens.length + favoriteMarkets.length);

  // ============================================
  // Recent Items Section
  // ============================================

  type RecentDisplayItem =
    | { type: 'token'; data: UIToken }
    | { type: 'market'; data: UIMarket };

  // Map recentItems to actual UI data
  let recentDisplayItems = $derived.by((): RecentDisplayItem[] => {
    return userPreferences.recentItems
      .map((item): RecentDisplayItem | null => {
        if (item.type === 'token') {
          const token = platformTokens.find(t => t.canisterId === item.id);
          if (!token) return null;
          return { type: 'token', data: token };
        } else {
          // Parse market ID: "canisterId:quoteToken"
          const parsed = userPreferences.parseMarketId(item.id);
          if (!parsed) return null;
          const market = allMarketsUI.find(m => m.tradingCanisterId === parsed.canisterId);
          if (!market) return null;
          return { type: 'market', data: market };
        }
      })
      .filter((item): item is RecentDisplayItem => item !== null);
  });

  // Should show recent section (only when browsing, has items)
  let showRecent = $derived(!search.isSearching && recentDisplayItems.length > 0);

  // ============================================
  // Filtered Results (hybrid: frontend + backend)
  // ============================================

  const filteredTokens = $derived.by((): UIToken[] => {
    if (!search.query) return platformTokens;

    // If it's a Principal ID, show the fetched token
    if (search.isPrincipal && fetchedToken) {
      return [{
        canisterId: fetchedToken.canisterId,
        symbol: fetchedToken.displaySymbol,
        name: fetchedToken.displayName,
        logo: fetchedToken.logo,
        decimals: fetchedToken.decimals,
        fee: fetchedToken.fee,
        priceUsd: Number(fetchedToken.priceUsd) / 1e12, // E12 per 06-Precision.md
        priceChange24h: fetchedToken.priceChange24h,
        volume24h: Number(fetchedToken.volume24h) / 1e6, // E6 - USD accumulator precision
      }];
    }

    const query = search.normalizedQuery.toLowerCase();

    // 1. Frontend instant results (filter entityStore tokens)
    const frontendResults = platformTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.canisterId.toLowerCase().includes(query)
    );

    // 2. Backend results (converted to UIToken)
    const backendUITokens: UIToken[] = search.tokens.map((t) => {
      const ledgerId = t.token_ledger.toString();
      const storeToken = entityStore.getToken(ledgerId);
      return {
        canisterId: ledgerId,
        symbol: storeToken?.displaySymbol ?? displaySymbol(t.symbol),
        name: storeToken?.displayName ?? displayName(t.name, t.symbol),
        logo: storeToken?.logo ?? null,
        decimals: t.decimals,
        fee: 0n, // Not returned by search
        priceUsd: Number(t.current_price_usd_e12) / 1e12, // E12 - price precision
        priceChange24h: bpsToPercent(t.price_change_24h_bps),
        volume24h: Number(t.volume_24h_usd_e6) / 1e6, // E6 - USD accumulator precision
      };
    });

    // 3. Merge and deduplicate (frontend first, backend fills gaps)
    const seen = new Set<string>();
    const merged: UIToken[] = [];

    for (const token of frontendResults) {
      if (!seen.has(token.canisterId)) {
        seen.add(token.canisterId);
        merged.push(token);
      }
    }

    for (const token of backendUITokens) {
      if (!seen.has(token.canisterId)) {
        seen.add(token.canisterId);
        merged.push(token);
      }
    }

    // Sort by volume
    return merged.sort((a, b) => b.volume24h - a.volume24h);
  });

  const filteredMarkets = $derived.by((): UIMarket[] => {
    if (!search.query) return allMarketsUI;

    const query = search.normalizedQuery.toLowerCase();

    // 1. Frontend instant results
    const frontendResults = allMarketsUI.filter(
      (m) =>
        m.symbol.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)
    );

    // 2. Backend results (converted to UIMarket, with entity store overlay)
    const backendUIMarkets: UIMarket[] = search.markets.map((m) => {
      const canisterId = m.canister_id.toString();
      const [rawBaseSymbol, rawQuoteSymbol] = m.symbol.split("/");
      const baseToken = entityStore.getToken(m.base_token.toString());
      const quoteToken = entityStore.getToken(m.quote_token.toString());

      const baseSymbol = baseToken?.displaySymbol ?? (rawBaseSymbol ? displaySymbol(rawBaseSymbol) : "???");
      const quoteSymbol = quoteToken?.displaySymbol ?? (rawQuoteSymbol ? displaySymbol(rawQuoteSymbol) : "ICP");
      const pairSymbol = `${baseSymbol}/${quoteSymbol}`;
      const baseLogo = baseToken?.logo ?? undefined;

      const live = liveMarketMap.get(canisterId);

      return {
        tradingCanisterId: canisterId,
        symbol: pairSymbol,
        name: baseToken?.displayName ?? baseSymbol,
        marketType: "spot" as const,
        logoSrc: baseLogo ?? "",
        baseLogo: baseLogo,
        quoteLogo: quoteToken?.logo ?? undefined,
        baseSymbol: baseSymbol,
        quoteSymbol: quoteSymbol,
        priceUsd: live?.lastTradePrice ? Number(live.lastTradePrice) / 1e12 : Number(m.last_price_usd_e12) / 1e12,
        priceChange24h: live?.priceChange24h ?? bpsToPercent(m.price_change_24h_bps),
        volume24h: live?.volume24h ? Number(live.volume24h) / 1e6 : Number(m.volume_24h_usd_e6) / 1e6,
      };
    });

    // 3. Merge and deduplicate
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

    // Sort by volume
    return merged.sort((a, b) => b.volume24h - a.volume24h);
  });

  // ============================================
  // Display Logic (search + expand)
  // ============================================

  // Tokens to display (excludes favorites to avoid duplicates)
  let displayedTokens = $derived.by((): UIToken[] => {
    // When searching, show all filtered results
    if (search.isSearching) return filteredTokens;

    // When browsing, exclude favorites and apply limit
    const nonFavorites = platformTokens.filter(t => !userPreferences.isFavorite(t.canisterId));
    if (tokensExpanded) return nonFavorites;
    return nonFavorites.slice(0, COLLAPSED_LIMIT);
  });

  // Markets to display (excludes favorites to avoid duplicates)
  let displayedMarkets = $derived.by((): UIMarket[] => {
    // When searching, show all filtered results
    if (search.isSearching) return filteredMarkets;

    // When browsing, exclude favorites and apply limit
    const nonFavorites = allMarketsUI.filter(m =>
      !userPreferences.isFavoriteMarket(m.tradingCanisterId, ICP_QUOTE)
    );
    if (marketsExpanded) return nonFavorites;
    return nonFavorites.slice(0, COLLAPSED_LIMIT);
  });

  // Total non-favorite counts for "show more" buttons
  let totalNonFavoriteTokens = $derived(
    platformTokens.filter(t => !userPreferences.isFavorite(t.canisterId)).length
  );
  let totalNonFavoriteMarkets = $derived(
    allMarketsUI.filter(m => !userPreferences.isFavoriteMarket(m.tradingCanisterId, ICP_QUOTE)).length
  );

  // Show "expand" buttons
  let showTokensExpand = $derived(!search.isSearching && totalNonFavoriteTokens > COLLAPSED_LIMIT);
  let showMarketsExpand = $derived(!search.isSearching && totalNonFavoriteMarkets > COLLAPSED_LIMIT);

  // Should show favorites section (always when browsing, hide when searching)
  let showFavorites = $derived(!search.isSearching);

  // Total results for empty state
  let totalResults = $derived.by(() => {
    if (search.isSearching) {
      return filteredTokens.length + filteredMarkets.length;
    }
    return totalFavorites + displayedTokens.length + displayedMarkets.length;
  });

  // ============================================
  // Data Loading
  // ============================================

  async function loadMarkets() {
    if (isLoadingMarkets) return;
    isLoadingMarkets = true;

    try {
      const markets = await getMarketsForSearch(100n);
      spotMarkets = markets;
      // Seed entity store so ticker updates flow through
      const upserts = markets.map(marketItemToUpsert);
      entityStore.upsertMarkets(upserts);
    } catch (err) {
      console.error("Failed to load markets:", err);
    } finally {
      isLoadingMarkets = false;
    }
  }

  // ============================================
  // Dynamic Token Fetching (Principal lookup)
  // ============================================

  $effect(() => {
    if (!search.isPrincipal) {
      fetchedToken = null;
      return;
    }

    const query = search.normalizedQuery;
    isLoadingToken = true;

    (async () => {
      try {
        const principal = Principal.fromText(query);
        const ledgerCanisterId = principal.toText();
        const token = await discoverToken(ledgerCanisterId);

        if (search.normalizedQuery !== query) return;
        fetchedToken = token;
        isLoadingToken = false;
      } catch (error) {
        if (search.normalizedQuery === query) {
          console.error("Failed to fetch ICRC-1 metadata:", error);
          fetchedToken = null;
          isLoadingToken = false;
        }
      }
    })();
  });

  // ============================================
  // Action Handlers
  // ============================================

  async function handleTokenSelect(canisterId: string) {
    // Track for recent items
    userPreferences.trackRecentToken(canisterId);
    // Resolve symbol for clean URL
    const token = entityStore.getToken(canisterId);
    const symbol = token ? normalizeTokenSymbol(token.displaySymbol) : canisterId;
    await goto(`/explore/tokens/${symbol}`);
    handleClose();
  }

  async function handleMarketSelect(canisterId: string, symbol: string) {
    // Track for recent items
    userPreferences.trackRecentMarket(canisterId, ICP_QUOTE);

    // Parse symbol (e.g., "BTC/USDT" or "ckBTC/ckUSDT")
    const [rawBase, rawQuote] = symbol.split("/");
    if (rawBase && rawQuote) {
      // Normalize symbols for URL routing (ckBTC → btc, ckUSDT → usdt)
      const normalizedBase = normalizeTokenSymbol(rawBase);
      const normalizedQuote = normalizeQuoteSymbol(rawQuote);

      if (normalizedQuote) {
        // Set pending canister ID so trade page can skip indexer lookup
        marketSelection.setPendingNavigation(canisterId);
        await goto(`/trade/${normalizedBase}/${normalizedQuote}`);
      } else {
        // Quote token not recognized - navigate with normalized base and raw quote lowercase
        marketSelection.setPendingNavigation(canisterId);
        await goto(`/trade/${normalizedBase}/${rawQuote.toLowerCase()}`);
      }
    }
    handleClose();
  }

  function handleClose() {
    open = false;
    search.reset();
    fetchedToken = null;
    tokensExpanded = false;
    marketsExpanded = false;
    onClose?.();
  }

  // ============================================
  // Favorite Handlers
  // ============================================

  function handleTokenFavorite(canisterId: string) {
    userPreferences.toggleFavorite(canisterId);
  }

  function handleMarketFavorite(canisterId: string) {
    userPreferences.toggleFavoriteMarket(canisterId, ICP_QUOTE);
  }

  function handleClearRecent() {
    userPreferences.clearRecentItems();
  }

  // ============================================
  // Lifecycle
  // ============================================

  $effect(() => {
    if (open) {
      untrack(() => loadMarkets());
    }
  });
</script>

<Modal bind:open onClose={handleClose} showHeader={false} size="sm" customClass="global-search-modal" closeOnBackdrop={true} contentPadding={false}>
  {#snippet children()}
    <div class="modal-search-body">
      <!-- Search Input -->
      <SearchInput
        bind:value={search.query}
        placeholder="Search tokens and markets"
        autofocus
      />

      <!-- Results -->
      <div class="modal-search-list">
        {#if isLoadingToken && search.isPrincipal}
          <EmptyState variant="loading" message="Loading token metadata..." />
        {:else if search.isSearching && totalResults === 0}
          <EmptyState
            variant="empty"
            message="No results found"
            hint={search.isPrincipal ? undefined : "Try entering a Principal ID to add a new token"}
          />
        {:else}
          <!-- Recent Section (compact pills) -->
          {#if showRecent}
            <div class="recent-section">
              <div class="recent-header">
                <span class="recent-label">Recent</span>
                <button class="clear-button" onclick={handleClearRecent}>Clear</button>
              </div>
              <div class="recent-pills">
                {#each recentDisplayItems as item}
                  {#if item.type === 'token'}
                    <button class="recent-pill" onclick={() => handleTokenSelect(item.data.canisterId)}>
                      {#if item.data.logo}
                        <img src={item.data.logo} alt="" class="pill-logo" />
                      {:else}
                        <div class="pill-logo-placeholder">{item.data.symbol.charAt(0)}</div>
                      {/if}
                      <span class="pill-symbol">{item.data.symbol}</span>
                    </button>
                  {:else}
                    <button class="recent-pill" onclick={() => handleMarketSelect(item.data.tradingCanisterId, item.data.symbol)}>
                      <div class="pill-pair-logos">
                        {#if item.data.baseLogo}
                          <img src={item.data.baseLogo} alt="" class="pill-logo-small" />
                        {:else}
                          <div class="pill-logo-placeholder-small">{item.data.baseSymbol?.charAt(0) ?? "?"}</div>
                        {/if}
                        {#if item.data.quoteLogo}
                          <img src={item.data.quoteLogo} alt="" class="pill-logo-small pill-logo-overlap" />
                        {:else}
                          <div class="pill-logo-placeholder-small pill-logo-overlap">{item.data.quoteSymbol?.charAt(0) ?? "?"}</div>
                        {/if}
                      </div>
                      <span class="pill-symbol">{item.data.baseSymbol}/{item.data.quoteSymbol}</span>
                    </button>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <!-- Favorites Section (only when browsing and has favorites) -->
          {#if showFavorites && totalFavorites > 0}
            <SectionHeader label="Favorites" count={totalFavorites} />

            <!-- Favorite Tokens -->
            {#each favoriteTokens as token (token.canisterId)}
              <UnifiedListRow
                type="token"
                id={token.canisterId}
                logo={token.logo}
                primaryLabel={token.symbol}
                secondaryLabel={token.name}
                price={token.priceUsd}
                priceChange={token.priceChange24h}
                showPrice
                showPriceChange
                isFavorite={true}
                onClick={() => handleTokenSelect(token.canisterId)}
                onFavorite={() => handleTokenFavorite(token.canisterId)}
                logoSize="md"
              />
            {/each}

            <!-- Favorite Markets -->
            {#each favoriteMarkets as market (market.tradingCanisterId)}
              <div use:ticker={market.tradingCanisterId} style="display:contents">
                <UnifiedListRow
                  type="market"
                  id={market.tradingCanisterId}
                  pairLogos={{ base: market.baseLogo, quote: market.quoteLogo }}
                  pairSymbols={{ base: market.baseSymbol ?? "", quote: market.quoteSymbol ?? "" }}
                  primaryLabel={market.baseSymbol && market.quoteSymbol ? `${market.baseSymbol}/${market.quoteSymbol}` : market.symbol}
                  secondaryLabel="Vol {formatVolumeFloat(market.volume24h)}"
                  price={market.priceUsd}
                  priceChange={market.priceChange24h}
                  showPrice
                  showPriceChange
                  isFavorite={true}
                  onClick={() => handleMarketSelect(market.tradingCanisterId, market.symbol)}
                  onFavorite={() => handleMarketFavorite(market.tradingCanisterId)}
                  logoSize="sm"
                />
              </div>
            {/each}
          {/if}

          <!-- Tokens Section -->
          {#if displayedTokens.length > 0}
            <SectionHeader label="Tokens" count={search.isSearching ? filteredTokens.length : totalNonFavoriteTokens} />
            {#each displayedTokens as token (token.canisterId)}
              <div use:tokenTicker={token.canisterId} style="display:contents">
                <UnifiedListRow
                  type="token"
                  id={token.canisterId}
                  logo={token.logo}
                  primaryLabel={token.symbol}
                  secondaryLabel={token.name}
                  price={token.priceUsd}
                  priceChange={token.priceChange24h}
                  showPrice
                  showPriceChange
                  isFavorite={userPreferences.isFavorite(token.canisterId)}
                  onClick={() => handleTokenSelect(token.canisterId)}
                  onFavorite={() => handleTokenFavorite(token.canisterId)}
                  logoSize="md"
                />
              </div>
            {/each}

            {#if showTokensExpand}
              <button class="expand-button" onclick={() => tokensExpanded = !tokensExpanded}>
                {#if tokensExpanded}
                  Show less
                {:else}
                  Show {totalNonFavoriteTokens - COLLAPSED_LIMIT} more
                {/if}
              </button>
            {/if}
          {/if}

          <!-- Markets Section -->
          {#if displayedMarkets.length > 0}
            <SectionHeader label="Markets" count={search.isSearching ? filteredMarkets.length : totalNonFavoriteMarkets} />
            {#each displayedMarkets as market (market.tradingCanisterId)}
              <div use:ticker={market.tradingCanisterId} style="display:contents">
                <UnifiedListRow
                  type="market"
                  id={market.tradingCanisterId}
                  pairLogos={{ base: market.baseLogo, quote: market.quoteLogo }}
                  pairSymbols={{ base: market.baseSymbol ?? "", quote: market.quoteSymbol ?? "" }}
                  primaryLabel={market.baseSymbol && market.quoteSymbol ? `${market.baseSymbol}/${market.quoteSymbol}` : market.symbol}
                  secondaryLabel="Vol {formatVolumeFloat(market.volume24h)}"
                  price={market.priceUsd}
                  priceChange={market.priceChange24h}
                  showPrice
                  showPriceChange
                  isFavorite={userPreferences.isFavoriteMarket(market.tradingCanisterId, ICP_QUOTE)}
                  onClick={() => handleMarketSelect(market.tradingCanisterId, market.symbol)}
                  onFavorite={() => handleMarketFavorite(market.tradingCanisterId)}
                  logoSize="sm"
                />
              </div>
            {/each}

            {#if showMarketsExpand}
              <button class="expand-button" onclick={() => marketsExpanded = !marketsExpanded}>
                {#if marketsExpanded}
                  Show less
                {:else}
                  Show {totalNonFavoriteMarkets - COLLAPSED_LIMIT} more
                {/if}
              </button>
            {/if}
          {/if}
        {/if}
      </div>
    </div>
  {/snippet}
</Modal>


<style>
  :global(.global-search-modal) {
    max-height: 70vh;
    display: flex;
    flex-direction: column;
  }

  :global(.global-search-modal .overflow-auto) {
    overflow: hidden !important;
    display: flex;
    flex-direction: column;
  }

  /* Recent Section */
  .recent-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .recent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .recent-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .clear-button {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-button:hover {
    color: var(--foreground);
    background: var(--hover-overlay);
  }

  .recent-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .recent-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .recent-pill:hover {
    background: var(--hover-overlay);
  }

  .pill-logo {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    object-fit: cover;
  }

  .pill-logo-placeholder {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted-foreground);
  }

  .pill-pair-logos {
    display: flex;
    align-items: center;
  }

  .pill-logo-small {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--card);
  }

  .pill-logo-placeholder-small {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: var(--muted-foreground);
    border: 1px solid var(--card);
  }

  .pill-logo-overlap {
    margin-left: -6px;
  }

  .pill-symbol {
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
  }

  /* Expand Button */
  .expand-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    border-top: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .expand-button:hover {
    color: var(--foreground);
    background: var(--hover-overlay);
  }
</style>
