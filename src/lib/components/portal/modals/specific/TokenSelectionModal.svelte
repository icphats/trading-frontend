<script lang="ts">
  import { Principal } from "@icp-sdk/core/principal";
  import { untrack } from "svelte";
  import Modal from "../Modal.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { SearchInput, SectionHeader, EmptyState, UnifiedListRow } from "$lib/components/ui";
  import { userPortfolio, userPreferences, type PortfolioToken } from "$lib/domain/user";
  import type { TokenDefinition } from "$lib/domain/tokens";
  import { discoverToken, getPopularTokens, entityStore, type NormalizedToken } from "$lib/domain/orchestration";
  import { canisterIds } from "$lib/constants/app.constants";
  import type { TokenListItem as IndexerTokenListItem } from 'declarations/indexer/indexer.did';
  import type { TokenMetadata } from "$lib/repositories/token.repository";
  import { createSearchState } from "$lib/domain/search";

  interface Props {
    open: boolean;
    onClose?: () => void;
    onSelect?: (token: TokenMetadata) => void;
    title?: string; // Kept for backwards compatibility, not displayed
    restrictToTokens?: TokenDefinition[];
  }

  let { open = $bindable(false), onClose, onSelect, restrictToTokens }: Props = $props();

  // Shared search state with debounce + cancellation
  const search = createSearchState({ filter: { tokens: null } });

  let fetchedToken = $state<NormalizedToken | null>(null);
  let popularTokens = $state<IndexerTokenListItem[]>([]);
  let popularTokensLoading = $state(false);

  // Get PortfolioToken from userPortfolio (has balance data for display)
  const userTokens = $derived.by((): PortfolioToken[] => {
    // If restrictToTokens is provided, filter portfolio tokens
    if (restrictToTokens) {
      const restrictedIds = new Set(restrictToTokens.map(def => def.canisterId));
      return userPortfolio.allTokens.filter(token => restrictedIds.has(token.canisterId));
    }

    // Otherwise use all tokens from user portfolio
    return userPortfolio.allTokens;
  });

  // Is user actively searching?
  let isSearching = $derived(search.isSearching);

  // Favorite tokens from user's portfolio
  let favoriteTokens = $derived.by((): PortfolioToken[] => {
    return userTokens.filter(t => userPreferences.isFavorite(t.canisterId));
  });

  // Non-favorite tokens (to avoid duplicates)
  let nonFavoriteTokens = $derived.by((): PortfolioToken[] => {
    return userTokens.filter(t => !userPreferences.isFavorite(t.canisterId));
  });

  // Filter user tokens by search query
  const filteredUserTokens = $derived.by(() => {
    if (!search.query) return nonFavoriteTokens;

    const query = search.normalizedQuery.toLowerCase();
    return userTokens.filter((token) =>
      token.symbol.toLowerCase().includes(query) ||
      token.displaySymbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.displayName.toLowerCase().includes(query) ||
      token.canisterId.toLowerCase().includes(query)
    );
  });

  // Filtered favorites (when searching)
  const filteredFavorites = $derived.by((): PortfolioToken[] => {
    if (!search.query) return favoriteTokens;
    const query = search.normalizedQuery.toLowerCase();
    return favoriteTokens.filter((token) =>
      token.symbol.toLowerCase().includes(query) ||
      token.displaySymbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.displayName.toLowerCase().includes(query) ||
      token.canisterId.toLowerCase().includes(query)
    );
  });

  // Get set of user token canister IDs for filtering
  const userTokenIds = $derived(new Set(userTokens.map((t) => t.canisterId)));

  // Restricted canister IDs (when restrictToTokens is set)
  const restrictedIds = $derived(restrictToTokens ? new Set(restrictToTokens.map(def => def.canisterId)) : null);

  // Filter popular tokens: exclude user's tokens, apply search, merge backend results
  // Also respects restrictToTokens when set
  const filteredPopularTokens = $derived.by(() => {
    // If no search query, just return popular tokens (minus user's)
    if (!search.query || search.isPrincipal) {
      return popularTokens.filter((t) => {
        const id = t.token_ledger.toString();
        if (userTokenIds.has(id)) return false;
        if (restrictedIds && !restrictedIds.has(id)) return false;
        return true;
      });
    }

    const query = search.normalizedQuery.toLowerCase();

    // 1. Frontend: filter popular tokens locally
    const frontendResults = popularTokens.filter(
      (t) => {
        const id = t.token_ledger.toString();
        if (userTokenIds.has(id)) return false;
        if (restrictedIds && !restrictedIds.has(id)) return false;
        return t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query) ||
          id.toLowerCase().includes(query);
      }
    );

    // 2. Backend: filter out user's tokens and respect restrictions
    const backendResults = search.tokens.filter(
      (t) => {
        const id = t.token_ledger.toString();
        if (userTokenIds.has(id)) return false;
        if (restrictedIds && !restrictedIds.has(id)) return false;
        return true;
      }
    );

    // 3. Merge and deduplicate (frontend first, backend fills gaps)
    const seen = new Set<string>();
    const merged: IndexerTokenListItem[] = [];

    for (const token of frontendResults) {
      const id = token.token_ledger.toString();
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(token);
      }
    }

    for (const token of backendResults) {
      const id = token.token_ledger.toString();
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(token);
      }
    }

    // Sort by volume (E6 precision - USD accumulator)
    return merged.sort((a, b) => {
      if (a.volume_24h_usd_e6 > b.volume_24h_usd_e6) return -1;
      if (a.volume_24h_usd_e6 < b.volume_24h_usd_e6) return 1;
      return 0;
    });
  });

  // Fetch popular tokens when modal opens
  $effect(() => {
    if (open && canisterIds.indexer && popularTokens.length === 0 && !popularTokensLoading) {
      popularTokensLoading = true;
      // Use untrack to prevent entityStore updates from cascading back to parent components
      untrack(() => {
        getPopularTokens(50n)
          .then((tokens) => {
            popularTokens = tokens;
          })
          .catch((err) => {
            console.error("Failed to fetch popular tokens:", err);
          })
          .finally(() => {
            popularTokensLoading = false;
          });
      });
    }
  });

  function handleClose() {
    open = false;
    search.reset();
    fetchedToken = null;
    onClose?.();
  }

  // Handle token selection - convert PortfolioToken or NormalizedToken to TokenMetadata for callback
  async function handleTokenSelect(token: PortfolioToken | NormalizedToken) {
    // If this token was fetched via canister ID lookup, add it to portfolio
    if (search.isPrincipal && fetchedToken && token.canisterId === fetchedToken.canisterId) {
      await userPortfolio.addToken(token.canisterId);
    }

    // Convert to TokenMetadata format for onSelect callback
    const tokenMetadata: TokenMetadata = {
      canisterId: token.canisterId,
      name: token.name,
      displayName: token.displayName,
      symbol: token.symbol,
      displaySymbol: token.displaySymbol,
      decimals: token.decimals,
      fee: token.fee,
      logo: token.logo ?? undefined,
    };

    onSelect?.(tokenMetadata);
    handleClose();
  }

  // Handle popular token selection - discover via domain layer and select
  async function handlePopularTokenSelect(indexerToken: IndexerTokenListItem) {
    const canisterId = indexerToken.token_ledger.toString();

    // Discover via domain layer (handles entityStore + caching)
    const token = await discoverToken(canisterId);

    if (!token) {
      console.error("Failed to discover popular token:", canisterId);
      return;
    }

    // Convert to TokenMetadata format
    const tokenMetadata: TokenMetadata = {
      canisterId: token.canisterId,
      name: token.name,
      displayName: token.displayName,
      symbol: token.symbol,
      displaySymbol: token.displaySymbol,
      decimals: token.decimals,
      fee: token.fee,
      logo: token.logo ?? undefined,
    };

    onSelect?.(tokenMetadata);
    handleClose();
  }

  $effect(() => {
    // Guard: only clear if not already null to prevent infinite loop
    if (!search.isPrincipal) {
      if (fetchedToken !== null) fetchedToken = null;
      return;
    }

    const query = search.normalizedQuery;

    (async () => {
      try {
        const ledgerCanisterId = Principal.fromText(query).toText();

        // Discover via domain layer (handles entityStore + caching)
        // Use untrack to prevent cascading reactivity to parent components
        const token = await untrack(() => discoverToken(ledgerCanisterId));

        if (search.normalizedQuery !== query) return;
        fetchedToken = token;
      } catch (error) {
        if (search.normalizedQuery === query) {
          console.error("Failed to discover token:", error);
          fetchedToken = null;
        }
      }
    })();
  });

  // Favorite handler
  function handleTokenFavorite(canisterId: string) {
    userPreferences.toggleFavorite(canisterId);
  }
</script>

<Modal bind:open onClose={handleClose} showHeader={false} size="sm" closeOnBackdrop={true} contentPadding={false}>
  {#snippet children()}
    <div class="modal-body">
      <!-- Search Input -->
      <SearchInput
        bind:value={search.query}
        placeholder="Search name or paste address"
        autofocus
      />

      <!-- Token List -->
      <div class="token-list">
        {#if search.isPrincipal}
          <!-- Show fetched token from Principal ID search -->
          {#if fetchedToken && (!restrictedIds || restrictedIds.has(fetchedToken.canisterId))}
            <UnifiedListRow
              type="token"
              id={fetchedToken.canisterId}
              logo={fetchedToken.logo}
              primaryLabel={fetchedToken.displaySymbol}
              secondaryLabel={fetchedToken.displayName}
              onClick={() => handleTokenSelect(fetchedToken!)}
              logoSize="md"
            />
          {:else}
            <EmptyState variant="loading" message="Loading token..." />
          {/if}
        {:else}
          <!-- Favorites Section (only when not searching and has favorites) -->
          {#if !isSearching && favoriteTokens.length > 0}
            <SectionHeader label="Favorites" count={favoriteTokens.length} />
            {#each favoriteTokens as token (token.canisterId)}
              <UnifiedListRow
                type="token"
                id={token.canisterId}
                logo={token.logo}
                primaryLabel={token.displaySymbol}
                secondaryLabel={token.displayName}
                balance={{ amount: token.formattedBalance, raw: token.balance }}
                usdValue={token.value}
                showBalance={token.balance > 0n}
                showUsdValue={token.balance > 0n}
                isFavorite={true}
                onClick={() => handleTokenSelect(token)}
                onFavorite={() => handleTokenFavorite(token.canisterId)}
                logoSize="md"
              />
            {/each}
          {/if}

          <!-- Your Tokens Section (filtered when searching) -->
          {#if filteredUserTokens.length > 0}
            <SectionHeader label={isSearching ? "Your tokens" : "Tokens"} count={filteredUserTokens.length} />
            {#each filteredUserTokens as token (token.canisterId)}
              <UnifiedListRow
                type="token"
                id={token.canisterId}
                logo={token.logo}
                primaryLabel={token.displaySymbol}
                secondaryLabel={token.displayName}
                balance={{ amount: token.formattedBalance, raw: token.balance }}
                usdValue={token.value}
                showBalance={token.balance > 0n}
                showUsdValue={token.balance > 0n}
                isFavorite={userPreferences.isFavorite(token.canisterId)}
                onClick={() => handleTokenSelect(token)}
                onFavorite={() => handleTokenFavorite(token.canisterId)}
                logoSize="md"
              />
            {/each}
          {/if}

          <!-- Popular/Search Results Section (from indexer, excluding user's tokens) -->
          {#if filteredPopularTokens.length > 0}
            <SectionHeader label={search.query ? "Search results" : "Popular tokens"} count={filteredPopularTokens.length} />
            {#each filteredPopularTokens as token (token.token_ledger.toString())}
              {@const storeToken = entityStore.getToken(token.token_ledger.toString())}
              <UnifiedListRow
                type="token"
                id={token.token_ledger.toString()}
                logo={storeToken?.logo}
                primaryLabel={storeToken?.displaySymbol ?? token.symbol}
                secondaryLabel={storeToken?.displayName ?? token.name}
                onClick={() => handlePopularTokenSelect(token)}
                logoSize="md"
              />
            {/each}
          {:else if popularTokensLoading || search.isLoading}
            <SectionHeader label={search.query ? "Search results" : "Popular tokens"} />
            <EmptyState variant="loading" message={search.query ? "Searching..." : "Loading popular tokens..."} />
          {/if}

          <!-- Empty state when no results -->
          {#if isSearching && filteredUserTokens.length === 0 && filteredFavorites.length === 0 && filteredPopularTokens.length === 0 && !popularTokensLoading && !search.isLoading}
            <EmptyState
              variant="empty"
              message="No results found"
              hint={`No tokens found for "${search.query}"`}
            />
          {/if}
        {/if}
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  /* Token list - scrollable area */
  .token-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.25rem 0;
    max-height: 50vh;
  }

  .token-list::-webkit-scrollbar {
    width: 4px;
  }

  .token-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .token-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }

  .token-list::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }
</style>
