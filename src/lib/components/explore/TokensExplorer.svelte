<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { indexerRepository, tokenItemToUpsert } from '$lib/repositories/indexer.repository';
  import { tokenRepository } from '$lib/repositories/token.repository';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { calculateMarketCapFloat } from '$lib/utils/market-cap.utils';
  import Logo from '$lib/components/ui/Logo.svelte';
  import { DataTable, TableCell, HeaderCell, DeltaArrow } from '$lib/components/ui/table';
  import {
    formatCompactUSD,
    formatTokenPrice,
    formatPercentChange,
    fromDecimals,
    getPriceChangeClass
  } from '$lib/utils/format.utils';
  import { bpsToPercent } from '$lib/domain/markets/utils/math';
  import { tokenTicker } from '$lib/domain/orchestration/ticker-action';
  import type { TokenListItem, VolumeCursor } from 'declarations/indexer/indexer.did';

  type SortKey = 'price' | 'change1d' | 'change7d' | 'change30d' | 'tvl' | 'volume' | 'mcap';
  type SortDirection = 'asc' | 'desc' | null;
  type VolumeInterval = 1 | 7 | 30;

  const PAGE_SIZE = 20n;

  // Transform TokenListItem to display format
  interface TokenDisplay {
    name: string;
    symbol: string;
    price: number;
    change1d: number;
    change7d: number;
    change30d: number;
    tvl: number;
    volume24h: number;
    volume7d: number;
    volume30d: number;
    ledger: string;
    logo: string | null;
  }

  // ============================================
  // Local State
  // ============================================

  let tokenItems = $state<TokenListItem[]>([]);
  let isLoading = $state(false);
  let isLoadingMore = $state(false);
  let error = $state<string | null>(null);
  let nextCursor = $state<VolumeCursor | undefined>(undefined);
  let hasMoreData = $state(false);
  let sortKey = $state<SortKey | null>(null);
  let sortDirection = $state<SortDirection>(null);
  let volumeIntervalDays = $state<VolumeInterval>(1);
  let marketCaps = $state<Map<string, number>>(new Map());
  let marketCapsLoading = $state(false);

  // ============================================
  // Derived State
  // ============================================

  let hasMore = $derived(hasMoreData);

  // Transform indexer data to display format
  // Note: Backend uses E12 for prices, E6 for USD accumulators (volume, TVL)
  // Price changes are in basis points (bps) and need conversion to percent
  function transformTokens(items: TokenListItem[]): TokenDisplay[] {
    return items.map((item) => {
      const ledgerId = item.token_ledger.toString();
      const token = entityStore.getToken(ledgerId);
      return {
        name: token?.displayName ?? (item.name || item.symbol),
        symbol: token?.displaySymbol ?? item.symbol,
        price: fromDecimals(item.current_price_usd_e12, 12),
        change1d: bpsToPercent(item.price_change_24h_bps),
        change7d: bpsToPercent(item.price_change_7d_bps),
        change30d: bpsToPercent(item.price_change_30d_bps),
        tvl: fromDecimals(item.tvl_usd_e6, 6),
        volume24h: fromDecimals(item.volume_24h_usd_e6, 6),
        volume7d: fromDecimals(item.volume_7d_usd_e6, 6),
        volume30d: fromDecimals(item.volume_30d_usd_e6, 6),
        ledger: ledgerId,
        logo: token?.logo ?? null
      };
    });
  }

  // Get volume for selected interval
  function getVolume(token: TokenDisplay): number {
    switch (volumeIntervalDays) {
      case 7: return token.volume7d;
      case 30: return token.volume30d;
      default: return token.volume24h;
    }
  }

  let tokens = $derived(transformTokens(tokenItems));

  // Sorted tokens
  let sortedTokens = $derived.by(() => {
    if (!sortKey || !sortDirection) {
      return tokens;
    }

    return [...tokens].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (sortKey === 'volume') {
        aVal = getVolume(a);
        bVal = getVolume(b);
      } else if (sortKey === 'mcap') {
        aVal = marketCaps.get(a.ledger) ?? 0;
        bVal = marketCaps.get(b.ledger) ?? 0;
      } else {
        aVal = a[sortKey as keyof TokenDisplay] as number;
        bVal = b[sortKey as keyof TokenDisplay] as number;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  });

  // ============================================
  // Data Loading
  // ============================================

  async function loadTokens(): Promise<void> {
    isLoading = true;
    error = null;
    nextCursor = undefined;

    const result = await indexerRepository.getTokens(PAGE_SIZE, undefined, false);

    if ('err' in result) {
      error = result.err;
      isLoading = false;
      return;
    }

    tokenItems = result.ok.data;
    hasMoreData = result.ok.has_more;
    nextCursor = result.ok.next_cursor[0];
    isLoading = false;

    // Populate entityStore with normalized data
    const upserts = result.ok.data.map(tokenItemToUpsert);
    entityStore.upsertTokens(upserts);
  }

  async function loadMore(): Promise<void> {
    if (isLoadingMore || !hasMore) return;

    isLoadingMore = true;

    const result = await indexerRepository.getTokens(PAGE_SIZE, nextCursor, false);

    if ('ok' in result) {
      tokenItems = [...tokenItems, ...result.ok.data];
      hasMoreData = result.ok.has_more;
      nextCursor = result.ok.next_cursor[0];

      // Populate entityStore with new tokens
      const upserts = result.ok.data.map(tokenItemToUpsert);
      entityStore.upsertTokens(upserts);
    }

    isLoadingMore = false;
  }

  async function fetchMarketCaps(): Promise<void> {
    if (tokenItems.length === 0) return;

    marketCapsLoading = true;

    // Fetch totalSupply for each token (cached with 5min TTL)
    const results = await Promise.allSettled(
      tokenItems.map(async (token) => {
        const ledgerId = token.token_ledger.toString();
        const priceUsd = fromDecimals(token.current_price_usd_e12, 12);

        // Fetch and cache totalSupply
        const supplyResult = await tokenRepository.fetchTotalSupply(ledgerId);
        if ('err' in supplyResult) {
          return { ledgerId, mcap: 0 };
        }

        // Update entityStore with totalSupply
        entityStore.upsertToken({
          canisterId: ledgerId,
          totalSupply: supplyResult.ok,
        });

        // Get token decimals from entityStore
        const tokenData = entityStore.getToken(ledgerId);
        const decimals = tokenData?.decimals ?? 8;

        // Calculate market cap using pure function
        const mcap = calculateMarketCapFloat(supplyResult.ok, priceUsd, decimals);
        return { ledgerId, mcap };
      })
    );

    const newMap = new Map(marketCaps);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        newMap.set(result.value.ledgerId, result.value.mcap);
      }
    }
    marketCaps = newMap;
    marketCapsLoading = false;
  }

  onMount(() => {
    loadTokens().then(() => {
      fetchMarketCaps();
    });
  });

  // ============================================
  // Sorting
  // ============================================

  function sortTable(key: SortKey) {
    if (sortKey === key) {
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
  // Navigation
  // ============================================

  function navigateToToken(token: TokenDisplay) {
    goto(`/explore/tokens/${token.symbol.toLowerCase()}`);
  }

  function getFormattedMarketCap(ledger: string): string {
    const mcap = marketCaps.get(ledger);
    if (mcap === undefined) {
      return marketCapsLoading ? '...' : '—';
    }
    return formatCompactUSD(mcap);
  }

  // Column widths (matching Uniswap proportions)
  const COL_INDEX = 60;
  const COL_TOKEN = 300;
  const COL_PRICE = 140;
  const COL_CHANGE = 100;
  const COL_TVL = 120;
  const COL_VOLUME = 150;
  const COL_MCAP = 120;
</script>

<DataTable
  data={sortedTokens}
  loading={isLoading}
  error={error}
  hasMore={hasMore}
  loadingMore={isLoadingMore}
  loadMore={loadMore}
  emptyMessage="No tokens found"
  clickableRows={true}
  onRowClick={navigateToToken}
>
  {#snippet header()}
    <HeaderCell width={COL_INDEX} align="left" pinned pinnedOffset={0}>#</HeaderCell>
    <HeaderCell width={COL_TOKEN} align="left" pinned pinnedOffset={COL_INDEX} lastPinned grow>Token name</HeaderCell>
    <HeaderCell width={COL_PRICE} sortable sortDirection={getSortDirection('price')} onSort={() => sortTable('price')}>Price</HeaderCell>
    <HeaderCell width={COL_CHANGE} sortable sortDirection={getSortDirection('change1d')} onSort={() => sortTable('change1d')}>24H</HeaderCell>
    <HeaderCell width={COL_CHANGE} sortable sortDirection={getSortDirection('change7d')} onSort={() => sortTable('change7d')}>7D</HeaderCell>
    <HeaderCell width={COL_CHANGE} sortable sortDirection={getSortDirection('change30d')} onSort={() => sortTable('change30d')}>30D</HeaderCell>
    <HeaderCell width={COL_TVL} sortable sortDirection={getSortDirection('tvl')} onSort={() => sortTable('tvl')}>TVL</HeaderCell>
    <HeaderCell width={COL_VOLUME} sortable sortDirection={getSortDirection('volume')} onSort={() => sortTable('volume')}>Volume</HeaderCell>
    <HeaderCell width={COL_MCAP} sortable sortDirection={getSortDirection('mcap')} onSort={() => sortTable('mcap')}>MCap</HeaderCell>
  {/snippet}

  {#snippet row(token, index)}
    <div use:tokenTicker={token.ledger} style="display:contents">
    <TableCell width={COL_INDEX} align="left" pinned pinnedOffset={0}>
      <span class="rank-text">{index + 1}</span>
    </TableCell>
    <TableCell width={COL_TOKEN} align="left" pinned pinnedOffset={COL_INDEX} lastPinned grow>
      <div class="token-info">
        <Logo
          src={token.logo ?? undefined}
          alt={token.symbol}
          size="xs"
          circle={true}
        />
        <span class="token-name">{token.name}</span>
        <span class="token-symbol">{token.symbol}</span>
      </div>
    </TableCell>
    <TableCell width={COL_PRICE}>{formatTokenPrice(token.price)}</TableCell>
    <TableCell width={COL_CHANGE}>
      <span class="price-change {getPriceChangeClass(token.change1d)}">
        <DeltaArrow delta={token.change1d} />
        {formatPercentChange(token.change1d)}
      </span>
    </TableCell>
    <TableCell width={COL_CHANGE}>
      <span class="price-change {getPriceChangeClass(token.change7d)}">
        <DeltaArrow delta={token.change7d} />
        {formatPercentChange(token.change7d)}
      </span>
    </TableCell>
    <TableCell width={COL_CHANGE}>
      <span class="price-change {getPriceChangeClass(token.change30d)}">
        <DeltaArrow delta={token.change30d} />
        {formatPercentChange(token.change30d)}
      </span>
    </TableCell>
    <TableCell width={COL_TVL}>{formatCompactUSD(token.tvl)}</TableCell>
    <TableCell width={COL_VOLUME}>{formatCompactUSD(getVolume(token))}</TableCell>
    <TableCell width={COL_MCAP}>{getFormattedMarketCap(token.ledger)}</TableCell>
    </div>
  {/snippet}
</DataTable>

<style>
  .rank-text {
    color: var(--muted-foreground);
    font-size: 14px;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .token-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .token-symbol {
    font-size: 14px;
    color: var(--muted-foreground);
  }

  /* Hide symbol on smaller screens */
  @media (max-width: 1024px) {
    .token-symbol {
      display: none;
    }
  }

  /* Mobile: hide index column and adjust pinned offset */
  @media (max-width: 640px) {
    /* Hide the # column (first cell in header and rows) */
    :global(.data-table-header-row > .header-cell:first-child),
    :global(.data-table-row .table-cell:first-child) {
      display: none;
    }

    /* Reset pinned offset and reduce width for token name column */
    :global(.data-table-header-row > .header-cell:nth-child(2)),
    :global(.data-table-row .table-cell:nth-child(2)) {
      left: 0 !important;
      width: 150px !important;
    }
  }

  .price-change {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
  }

  .price-change.positive {
    color: var(--color-bullish);
  }

  .price-change.negative {
    color: var(--color-bearish);
  }

  .price-change.neutral {
    color: var(--muted-foreground);
  }
</style>
