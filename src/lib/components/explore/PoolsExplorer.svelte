<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { indexerRepository, poolItemToUpsert } from '$lib/repositories/indexer.repository';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import TokenPairLogo from '$lib/components/ui/TokenPairLogo.svelte';
  import { DataTable, TableCell, HeaderCell } from '$lib/components/ui/table';
  import { formatCompactUSD, formatPercent, formatPipsAsPercent, fromDecimals, getPriceChangeClass } from '$lib/utils/format.utils';
  import { bpsToPercent } from '$lib/domain/markets/utils/math';
  import { ticker } from '$lib/domain/orchestration/ticker-action';
  import type { PoolListItem, VolumeCursor } from 'declarations/indexer/indexer.did';

  type SortKey = 'tvl' | 'apr' | 'volume1d' | 'fees1d';
  type SortDirection = 'asc' | 'desc' | null;

  const PAGE_SIZE = 20n;

  // Transform PoolListItem to display format
  interface PoolDisplay {
    symbol: string;
    baseSymbol: string;
    quoteSymbol: string;
    quoteLedger: string;
    feePips: number;
    tvl: number;
    apr: number;
    volume1d: number;
    fees1d: number;
    canisterId: string;
    baseLogo: string | undefined;
    quoteLogo: string | undefined;
  }

  // ============================================
  // Local State
  // ============================================

  let poolItems = $state<PoolListItem[]>([]);
  let isLoading = $state(false);
  let isLoadingMore = $state(false);
  let error = $state<string | null>(null);
  let nextCursor = $state<VolumeCursor | undefined>(undefined);
  let hasMoreData = $state(false);
  let sortKey = $state<SortKey | null>(null);
  let sortDirection = $state<SortDirection>(null);

  // ============================================
  // Derived State
  // ============================================

  let hasMore = $derived(hasMoreData);

  // Transform indexer data to display format
  function transformPools(items: PoolListItem[]): PoolDisplay[] {
    return items.map((item) => {
      // Use ledger IDs to get tokens from entityStore
      const baseToken = entityStore.getToken(item.base_ledger.toString());
      const quoteToken = entityStore.getToken(item.quote_ledger.toString());

      // Get display symbols from entityStore tokens (more reliable than indexer symbol field)
      const baseSymbol = baseToken?.displaySymbol ?? '';
      const quoteSymbol = quoteToken?.displaySymbol ?? '';
      const symbol = baseSymbol && quoteSymbol ? `${baseSymbol}/${quoteSymbol}` : item.symbol;

      return {
        symbol,
        baseSymbol,
        quoteSymbol,
        quoteLedger: item.quote_ledger.toString(),
        feePips: item.fee_pips,
        tvl: fromDecimals(item.tvl_usd_e6, 6),
        apr: bpsToPercent(item.apr_bps),
        volume1d: fromDecimals(item.volume_24h_usd_e6, 6),
        fees1d: fromDecimals(item.fees_24h_usd_e6, 6),
        canisterId: item.spot_canister.toString(),
        baseLogo: baseToken?.logo ?? undefined,
        quoteLogo: quoteToken?.logo ?? undefined
      };
    });
  }

  let pools = $derived(transformPools(poolItems));

  // Sorted pools
  let sortedPools = $derived.by(() => {
    if (!sortKey || !sortDirection) {
      return pools;
    }

    return [...pools].sort((a, b) => {
      const aVal = a[sortKey!] as number;
      const bVal = b[sortKey!] as number;

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

  async function loadPools(): Promise<void> {
    isLoading = true;
    error = null;
    nextCursor = undefined;

    const result = await indexerRepository.getPools(PAGE_SIZE, undefined, false);

    if ('err' in result) {
      error = result.err;
      isLoading = false;
      return;
    }

    poolItems = result.ok.data;
    hasMoreData = result.ok.has_more;
    nextCursor = result.ok.next_cursor[0];
    isLoading = false;

    // Populate entityStore with normalized data
    const upserts = result.ok.data.map(poolItemToUpsert);
    entityStore.upsertPools(upserts);
  }

  async function loadMore(): Promise<void> {
    if (isLoadingMore || !hasMore) return;

    isLoadingMore = true;

    const result = await indexerRepository.getPools(PAGE_SIZE, nextCursor, false);

    if ('ok' in result) {
      poolItems = [...poolItems, ...result.ok.data];
      hasMoreData = result.ok.has_more;
      nextCursor = result.ok.next_cursor[0];

      // Populate entityStore with new pools
      const upserts = result.ok.data.map(poolItemToUpsert);
      entityStore.upsertPools(upserts);
    }

    isLoadingMore = false;
  }

  onMount(() => {
    loadPools();
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

  function navigateToPool(pool: PoolDisplay) {
    goto(`/explore/pools/${pool.canisterId}/${pool.quoteSymbol.toLowerCase()}/${pool.feePips}`);
  }

  // Column widths (matching Uniswap proportions)
  const COL_INDEX = 60;
  const COL_POOL = 280;
  const COL_FEE = 100;
  const COL_TVL = 140;
  const COL_APR = 120;
  const COL_VOLUME = 150;
  const COL_FEES = 140;
</script>

<DataTable
  data={sortedPools}
  loading={isLoading}
  error={error}
  hasMore={hasMore}
  loadingMore={isLoadingMore}
  loadMore={loadMore}
  emptyMessage="No pools found"
  clickableRows={true}
  onRowClick={navigateToPool}
>
  {#snippet header()}
    <HeaderCell width={COL_INDEX} align="left" pinned pinnedOffset={0}>#</HeaderCell>
    <HeaderCell width={COL_POOL} align="left" pinned pinnedOffset={COL_INDEX} lastPinned grow>Pool</HeaderCell>
    <HeaderCell width={COL_FEE}>Fee</HeaderCell>
    <HeaderCell width={COL_TVL} sortable sortDirection={getSortDirection('tvl')} onSort={() => sortTable('tvl')}>TVL</HeaderCell>
    <HeaderCell width={COL_APR} sortable sortDirection={getSortDirection('apr')} onSort={() => sortTable('apr')}>APR</HeaderCell>
    <HeaderCell width={COL_VOLUME} sortable sortDirection={getSortDirection('volume1d')} onSort={() => sortTable('volume1d')}>24H Volume</HeaderCell>
    <HeaderCell width={COL_FEES} sortable sortDirection={getSortDirection('fees1d')} onSort={() => sortTable('fees1d')}>24H Fees</HeaderCell>
  {/snippet}

  {#snippet row(pool, index)}
    <div use:ticker={pool.canisterId} style="display:contents">
      <TableCell width={COL_INDEX} align="left" pinned pinnedOffset={0}>
        <span class="rank-text">{index + 1}</span>
      </TableCell>
      <TableCell width={COL_POOL} align="left" pinned pinnedOffset={COL_INDEX} lastPinned grow>
        <div class="pool-info">
          <TokenPairLogo
            baseLogo={pool.baseLogo}
            quoteLogo={pool.quoteLogo}
            baseSymbol={pool.baseSymbol}
            quoteSymbol={pool.quoteSymbol}
            size="xs"
          />
          <span class="pool-name">{pool.symbol}</span>
        </div>
      </TableCell>
      <TableCell width={COL_FEE}>{formatPipsAsPercent(pool.feePips)}</TableCell>
      <TableCell width={COL_TVL}>{formatCompactUSD(pool.tvl)}</TableCell>
      <TableCell width={COL_APR}>
        <span class="apr-value {getPriceChangeClass(pool.apr)}">
          {formatPercent(pool.apr)}
        </span>
      </TableCell>
      <TableCell width={COL_VOLUME}>{formatCompactUSD(pool.volume1d)}</TableCell>
      <TableCell width={COL_FEES}>{formatCompactUSD(pool.fees1d)}</TableCell>
    </div>
  {/snippet}
</DataTable>

<style>
  .rank-text {
    color: var(--muted-foreground);
    font-size: 14px;
  }

  .pool-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .pool-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .apr-value {
    font-size: 14px;
  }

  .apr-value.positive {
    color: var(--color-bullish);
  }

  .apr-value.negative {
    color: var(--color-bearish);
  }

  .apr-value.neutral {
    color: var(--muted-foreground);
  }

  /* Mobile: hide index column and adjust pinned offset */
  @media (max-width: 640px) {
    /* Hide the # column (first cell in header and rows) */
    :global(.data-table-header-row > .header-cell:first-child),
    :global(.data-table-row .table-cell:first-child) {
      display: none;
    }

    /* Reset pinned offset and reduce width for pool name column */
    :global(.data-table-header-row > .header-cell:nth-child(2)),
    :global(.data-table-row .table-cell:nth-child(2)) {
      left: 0 !important;
      width: 170px !important;
    }
  }
</style>
