<script lang="ts">
  import ResponsiveDrawer from "$lib/components/portal/drawers/shared/ResponsiveDrawer.svelte";
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
    baseLogo?: string;
    quoteLogo?: string;
    baseSymbol: string;
    quoteSymbol: string;
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
        baseLogo: baseToken?.logo ?? undefined,
        quoteLogo: quoteToken?.logo ?? undefined,
        baseSymbol: baseSymbol,
        quoteSymbol: quoteSymbol,
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

<ResponsiveDrawer open={open} onClose={handleClose} bottomSheetMaxHeight="85dvh">
  <div class="market-picker">
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
            pairLogos={{ base: market.baseLogo, quote: market.quoteLogo }}
            pairSymbols={{ base: market.baseSymbol, quote: market.quoteSymbol }}
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
</ResponsiveDrawer>

<style>
  .market-picker {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .market-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
</style>
