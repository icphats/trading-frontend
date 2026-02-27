<script lang="ts">
  import type { BalanceSheet } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Modal from "../Modal.svelte";
  import { formatToken } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";

  interface Props {
    open: boolean;
    spot: SpotMarket;
    onClose?: () => void;
  }

  let { open = $bindable(false), spot, onClose }: Props = $props();

  let balanceSheet = $state<BalanceSheet | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Expandable sections
  let liabilitiesExpanded = $state(false);
  let equityExpanded = $state(false);
  let inv3Expanded = $state(false);

  // Auto-refresh interval (plain variable - NOT $state to avoid infinite $effect re-runs)
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let isPulsing = $state(false);
  let hasFetchedInitial = false;

  // Effect ONLY depends on `open` - no other reactive state read here
  $effect(() => {
    const isOpen = open; // Capture the only dependency

    if (isOpen) {
      // Initial fetch (use non-reactive flag to avoid re-triggering)
      if (!hasFetchedInitial) {
        hasFetchedInitial = true;
        fetchBalanceSheet();
      }

      // Start auto-refresh
      const interval = setInterval(() => {
        triggerRefresh();
      }, 1000);

      // Cleanup returns immediately with captured interval
      return () => {
        clearInterval(interval);
      };
    } else {
      // Reset flag when modal closes so next open fetches fresh
      hasFetchedInitial = false;
    }
  });

  function triggerRefresh() {
    isPulsing = true;
    fetchBalanceSheet();
    // Reset pulse after animation duration
    setTimeout(() => {
      isPulsing = false;
    }, 150);
  }

  async function fetchBalanceSheet() {
    // Only show loading on initial fetch
    if (!balanceSheet) {
      loading = true;
    }
    error = null;
    try {
      balanceSheet = await spot.getBalanceSheet();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleRefresh() {
    balanceSheet = null;
    fetchBalanceSheet();
  }

  // Get token metadata from entityStore
  const baseToken = $derived.by(() => {
    const ledgerId = spot.tokens?.[0]?.toString();
    return ledgerId ? entityStore.getToken(ledgerId) : null;
  });

  const quoteToken = $derived.by(() => {
    const ledgerId = spot.tokens?.[1]?.toString();
    return ledgerId ? entityStore.getToken(ledgerId) : null;
  });

  const baseSymbol = $derived(baseToken?.displaySymbol ?? "BASE");
  const quoteSymbol = $derived(quoteToken?.displaySymbol ?? "QUOTE");
  const baseDecimals = $derived(baseToken?.decimals ?? 8);
  const quoteDecimals = $derived(quoteToken?.decimals ?? 8);

  // Format functions
  function fmtBase(value: bigint | null | undefined): string {
    if (value == null) return "—";
    return formatToken({ value, unitName: baseDecimals, displayDecimals: baseDecimals, commas: true });
  }

  function fmtQuote(value: bigint | null | undefined): string {
    if (value == null) return "—";
    return formatToken({ value, unitName: quoteDecimals, displayDecimals: quoteDecimals, commas: true });
  }

  function fmtDrift(value: bigint | null | undefined): string {
    if (value == null) return "—";
    const isNegative = value > 2n ** 63n;
    if (isNegative) {
      const actual = -(2n ** 64n - value);
      return actual.toString();
    }
    return value === 0n ? "0" : `+${value.toString()}`;
  }
</script>

<Modal bind:open {onClose} title="Balance Sheet" size="lg" compactHeader={true}>
  {#snippet children()}
    <div class="balance-sheet">
      {#if loading && !balanceSheet}
        <div class="modal-state">
          <p class="modal-state-text">Loading balance sheet...</p>
        </div>
      {:else if error}
        <div class="modal-state">
          <p class="modal-state-text error">{error}</p>
          <button class="refresh-btn" onclick={handleRefresh}>Retry</button>
        </div>
      {:else if balanceSheet}
        <!-- Column Headers -->
        <div class="column-headers">
          <button
            class="auto-refresh-btn"
            class:pulsing={isPulsing}
            onclick={triggerRefresh}
          >
            ↻ Auto-refresh (1s)
          </button>
          <span class="col-token">{baseSymbol}</span>
          <span class="col-token">{quoteSymbol}</span>
        </div>

        <!-- Assets Section -->
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">Assets</span>
          </div>
          <div class="section-row">
            <span class="row-label">Virtual Custody</span>
            <span class="row-value">{fmtBase(balanceSheet.assets.base_balance)}</span>
            <span class="row-value">{fmtQuote(balanceSheet.assets.quote_balance)}</span>
          </div>
        </div>

        <!-- Liabilities Section -->
        <div class="section-card" class:expanded={liabilitiesExpanded}>
          <button class="section-header clickable" onclick={() => liabilitiesExpanded = !liabilitiesExpanded}>
            <span class="section-title">Liabilities</span>
            <span class="expand-icon">{liabilitiesExpanded ? '−' : '+'}</span>
          </button>
          <div class="section-row total-row">
            <span class="row-label">Total</span>
            <span class="row-value">{fmtBase(balanceSheet.liabilities.total_base)}</span>
            <span class="row-value">{fmtQuote(balanceSheet.liabilities.total_quote)}</span>
          </div>
          {#if liabilitiesExpanded}
            <div class="breakdown">
              <div class="section-row sub-row">
                <span class="row-label">Orders (Input)</span>
                <span class="row-value muted">{fmtBase(balanceSheet.liabilities.orders_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.liabilities.orders_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Orders (Output)</span>
                <span class="row-value muted">{fmtBase(balanceSheet.liabilities.orders_output_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.liabilities.orders_output_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Triggers</span>
                <span class="row-value muted">{fmtBase(balanceSheet.liabilities.triggers_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.liabilities.triggers_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Pending Outflows</span>
                <span class="row-value muted">{fmtBase(balanceSheet.liabilities.pending_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.liabilities.pending_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Available</span>
                <span class="row-value muted">{fmtBase(balanceSheet.liabilities.available_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.liabilities.available_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Pool Reserves</span>
                <span class="row-value muted">{fmtBase(balanceSheet.liabilities.pool_reserves_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.liabilities.pool_reserves_quote)}</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Equity Section -->
        <div class="section-card" class:expanded={equityExpanded}>
          <button class="section-header clickable" onclick={() => equityExpanded = !equityExpanded}>
            <span class="section-title">Equity</span>
            <span class="expand-icon">{equityExpanded ? '−' : '+'}</span>
          </button>
          <div class="section-row total-row">
            <span class="row-label">Total</span>
            <span class="row-value">{fmtBase(balanceSheet.equity.total_base)}</span>
            <span class="row-value">{fmtQuote(balanceSheet.equity.total_quote)}</span>
          </div>
          {#if equityExpanded}
            <div class="breakdown">
              <div class="section-row sub-row">
                <span class="row-label">Book Fees</span>
                <span class="row-value muted">{fmtBase(balanceSheet.equity.book_fees_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.equity.book_fees_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Pool Fees</span>
                <span class="row-value muted">{fmtBase(balanceSheet.equity.pool_fees_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.equity.pool_fees_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Operation Fees</span>
                <span class="row-value muted">{fmtBase(balanceSheet.equity.op_fees_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.equity.op_fees_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Available</span>
                <span class="row-value muted">{fmtBase(balanceSheet.equity.available_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.equity.available_quote)}</span>
              </div>
              <div class="section-row sub-row">
                <span class="row-label">Withdrawn</span>
                <span class="row-value muted">{fmtBase(balanceSheet.equity.withdrawn_base)}</span>
                <span class="row-value muted">{fmtQuote(balanceSheet.equity.withdrawn_quote)}</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- INV-1 Section: Internal consistency (virtual = liabilities + equity) -->
        <div class="section-card" class:has-drift={!balanceSheet.is_balanced}>
          <div class="section-header">
            <span class="section-title">INV-1: Internal</span>
          </div>
          <div class="section-row">
            <span class="row-label">Drift (V - L - E)</span>
            <span class="row-value" class:drift-error={balanceSheet.drift_base != null && balanceSheet.drift_base !== 0n}>{fmtDrift(balanceSheet.drift_base)}</span>
            <span class="row-value" class:drift-error={balanceSheet.drift_quote != null && balanceSheet.drift_quote !== 0n}>{fmtDrift(balanceSheet.drift_quote)}</span>
          </div>
        </div>

        <!-- INV-2 Section: User fund conservation -->
        <div class="section-card" class:has-drift={!balanceSheet.users_debug.inv2_balanced}>
          <div class="section-header">
            <span class="section-title">INV-2: User Funds</span>
          </div>
          <div class="section-row">
            <span class="row-label">Status</span>
            {#if balanceSheet.users_debug.inv2_balanced}
              <span class="row-value inv-pass" style="grid-column: 2 / -1; text-align: right;">Conserved</span>
            {:else}
              <span class="row-value inv-fail" style="grid-column: 2 / -1; text-align: right;">{balanceSheet.users_debug.users_with_drift.toString()} users drifted</span>
            {/if}
          </div>
          {#if !balanceSheet.users_debug.inv2_balanced}
            <div class="breakdown">
              <div class="section-row sub-row">
                <span class="row-label">INV-2 Drift</span>
                <span class="row-value muted" class:drift-error={balanceSheet.users_debug.total_inv2_drift_base !== 0n}>{fmtDrift(balanceSheet.users_debug.total_inv2_drift_base)}</span>
                <span class="row-value muted" class:drift-error={balanceSheet.users_debug.total_inv2_drift_quote !== 0n}>{fmtDrift(balanceSheet.users_debug.total_inv2_drift_quote)}</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- INV-3 Section: Pool health -->
        <div class="section-card" class:has-drift={!balanceSheet.pool_invariants.all_pools_healthy} class:expanded={inv3Expanded}>
          {#if balanceSheet.pool_invariants.all_pools_healthy}
            <div class="section-header">
              <span class="section-title">INV-3: Pool Health</span>
            </div>
            <div class="section-row">
              <span class="row-label">Status</span>
              <span class="row-value inv-pass" style="grid-column: 2 / -1; text-align: right;">All Healthy</span>
            </div>
          {:else}
            <button class="section-header clickable" onclick={() => inv3Expanded = !inv3Expanded}>
              <span class="section-title">INV-3: Pool Health</span>
              <span class="expand-icon">{inv3Expanded ? '\u2212' : '+'}</span>
            </button>
            <div class="section-row">
              <span class="row-label">Status</span>
              <span class="row-value inv-fail" style="grid-column: 2 / -1; text-align: right;">{balanceSheet.pool_invariants.unhealthy_pools.length} unhealthy</span>
            </div>
            {#if inv3Expanded}
              <div class="breakdown">
                {#each balanceSheet.pool_invariants.pools as pool}
                  {#if !pool.inv3a_balanced || !pool.inv3b_balanced || !pool.inv3c_balanced}
                    <div class="section-row sub-row">
                      <span class="row-label">{pool.fee_pips} pips</span>
                      <span class="row-value muted inv-fail" style="grid-column: 2 / -1; text-align: right;">
                        {[!pool.inv3a_balanced ? '3a' : '', !pool.inv3b_balanced ? '3b' : '', !pool.inv3c_balanced ? '3c' : ''].filter(Boolean).join(', ')} failed
                      </span>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {:else}
        <div class="modal-empty">
          <p>No data available</p>
        </div>
      {/if}
    </div>
  {/snippet}
</Modal>

<style>
  .balance-sheet {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Column Headers */
  .column-headers {
    display: grid;
    grid-template-columns: 1fr 12rem 12rem;
    gap: 0.75rem;
    padding: 0 0.75rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }

  .col-token {
    text-align: right;
    justify-self: end;
  }

  /* Section Cards */
  .section-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .section-card.expanded {
    border-color: var(--primary);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--muted);
  }

  .section-header.clickable {
    width: 100%;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .section-header.clickable:hover {
    background: oklch(from var(--muted) calc(l * 0.95) c h);
  }

  .section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--foreground);
  }

  .expand-icon {
    font-size: 0.875rem;
    font-weight: 400;
    color: var(--muted-foreground);
  }

  /* Section Rows */
  .section-row {
    display: grid;
    grid-template-columns: 1fr 12rem 12rem;
    gap: 0.75rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    align-items: center;
  }

  .section-row.total-row {
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }

  .section-row.sub-row {
    padding: 0.25rem 0.75rem;
  }

  .section-row.sub-row .row-label {
    padding-left: 0.75rem;
    color: var(--muted-foreground);
  }

  .row-label {
    color: var(--foreground);
  }

  .row-value {
    font-family: var(--font-mono);
    text-align: right;
    justify-self: end;
    color: var(--foreground);
  }

  .row-value.muted {
    color: var(--muted-foreground);
  }

  /* Breakdown Animation */
  .breakdown {
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-0.25rem); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Drift Error State */
  .section-card.has-drift {
    border-color: var(--color-bearish);
    background: oklch(from var(--color-bearish) l c h / 0.05);
  }

  .row-value.drift-error {
    color: var(--color-bearish);
    font-weight: 600;
  }

  .inv-pass {
    color: var(--color-bullish);
    font-weight: 600;
  }

  .inv-fail {
    color: var(--color-bearish);
    font-weight: 600;
  }

  /* Auto-refresh Button */
  .auto-refresh-btn {
    justify-self: start;
    padding: 0.2rem 0.4rem;
    background: transparent;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    transition: all 0.1s ease-out;
  }

  .auto-refresh-btn:hover {
    background: var(--card);
    color: var(--foreground);
    border-color: var(--foreground);
  }

  .auto-refresh-btn.pulsing {
    transform: scale(0.95);
    background: var(--border);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  /* Utility */
  .refresh-btn {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
  }
</style>
