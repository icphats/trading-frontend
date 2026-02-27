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
  let token0 = $derived.by(() =>
    spot?.tokens?.[0] ? entityStore.getToken(spot.tokens[0].toString()) : null
  );
  let token1 = $derived.by(() =>
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

  function getUsd(balance: bigint, token: typeof token0): string {
    if (!token) return "";
    return formatUsd(calculateUsdValue(balance, token.priceUsd, token.decimals));
  }

  // Format available balances
  let availableBase = $derived.by(() =>
    token0 && spot ? bigIntToString(spot.availableBase, token0.decimals) : "0"
  );
  let availableQuote = $derived.by(() =>
    token1 && spot ? bigIntToString(spot.availableQuote, token1.decimals) : "0"
  );

  // Format locked balances by type
  let ordersBase = $derived.by(() =>
    token0 && spot ? bigIntToString(spot.ordersLockedBase, token0.decimals) : "0"
  );
  let ordersQuote = $derived.by(() =>
    token1 && spot ? bigIntToString(spot.ordersLockedQuote, token1.decimals) : "0"
  );
  let triggersBase = $derived.by(() =>
    token0 && spot ? bigIntToString(spot.triggersLockedBase, token0.decimals) : "0"
  );
  let triggersQuote = $derived.by(() =>
    token1 && spot ? bigIntToString(spot.triggersLockedQuote, token1.decimals) : "0"
  );
  let positionsBase = $derived.by(() =>
    token0 && spot ? bigIntToString(spot.positionsLockedBase, token0.decimals) : "0"
  );
  let positionsQuote = $derived.by(() =>
    token1 && spot ? bigIntToString(spot.positionsLockedQuote, token1.decimals) : "0"
  );
  let feesBase = $derived.by(() =>
    token0 && spot ? bigIntToString(spot.feesBase, token0.decimals) : "0"
  );
  let feesQuote = $derived.by(() =>
    token1 && spot ? bigIntToString(spot.feesQuote, token1.decimals) : "0"
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
    if (!token0) return "0";
    return bigIntToString(totalBaseBigInt, token0.decimals);
  });
  let totalQuote = $derived.by(() => {
    if (!token1) return "0";
    return bigIntToString(totalQuoteBigInt, token1.decimals);
  });

</script>

<Modal bind:open {onClose} title="Trading Balance" size="md" compactHeader={true}>
  {#snippet children()}
    <div class="balance-content">
      <div class="locked-table">
        <!-- Header -->
        <div class="table-header">
          <span class="header-label"></span>
          <span class="header-token">{token0?.displaySymbol ?? 'BASE'}</span>
          <span class="header-token">{token1?.displaySymbol ?? 'QUOTE'}</span>
        </div>

        <!-- Available -->
        <div class="table-row">
          <span class="row-label">Available</span>
          <div class="row-value">
            <span class="balance">{availableBase}</span>
            <span class="usd">{getUsd(spot.availableBase, token0)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{availableQuote}</span>
            <span class="usd">{getUsd(spot.availableQuote, token1)}</span>
          </div>
        </div>

        <!-- Locked Rows -->
        <div class="table-row">
          <span class="row-label">In Orders</span>
          <div class="row-value">
            <span class="balance">{ordersBase}</span>
            <span class="usd">{getUsd(spot.ordersLockedBase, token0)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{ordersQuote}</span>
            <span class="usd">{getUsd(spot.ordersLockedQuote, token1)}</span>
          </div>
        </div>

        <div class="table-row">
          <span class="row-label">In Triggers</span>
          <div class="row-value">
            <span class="balance">{triggersBase}</span>
            <span class="usd">{getUsd(spot.triggersLockedBase, token0)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{triggersQuote}</span>
            <span class="usd">{getUsd(spot.triggersLockedQuote, token1)}</span>
          </div>
        </div>

        <div class="table-row">
          <span class="row-label">In Positions</span>
          <div class="row-value">
            <span class="balance">{positionsBase}</span>
            <span class="usd">{getUsd(spot.positionsLockedBase, token0)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{positionsQuote}</span>
            <span class="usd">{getUsd(spot.positionsLockedQuote, token1)}</span>
          </div>
        </div>

        <div class="table-row">
          <span class="row-label">Uncollected Fees</span>
          <div class="row-value">
            <span class="balance" class:highlight={spot.feesBase > 0n}>{feesBase}</span>
            <span class="usd">{getUsd(spot.feesBase, token0)}</span>
          </div>
          <div class="row-value">
            <span class="balance" class:highlight={spot.feesQuote > 0n}>{feesQuote}</span>
            <span class="usd">{getUsd(spot.feesQuote, token1)}</span>
          </div>
        </div>

        <!-- Total -->
        <div class="table-row total">
          <span class="row-label">Total</span>
          <div class="row-value">
            <span class="balance">{totalBase}</span>
            <span class="usd">{getUsd(totalBaseBigInt, token0)}</span>
          </div>
          <div class="row-value">
            <span class="balance">{totalQuote}</span>
            <span class="usd">{getUsd(totalQuoteBigInt, token1)}</span>
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
