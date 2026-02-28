<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Modal from "../Modal.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { bigIntToString } from "$lib/domain/markets/utils";

  interface Props {
    open: boolean;
    spot: SpotMarket;
    onClose?: () => void;
  }

  let { open = $bindable(false), spot, onClose }: Props = $props();

  // Get token metadata from entityStore
  let base = $derived.by(() =>
    spot?.tokens?.[0] ? entityStore.getToken(spot.tokens[0].toString()) : null
  );
  let quote = $derived.by(() =>
    spot?.tokens?.[1] ? entityStore.getToken(spot.tokens[1].toString()) : null
  );

  // USD value helpers
  function calculateUsdValue(balance: bigint, price: bigint, decimals: number): number {
    if (balance === 0n || price === 0n) return 0;
    const balanceFloat = Number(balance) / (10 ** decimals);
    const priceFloat = Number(price) / 1e12;
    return balanceFloat * priceFloat;
  }

  function formatUsd(value: number): string {
    if (value === 0) return "";
    if (value < 0.01) return "<$0.01";
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  }

  function getUsd(balance: bigint, token: typeof base): string {
    if (!token) return "";
    return formatUsd(calculateUsdValue(balance, token.priceUsd, token.decimals));
  }

  // Format available balances
  let availableBase = $derived.by(() =>
    base && spot ? bigIntToString(spot.availableBase, base.decimals) : "0"
  );
  let availableQuote = $derived.by(() =>
    quote && spot ? bigIntToString(spot.availableQuote, quote.decimals) : "0"
  );

  // Format locked balances by type
  let ordersBase = $derived.by(() =>
    base && spot ? bigIntToString(spot.ordersLockedBase, base.decimals) : "0"
  );
  let ordersQuote = $derived.by(() =>
    quote && spot ? bigIntToString(spot.ordersLockedQuote, quote.decimals) : "0"
  );
  let triggersBase = $derived.by(() =>
    base && spot ? bigIntToString(spot.triggersLockedBase, base.decimals) : "0"
  );
  let triggersQuote = $derived.by(() =>
    quote && spot ? bigIntToString(spot.triggersLockedQuote, quote.decimals) : "0"
  );
  let positionsBase = $derived.by(() =>
    base && spot ? bigIntToString(spot.positionsLockedBase, base.decimals) : "0"
  );
  let positionsQuote = $derived.by(() =>
    quote && spot ? bigIntToString(spot.positionsLockedQuote, quote.decimals) : "0"
  );
  let feesBase = $derived.by(() =>
    base && spot ? bigIntToString(spot.feesBase, base.decimals) : "0"
  );
  let feesQuote = $derived.by(() =>
    quote && spot ? bigIntToString(spot.feesQuote, quote.decimals) : "0"
  );

  // Calculate totals
  let totalBaseBigInt = $derived.by(() => {
    if (!spot) return 0n;
    return spot.availableBase + spot.ordersLockedBase + spot.triggersLockedBase + spot.positionsLockedBase + spot.feesBase;
  });
  let totalQuoteBigInt = $derived.by(() => {
    if (!spot) return 0n;
    return spot.availableQuote + spot.ordersLockedQuote + spot.triggersLockedQuote + spot.positionsLockedQuote + spot.feesQuote;
  });
  let totalBase = $derived.by(() => {
    if (!base) return "0";
    return bigIntToString(totalBaseBigInt, base.decimals);
  });
  let totalQuote = $derived.by(() => {
    if (!quote) return "0";
    return bigIntToString(totalQuoteBigInt, quote.decimals);
  });

</script>

<Modal bind:open {onClose} title="Trading Balance" size="md" compactHeader={true}>
  {#snippet children()}
    <div class="balance-content">
      <div class="locked-table">
        <!-- Header -->
        <div class="table-header">
          <span class="header-label"></span>
          <span class="header-token">{base?.displaySymbol ?? 'BASE'}</span>
          <span class="header-token">{quote?.displaySymbol ?? 'QUOTE'}</span>
        </div>

        <!-- Available -->
        <div class="table-row">
          <span class="row-label">Available</span>
          <div class="row-value">
            <span class="balance">{availableBase}</span>
            <span class="usd">{getUsd(spot.availableBase, base)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{availableQuote}</span>
            <span class="usd">{getUsd(spot.availableQuote, quote)}</span>
          </div>
        </div>

        <!-- Locked Rows -->
        <div class="table-row">
          <span class="row-label">In Orders</span>
          <div class="row-value">
            <span class="balance">{ordersBase}</span>
            <span class="usd">{getUsd(spot.ordersLockedBase, base)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{ordersQuote}</span>
            <span class="usd">{getUsd(spot.ordersLockedQuote, quote)}</span>
          </div>
        </div>

        <div class="table-row">
          <span class="row-label">In Triggers</span>
          <div class="row-value">
            <span class="balance">{triggersBase}</span>
            <span class="usd">{getUsd(spot.triggersLockedBase, base)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{triggersQuote}</span>
            <span class="usd">{getUsd(spot.triggersLockedQuote, quote)}</span>
          </div>
        </div>

        <div class="table-row">
          <span class="row-label">In Positions</span>
          <div class="row-value">
            <span class="balance">{positionsBase}</span>
            <span class="usd">{getUsd(spot.positionsLockedBase, base)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{positionsQuote}</span>
            <span class="usd">{getUsd(spot.positionsLockedQuote, quote)}</span>
          </div>
        </div>

        <div class="table-row">
          <span class="row-label">Uncollected Fees</span>
          <div class="row-value">
            <span class="balance" class:highlight={spot.feesBase > 0n}>{feesBase}</span>
            <span class="usd">{getUsd(spot.feesBase, base)}</span>
          </div>
          <div class="row-value">
            <span class="balance" class:highlight={spot.feesQuote > 0n}>{feesQuote}</span>
            <span class="usd">{getUsd(spot.feesQuote, quote)}</span>
          </div>
        </div>

        <!-- Total -->
        <div class="table-row total">
          <span class="row-label">Total</span>
          <div class="row-value">
            <span class="balance">{totalBase}</span>
            <span class="usd">{getUsd(totalBaseBigInt, base)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{totalQuote}</span>
            <span class="usd">{getUsd(totalQuoteBigInt, quote)}</span>
          </div>
        </div>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .balance-content {
    padding: 0.75rem 0;
  }

  .locked-table {
    display: flex;
    flex-direction: column;
  }

  .table-header {
    display: grid;
    grid-template-columns: 1fr 7rem 7rem;
    gap: 0.5rem;
    padding: 0 0 0.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.25rem;
  }

  .header-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .header-token {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: right;
  }

  .table-row {
    display: grid;
    grid-template-columns: 1fr 7rem 7rem;
    gap: 0.5rem;
    padding: 0.375rem 0;
  }

  .table-row.total {
    border-top: 1px solid var(--border);
    margin-top: 0.25rem;
    padding-top: 0.5rem;
  }

  .row-label {
    font-size: 0.8125rem;
    color: var(--foreground);
  }

  .table-row.total .row-label {
    font-weight: 600;
  }

  .row-value {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.125rem;
  }

  .balance {
    font-size: 0.8125rem;
    font-family: var(--font-sans);
    font-weight: 600;
    color: var(--foreground);
  }

  .table-row.total .balance {
    font-weight: 600;
  }

  .usd {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    min-height: 1rem;
  }

  .highlight {
    color: var(--color-bullish);
  }
</style>
