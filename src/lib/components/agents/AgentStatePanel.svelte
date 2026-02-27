<script lang="ts">
  import { agentEngine } from '$lib/domain/agents/agent-engine.svelte';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { basePriceUsd } from '$lib/domain/agents/agent-price';

  let { market }: { market: import('$lib/domain/markets/state/spot-market.svelte').SpotMarket | null } = $props();

  let tick = $derived(market?.lastTradeTick ?? null);
  let priceUsd = $derived(
    market && market.lastTradeTick !== null
      ? basePriceUsd(market.lastTradeTick, market.baseTokenDecimals, market.quoteTokenDecimals, market.token_symbol)
      : 0
  );

  let availBase = $derived(market?.availableBase ?? 0n);
  let availQuote = $derived(market?.availableQuote ?? 0n);
  let lockedOrdersBase = $derived(market?.ordersLockedBase ?? 0n);
  let lockedOrdersQuote = $derived(market?.ordersLockedQuote ?? 0n);
  let lockedTriggersBase = $derived(market?.triggersLockedBase ?? 0n);
  let lockedTriggersQuote = $derived(market?.triggersLockedQuote ?? 0n);
  let lockedPosBase = $derived(market?.positionsLockedBase ?? 0n);
  let lockedPosQuote = $derived(market?.positionsLockedQuote ?? 0n);

  let orderCount = $derived(market?.userOrders.length ?? 0);
  let triggerCount = $derived(market?.userTriggers.length ?? 0);
  let positionCount = $derived(market?.userPositions.length ?? 0);

  let baseDec = $derived(market?.baseTokenDecimals ?? 8);
  let quoteDec = $derived(market?.quoteTokenDecimals ?? 6);
  let baseSymbol = $derived(market?.token_symbol.split('/')[0] ?? 'BASE');
  let quoteSymbol = $derived(market?.token_symbol.split('/')[1] ?? 'QUOTE');

  function fmt(val: bigint, decimals: number): string {
    const num = Number(val) / (10 ** decimals);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    if (num >= 1) return num.toFixed(2);
    if (num > 0) return num.toFixed(Math.min(6, decimals));
    return '0';
  }
</script>

<div class="state-panel">
  <!-- Price -->
  <div class="panel-section">
    <div class="section-label">Market</div>
    <div class="stat-row">
      <span class="stat-key">Tick</span>
      <span class="stat-value mono">{tick?.toLocaleString() ?? '—'}</span>
    </div>
    <div class="stat-row">
      <span class="stat-key">Price</span>
      <span class="stat-value mono">${priceUsd.toFixed(priceUsd > 100 ? 2 : priceUsd > 1 ? 4 : 6)}</span>
    </div>
  </div>

  <!-- Available Balances -->
  <div class="panel-section">
    <div class="section-label">Available</div>
    <div class="stat-row">
      <span class="stat-key">{baseSymbol}</span>
      <span class="stat-value mono">{fmt(availBase, baseDec)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-key">{quoteSymbol}</span>
      <span class="stat-value mono">{fmt(availQuote, quoteDec)}</span>
    </div>
  </div>

  <!-- Locked Balances -->
  <div class="panel-section">
    <div class="section-label">Locked</div>
    <div class="stat-row sub">
      <span class="stat-key">Orders</span>
      <span class="stat-value mono">{fmt(lockedOrdersBase, baseDec)} / {fmt(lockedOrdersQuote, quoteDec)}</span>
    </div>
    <div class="stat-row sub">
      <span class="stat-key">Triggers</span>
      <span class="stat-value mono">{fmt(lockedTriggersBase, baseDec)} / {fmt(lockedTriggersQuote, quoteDec)}</span>
    </div>
    <div class="stat-row sub">
      <span class="stat-key">Positions</span>
      <span class="stat-value mono">{fmt(lockedPosBase, baseDec)} / {fmt(lockedPosQuote, quoteDec)}</span>
    </div>
  </div>

  <!-- Entity Counts -->
  <div class="panel-section">
    <div class="section-label">Entities</div>
    <div class="stat-row">
      <span class="stat-key">Orders</span>
      <span class="stat-value">{orderCount} <span class="stat-cap">/ 50</span></span>
    </div>
    <div class="stat-row">
      <span class="stat-key">Triggers</span>
      <span class="stat-value">{triggerCount} <span class="stat-cap">/ 20</span></span>
    </div>
    <div class="stat-row">
      <span class="stat-key">Positions</span>
      <span class="stat-value">{positionCount} <span class="stat-cap">/ 10</span></span>
    </div>
  </div>

  <!-- Agent Stats -->
  <div class="panel-section">
    <div class="section-label">Agent</div>
    <div class="stat-row">
      <span class="stat-key">Ticks</span>
      <span class="stat-value mono">{agentEngine.tickCount}</span>
    </div>
    <div class="stat-row">
      <span class="stat-key">Errors</span>
      <span class="stat-value mono" class:error-highlight={agentEngine.errorCount > 0}>
        {agentEngine.errorCount}
      </span>
    </div>
    {#if agentEngine.lastAction}
      <div class="stat-row">
        <span class="stat-key">Last</span>
        <span class="stat-value mono last-action">{agentEngine.lastAction}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .state-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--terminal-bg);
    border-radius: 16px;
    border: 1px solid oklch(1 0 0 / 0.06);
    overflow-y: auto;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .section-label {
    font-size: 0.625rem;
    font-weight: 500;
    color: oklch(1 0 0 / 0.3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.125rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-row.sub {
    padding-left: 0.25rem;
  }

  .stat-key {
    font-size: 0.6875rem;
    color: oklch(1 0 0 / 0.45);
  }

  .stat-value {
    font-size: 0.6875rem;
    color: oklch(1 0 0 / 0.8);
    text-align: right;
  }

  .stat-value.mono {
    font-family: var(--font-mono);
  }

  .stat-cap {
    color: oklch(1 0 0 / 0.2);
    font-size: 0.5625rem;
  }

  .error-highlight {
    color: var(--color-bearish);
  }

  .last-action {
    font-size: 0.5625rem;
    color: oklch(0.72 0.12 300);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
