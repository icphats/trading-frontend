<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { EmptyState, UnifiedListRow, SectionHeader } from '$lib/components/ui';
  import { userPortfolio, userPreferences } from '$lib/domain/user';
  import { user } from '$lib/domain/user/auth.svelte';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';
  import { createSearchState } from '$lib/domain/search';
  import { normalizeTokenSymbol } from '$lib/domain/markets';
  import { bpsToPercent } from '$lib/domain/markets/utils/math';

  // Configure page header
  pageHeader.reset();
  pageHeader.mode = 'tokens';
  pageHeader.sectionLabel = 'Tokens Value';
  pageHeader.showValue = true;
  pageHeader.filterType = 'search';
  pageHeader.searchPlaceholder = 'Search tokens';
  pageHeader.searchValue = '';

  // Toggle favorite status
  function handleToggleFavorite(canisterId: string) {
    userPreferences.toggleFavorite(canisterId);
  }

  // Reactive bindings to enriched state (includes live prices from entityStore)
  const allTokens = $derived(userPortfolio.allTokens);
  const isLoading = $derived(userPortfolio.isLoading || userPortfolio.isDiscovering);
  const isLoadingBalances = $derived(userPortfolio.isLoadingBalances);

  // Initialize when user is authenticated - uses $effect with readiness guard
  let hasInitialized = $state(false);

  $effect(() => {
    // Wait for user to be authenticated
    if (user.principal && !hasInitialized) {
      hasInitialized = true;
      untrack(async () => {
        // Initialize preferences first (loads small balance settings)
        if (!userPreferences.isInitialized) {
          userPreferences.initialize();
        }
        if (!userPortfolio.isInitialized) {
          await userPortfolio.initialize();
        }
        // Discover any tokens with balances
        await userPortfolio.discoverHoldings(user.principal as any);
      });
    }
  });

  // Apply user preferences to filter tokens
  const visibleTokens = $derived.by(() => {
    let result = allTokens;

    // Filter out hidden tokens (from preferences)
    const hiddenSet = new Set(userPreferences.hiddenTokens);
    result = result.filter(t => !hiddenSet.has(t.canisterId));

    // Filter out small balances if enabled
    if (userPreferences.hiddenSmallBalances) {
      const threshold = userPreferences.smallBalanceThreshold;
      result = result.filter(t => t.value >= threshold);
    }

    return result;
  });

  // Push reactive values to page header
  $effect(() => {
    pageHeader.totalValue = totalValue;
    pageHeader.change24h = change24h;
    pageHeader.change24hPercent = change24hPercent;
    pageHeader.count = tokenCount;
    pageHeader.countLabel = tokenCount === 1 ? 'token' : 'tokens';
    pageHeader.loadingText = isLoadingBalances ? 'updating...' : '';
  });

  // Is user actively searching?
  let search = $derived(pageHeader.searchValue);
  let isSearching = $derived(search.length > 0);

  // Backend search for token discovery (debounced)
  const backendSearch = createSearchState({ filter: { tokens: null } });

  // Sync pageHeader search input → backend search query
  $effect(() => {
    backendSearch.query = pageHeader.searchValue;
  });

  // Favorite tokens
  let favoriteTokens = $derived.by(() => {
    return visibleTokens.filter(t => userPreferences.isFavorite(t.canisterId));
  });

  // Non-favorite tokens (to avoid duplicates)
  let nonFavoriteTokens = $derived.by(() => {
    return visibleTokens.filter(t => !userPreferences.isFavorite(t.canisterId));
  });

  // Show favorites section (only when browsing, not searching)
  let showFavorites = $derived(!isSearching);

  // Apply search filter on top of preference filters
  const filteredTokens = $derived.by(() => {
    if (!search) return visibleTokens;
    const query = search.toLowerCase();
    return visibleTokens.filter((t) =>
      t.displaySymbol?.toLowerCase().includes(query) ||
      t.displayName?.toLowerCase().includes(query) ||
      t.symbol?.toLowerCase().includes(query) ||
      t.name?.toLowerCase().includes(query)
    );
  });

  // Tokens to display (when not searching, excludes favorites to avoid duplicates)
  let displayedTokens = $derived.by(() => {
    if (isSearching) return filteredTokens;
    return nonFavoriteTokens;
  });

  // All user token IDs for deduplication
  const userTokenIds = $derived(new Set(allTokens.map(t => t.canisterId)));

  // Backend search results, excluding tokens the user already holds
  const discoverableTokens = $derived.by(() => {
    if (!isSearching) return [];
    return backendSearch.tokens.filter(t => !userTokenIds.has(t.token_ledger.toString()));
  });

  // Navigate to token explore page
  function handleDiscoverableTokenClick(canisterId: string) {
    const token = entityStore.getToken(canisterId);
    const symbol = token ? normalizeTokenSymbol(token.displaySymbol) : canisterId;
    goto(`/explore/tokens/${symbol}`);
  }

  // Computed values based on visible tokens
  const totalValue = $derived(visibleTokens.reduce((sum, t) => sum + t.value, 0));
  const tokenCount = $derived(visibleTokens.filter(t => t.balance > 0n).length);

  // 24h change for token holdings
  const change24h = $derived.by(() => {
    let total = 0;
    for (const token of visibleTokens) {
      const entity = entityStore.getToken(token.canisterId);
      if (!entity || token.value === 0 || entity.priceChange24h === 0) continue;
      const divisor = 1 + entity.priceChange24h / 100;
      if (divisor <= 0) continue;
      total += token.value - token.value / divisor;
    }
    return total;
  });

  const change24hPercent = $derived.by(() => {
    if (totalValue <= 0 || change24h === 0) return 0;
    const prev = totalValue - change24h;
    return prev > 0 ? (change24h / prev) * 100 : 0;
  });
</script>

<div class="tokens-page">
  <!-- Token List -->
  <div class="tokens-list">
    {#if isLoading}
      {#each Array(5) as _}
        <div class="skeleton-row">
          <div class="skeleton skeleton-icon"></div>
          <div class="skeleton-content">
            <div class="skeleton skeleton-name"></div>
            <div class="skeleton skeleton-balance"></div>
          </div>
        </div>
      {/each}
    {:else if isSearching && filteredTokens.length === 0 && discoverableTokens.length === 0 && !backendSearch.isLoading}
      <div class="empty-container">
        <EmptyState
          message="No results found"
          hint="Try a different search term"
        />
      </div>
    {:else if visibleTokens.length === 0 && !isSearching}
      <div class="empty-container">
        <EmptyState
          message="No tokens yet"
          hint="Your token balances will appear here"
        />
      </div>
    {:else}
      <!-- Favorites Section (only when browsing and has favorites) -->
      {#if showFavorites && favoriteTokens.length > 0}
        <SectionHeader label="Favorites" count={favoriteTokens.length} />
        {#each favoriteTokens as token (token.canisterId)}
          <UnifiedListRow
            type="token"
            id={token.canisterId}
            logo={token.logo ?? null}
            primaryLabel={token.displaySymbol ?? token.symbol ?? 'Unknown'}
            secondaryLabel={token.displayName ?? token.name ?? ''}
            balance={{ amount: token.formattedBalance, raw: token.balance }}
            usdValue={token.value}
            showBalance
            showUsdValue
            isFavorite={true}
            onFavorite={() => handleToggleFavorite(token.canisterId)}
            logoSize="sm"
          />
        {/each}
      {/if}

      <!-- Tokens Section -->
      {#if displayedTokens.length > 0}
        <SectionHeader
          label={isSearching ? "Your tokens" : "Tokens"}
          count={isSearching ? filteredTokens.length : nonFavoriteTokens.length}
        />
        {#each displayedTokens as token (token.canisterId)}
          <UnifiedListRow
            type="token"
            id={token.canisterId}
            logo={token.logo ?? null}
            primaryLabel={token.displaySymbol ?? token.symbol ?? 'Unknown'}
            secondaryLabel={token.displayName ?? token.name ?? ''}
            balance={{ amount: token.formattedBalance, raw: token.balance }}
            usdValue={token.value}
            showBalance
            showUsdValue
            isFavorite={userPreferences.isFavorite(token.canisterId)}
            onFavorite={() => handleToggleFavorite(token.canisterId)}
            logoSize="sm"
          />
        {/each}
      {/if}

      <!-- All Tokens Section (backend discovery, only when searching) -->
      {#if isSearching && discoverableTokens.length > 0}
        <SectionHeader label="All tokens" count={discoverableTokens.length} />
        {#each discoverableTokens as token (token.token_ledger.toString())}
          {@const canisterId = token.token_ledger.toString()}
          {@const storeToken = entityStore.getToken(canisterId)}
          <UnifiedListRow
            type="token"
            id={canisterId}
            logo={storeToken?.logo ?? null}
            primaryLabel={storeToken?.displaySymbol ?? token.symbol}
            secondaryLabel={storeToken?.displayName ?? token.name}
            price={Number(token.current_price_usd_e12) / 1e12}
            priceChange={bpsToPercent(token.price_change_24h_bps)}
            showPrice
            showPriceChange
            onClick={() => handleDiscoverableTokenClick(canisterId)}
            logoSize="sm"
          />
        {/each}
      {:else if isSearching && backendSearch.isLoading && filteredTokens.length === 0}
        <SectionHeader label="All tokens" />
        <EmptyState variant="loading" message="Searching..." />
      {/if}
    {/if}
  </div>
</div>

<style>
  .tokens-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }

  .tokens-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .empty-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Skeleton loading */
  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .skeleton-row:last-child {
    border-bottom: none;
  }

  .skeleton {
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .skeleton-name {
    width: 120px;
    height: 16px;
  }

  .skeleton-balance {
    width: 80px;
    height: 12px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

</style>
