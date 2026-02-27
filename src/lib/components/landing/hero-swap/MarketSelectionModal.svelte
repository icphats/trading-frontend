<script lang="ts">
  import Modal from "$lib/components/portal/modals/Modal.svelte";
  import { SearchInput, SectionHeader, EmptyState, UnifiedListRow } from "$lib/components/ui";
  import { entityStore } from "$lib/domain/orchestration";
  import { normalizeTokenSymbol } from "$lib/domain/markets";
  import type { MarketListItem } from "$lib/actors/services/indexer.service";

  interface Props {
    open: boolean;
    markets: MarketListItem[];
    currentMarketId?: string;
    onSelect: (canisterId: string) => void;
    onClose?: () => void;
  }

  let { open = $bindable(false), markets, currentMarketId, onSelect, onClose }: Props = $props();

  let searchQuery = $state("");

  // Build UI-ready market rows from MarketListItem + entityStore
  type UIMarketRow = {
    canisterId: string;
    symbol: string;
    name: string;
    token0Logo?: string;
    token1Logo?: string;
    token0Symbol: string;
    token1Symbol: string;
  };

  let allMarkets = $derived.by((): UIMarketRow[] => {
    return markets.map((m) => {
      const canisterId = m.canister_id.toString();
      const baseToken = entityStore.getToken(m.base_token.toString());
      const quoteToken = entityStore.getToken(m.quote_token.toString());

      const baseSymbol = baseToken?.displaySymbol ?? normalizeTokenSymbol(m.symbol.split("/")[0] ?? "???").toUpperCase();
      const quoteSymbol = quoteToken?.displaySymbol ?? normalizeTokenSymbol(m.symbol.split("/")[1] ?? "???").toUpperCase();

      return {
        canisterId,
        symbol: `${baseSymbol}/${quoteSymbol}`,
        name: baseToken?.displayName ?? baseSymbol,
        token0Logo: baseToken?.logo ?? undefined,
        token1Logo: quoteToken?.logo ?? undefined,
        token0Symbol: baseSymbol,
        token1Symbol: quoteSymbol,
      };
    });
  });

  let filteredMarkets = $derived.by((): UIMarketRow[] => {
    if (!searchQuery) return allMarkets;
    const query = searchQuery.toLowerCase();
    return allMarkets.filter(
      (m) =>
        m.symbol.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query)
    );
  });

  function handleClose() {
    open = false;
    searchQuery = "";
    onClose?.();
  }

  function handleSelect(canisterId: string) {
    onSelect(canisterId);
    handleClose();
  }
</script>

<Modal bind:open onClose={handleClose} showHeader={false} size="sm" closeOnBackdrop={true} contentPadding={false}>
  {#snippet children()}
    <div class="modal-body">
      <SearchInput
        bind:value={searchQuery}
        placeholder="Search markets"
        autofocus
      />

      <div class="market-list">
        {#if filteredMarkets.length > 0}
          <SectionHeader label="Markets" count={filteredMarkets.length} />
          {#each filteredMarkets as market (market.canisterId)}
            <UnifiedListRow
              type="market"
              id={market.canisterId}
              pairLogos={{ token0: market.token0Logo, token1: market.token1Logo }}
              pairSymbols={{ token0: market.token0Symbol, token1: market.token1Symbol }}
              primaryLabel={market.symbol}
              secondaryLabel={market.name}
              isSelected={market.canisterId === currentMarketId}
              onClick={() => handleSelect(market.canisterId)}
              logoSize="sm"
            />
          {/each}
        {:else if searchQuery}
          <EmptyState
            variant="empty"
            message="No markets found"
          />
        {:else}
          <EmptyState variant="loading" message="Loading markets..." />
        {/if}
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .market-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.25rem 0;
    max-height: 50vh;
  }
</style>
