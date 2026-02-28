<script lang="ts">
  import { getSpotTransactions, isBuy, type ParsedTransaction } from '$lib/domain/orchestration';
  import { DataTable, TableCell, HeaderCell, SideBadge } from '$lib/components/ui/table';
  import { Logo } from '$lib/components/ui';
  import { formatSigFig, formatTimeAgo, formatDecimal } from '$lib/utils/format.utils';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { app } from '$lib/state/app.state.svelte';

  interface Props {
    spotCanisterId: string | null;
    // Token identification - either by ledger or symbol
    baseLedger?: string;
    quoteLedger?: string;
    baseSymbol?: string;
    quoteSymbol?: string;
    // Optional limit (default 20)
    limit?: number;
  }

  let {
    spotCanisterId,
    baseLedger,
    quoteLedger,
    baseSymbol,
    quoteSymbol,
    limit = 20,
  }: Props = $props();

  // Transaction data
  let transactions = $state<ParsedTransaction[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Track which canister we've fetched to prevent infinite loops
  let fetchedCanisterId = $state<string | null>(null);

  // Get token metadata - prefer ledger lookup, fallback to symbol
  const baseToken = $derived.by(() => {
    if (baseLedger) return entityStore.getToken(baseLedger);
    if (baseSymbol) return entityStore.getTokenBySymbol(baseSymbol);
    return null;
  });

  const quoteToken = $derived.by(() => {
    if (quoteLedger) return entityStore.getToken(quoteLedger);
    if (quoteSymbol) return entityStore.getTokenBySymbol(quoteSymbol);
    // Default to ICP if no quote token specified
    return entityStore.getToken('ryjl3-tyaaa-aaaaa-aaaba-cai');
  });

  // Display symbols
  const displayBaseSymbol = $derived(baseToken?.displaySymbol ?? baseSymbol ?? 'Base');
  const displayQuoteSymbol = $derived(quoteToken?.displaySymbol ?? quoteSymbol ?? 'Quote');

  async function fetchTransactions(canisterId: string) {
    isLoading = true;
    error = null;

    try {
      transactions = await getSpotTransactions(canisterId, BigInt(limit));
    } catch (err) {
      console.error('[ActivityTable] Failed to fetch transactions:', err);
      error = 'Failed to load transactions';
      transactions = [];
    } finally {
      isLoading = false;
    }
  }

  // Load transactions when spotCanisterId is available
  $effect(() => {
    if (spotCanisterId && spotCanisterId !== fetchedCanisterId) {
      fetchedCanisterId = spotCanisterId;
      fetchTransactions(spotCanisterId);
    } else if (!spotCanisterId) {
      transactions = [];
      isLoading = false;
    }
  });

  // Format price_e12 to display string (E12 = 12 decimal places)
  function formatPriceE12(priceE12: bigint): string {
    const price = Number(priceE12) / 1e12;
    return formatSigFig(price, 5, { subscriptZeros: true });
  }

  // Format token amount - always use short: true for consistency
  function formatAmount(amount: number): string {
    if (amount === 0) return '0';
    return formatDecimal({ value: amount, displayDecimals: 6, short: true, commas: true });
  }

  // Format USD value
  function formatUsdValue(amount: number): string {
    return amount.toFixed(2);
  }
</script>

<div class="activity-table-wrapper">
  <DataTable
    data={transactions}
    loading={isLoading}
    error={error}
    emptyMessage="No recent transactions"
  >
    {#snippet header()}
      <HeaderCell align="left" width={80}>Time</HeaderCell>
      <HeaderCell align="center" width={60}>Side</HeaderCell>
      <HeaderCell align="right" grow>Price</HeaderCell>
      <HeaderCell align="right" grow>{displayBaseSymbol}</HeaderCell>
      <HeaderCell align="right" grow>{displayQuoteSymbol}</HeaderCell>
      <HeaderCell align="right" grow>USD</HeaderCell>
    {/snippet}

    {#snippet row(tx: ParsedTransaction)}
      {@const buy = isBuy(tx.side)}
      <TableCell align="left" width={80}>
        <span class="timestamp">{formatTimeAgo(tx.timestamp, app.now)}</span>
      </TableCell>
      <TableCell align="center" width={60}>
        <SideBadge side={tx.side} />
      </TableCell>
      <TableCell align="right" grow>
        <span class="numeric">{formatPriceE12(tx.priceE12)}</span>
      </TableCell>
      <TableCell align="right" grow>
        <div class="amount-cell">
          <span class={buy ? 'text-bullish' : 'text-bearish'}>
            {buy ? '+' : '-'}{formatAmount(tx.amountBase)}
          </span>
          {#if baseToken}
            <Logo src={baseToken.logo ?? undefined} alt={baseToken.symbol} size="xxs" circle={true} />
          {/if}
        </div>
      </TableCell>
      <TableCell align="right" grow>
        <div class="amount-cell">
          <span class="text-muted">
            {formatAmount(tx.amountQuote)}
          </span>
          {#if quoteToken}
            <Logo src={quoteToken.logo ?? undefined} alt={quoteToken.symbol} size="xxs" circle={true} />
          {/if}
        </div>
      </TableCell>
      <TableCell align="right" grow>
        <span class="numeric">${formatUsdValue(tx.usdValue)}</span>
      </TableCell>
    {/snippet}
  </DataTable>
</div>

<style>
  .activity-table-wrapper {
    position: relative;
    min-height: 158px;
    width: 100%;
  }

  /* Override DataTable container styles for inline use */
  .activity-table-wrapper :global(.data-table-container) {
    margin: 0;
    max-height: 400px;
  }

  /* Override flex layout with CSS Grid for consistent column widths */
  /* Matches SpotTransactions grid preset: 60px 60px 1fr 1fr 1fr 1fr */
  .activity-table-wrapper :global(.data-table-header-row),
  .activity-table-wrapper :global(.data-table-row) {
    display: grid !important;
    grid-template-columns: 80px 60px 1fr 1fr 1fr 1fr;
    /* Minimum width before horizontal scroll kicks in */
    min-width: 600px;
  }

  /* Header row styling - ensure it expands to match body width */
  .activity-table-wrapper :global(.data-table-header-row) {
    width: 100% !important;
    background: var(--background);
    border-radius: 12px;
  }

  /* Data row styling */
  .activity-table-wrapper :global(.data-table-row) {
    height: auto;
    min-height: 48px;
  }

  .activity-table-wrapper :global(.data-table-row:hover) {
    border-radius: 12px;
  }

  /* Muted timestamp */
  .timestamp {
    color: var(--muted-foreground);
    font-size: 14px;
  }

  /* Amount cell with logo - right-aligned content */
  .amount-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
  }

  /* Color utilities */
  .text-bullish {
    color: var(--color-bullish);
  }

  .text-bearish {
    color: var(--color-bearish);
  }

  .text-muted {
    color: var(--muted-foreground);
  }

  /* Numeric values */
  .numeric {
    font-variant-numeric: lining-nums tabular-nums;
  }
</style>
