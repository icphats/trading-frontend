<script lang="ts">
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { BalanceSheet } from "$lib/actors/services/spot.service";
  import type { PoolOverview } from 'declarations/spot/spot.did';
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { fetchPoolsOverview } from "$lib/domain/orchestration";
  import { formatToken, formatSigFig } from "$lib/utils/format.utils";
  import { tickToPrice } from "$lib/domain/markets/utils/math";
  import Tabs from "$lib/components/ui/Tabs.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";

  interface Props {
    spot: SpotMarket;
  }

  let { spot }: Props = $props();

  // Tab state
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "pools", label: "Pools" },
    { id: "balance-sheet", label: "Audit" },
  ];
  let activeTab = $state("overview");

  // ── Token metadata (from entityStore — no query needed) ──
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

  // ── Pools Overview (lazy-loaded on tab switch) ──
  let poolsOverview = $state<PoolOverview[]>([]);
  let poolsLoading = $state(false);
  let poolsError = $state<string | null>(null);

  $effect(() => {
    if (activeTab === "pools") {
      fetchPools();
    }
  });

  async function fetchPools() {
    if (poolsOverview.length === 0) poolsLoading = true;
    poolsError = null;
    try {
      poolsOverview = await fetchPoolsOverview(spot.canister_id);
    } catch (e) {
      poolsError = e instanceof Error ? e.message : String(e);
    } finally {
      poolsLoading = false;
    }
  }

  // ── Balance Sheet (lazy-loaded on tab switch) ──
  let balanceSheet = $state<BalanceSheet | null>(null);
  let bsLoading = $state(false);
  let bsError = $state<string | null>(null);
  let bsRefreshInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (activeTab === "balance-sheet") {
      fetchBalanceSheet();
      bsRefreshInterval = setInterval(() => fetchBalanceSheet(), 1000);
      return () => {
        if (bsRefreshInterval) clearInterval(bsRefreshInterval);
      };
    } else {
      balanceSheet = null;
      bsError = null;
    }
  });

  async function fetchBalanceSheet() {
    if (!balanceSheet) bsLoading = true;
    bsError = null;
    try {
      balanceSheet = await spot.getBalanceSheet();
    } catch (e) {
      bsError = e instanceof Error ? e.message : String(e);
    } finally {
      bsLoading = false;
    }
  }

  // ── Format helpers ──
  function fmtBase(value: bigint | null | undefined): string {
    if (value == null) return "\u2014";
    return formatToken({ value, unitName: baseDecimals, displayDecimals: baseDecimals, commas: true });
  }

  function fmtQuote(value: bigint | null | undefined): string {
    if (value == null) return "\u2014";
    return formatToken({ value, unitName: quoteDecimals, displayDecimals: quoteDecimals, commas: true });
  }

  function fmtDrift(value: bigint | null | undefined): string {
    if (value == null) return "\u2014";
    const isNegative = value > 2n ** 63n;
    if (isNegative) {
      const actual = -(2n ** 64n - value);
      return actual.toString();
    }
    return value === 0n ? "0" : `+${value.toString()}`;
  }

  // Expandable sections for balance sheet
  let liabilitiesExpanded = $state(false);
  let equityExpanded = $state(false);
  let inv3Expanded = $state(false);
</script>

<div class="market-info-panel">
  <Tabs {tabs} {activeTab} onTabChange={(id) => activeTab = id}>
    {#snippet children(currentTab)}
      <div class="tab-content">
        {#if currentTab === "overview"}
          <!-- ═══ OVERVIEW TAB ═══ -->
          <div class="info-sections">
            <!-- Platform -->
            <div class="info-section">
              <h3 class="section-heading">Platform</h3>
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Canister ID</span>
                  <CopyableId id={spot.canister_id} variant="inline" size="sm" />
                </div>
                <div class="info-row">
                  <span class="info-label">MAU</span>
                  <span class="info-value mono">{spot.users.toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Live Orders</span>
                  <span class="info-value mono">{spot.ordersLive.toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Live Triggers</span>
                  <span class="info-value mono">{spot.triggersLive.toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Live Positions</span>
                  <span class="info-value mono">{spot.totalPositions.toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Total Transactions</span>
                  <span class="info-value mono">{spot.totalTransactions.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <!-- Tokens -->
            <div class="info-section">
              <div class="tokens-grid">
                <div class="tokens-row tokens-header-row">
                  <span class="tokens-label">Tokens</span>
                  <span class="tokens-header-token">
                    <Logo src={baseToken?.logo ?? undefined} alt={baseSymbol} size="xxs" circle={true} />
                    <span>{baseSymbol}</span>
                  </span>
                  <span class="tokens-header-token">
                    <Logo src={quoteToken?.logo ?? undefined} alt={quoteSymbol} size="xxs" circle={true} />
                    <span>{quoteSymbol}</span>
                  </span>
                </div>
                <div class="tokens-row">
                  <span class="tokens-label">Ledger</span>
                  <span class="tokens-val">
                    {#if spot.tokens?.[0]}
                      <CopyableId id={spot.tokens[0].toString()} variant="inline" size="sm" />
                    {:else}
                      <span class="tokens-dash">{"\u2014"}</span>
                    {/if}
                  </span>
                  <span class="tokens-val">
                    {#if spot.tokens?.[1]}
                      <CopyableId id={spot.tokens[1].toString()} variant="inline" size="sm" />
                    {:else}
                      <span class="tokens-dash">{"\u2014"}</span>
                    {/if}
                  </span>
                </div>
                <div class="tokens-row">
                  <span class="tokens-label">Decimals</span>
                  <span class="tokens-val mono">{baseDecimals}</span>
                  <span class="tokens-val mono">{quoteDecimals}</span>
                </div>
                {#if baseToken?.totalSupply || quoteToken?.totalSupply}
                  <div class="tokens-row">
                    <span class="tokens-label">Total Supply</span>
                    <span class="tokens-val mono">{fmtBase(baseToken?.totalSupply ?? null)}</span>
                    <span class="tokens-val mono">{fmtQuote(quoteToken?.totalSupply ?? null)}</span>
                  </div>
                {/if}
                {#if baseToken?.fee != null || quoteToken?.fee != null}
                  <div class="tokens-row">
                    <span class="tokens-label">Transfer Fee</span>
                    <span class="tokens-val mono">{fmtBase(baseToken?.fee ?? null)}</span>
                    <span class="tokens-val mono">{fmtQuote(quoteToken?.fee ?? null)}</span>
                  </div>
                {/if}
                <div class="tokens-row">
                  <span class="tokens-label">Book Depth</span>
                  <span class="tokens-val mono">${formatToken({ value: spot.bookDepthBaseUsdE6, unitName: 6, short: true })}</span>
                  <span class="tokens-val mono">${formatToken({ value: spot.bookDepthQuoteUsdE6, unitName: 6, short: true })}</span>
                </div>
                <div class="tokens-row">
                  <span class="tokens-label">Pool Depth</span>
                  <span class="tokens-val mono">${formatToken({ value: spot.poolDepthBaseUsdE6, unitName: 6, short: true })}</span>
                  <span class="tokens-val mono">${formatToken({ value: spot.poolDepthQuoteUsdE6, unitName: 6, short: true })}</span>
                </div>
              </div>
            </div>

          </div>

        {:else if currentTab === "pools"}
          <!-- ═══ POOLS TAB ═══ -->
          <div class="info-sections">
            {#if poolsLoading && poolsOverview.length === 0}
              <div class="tab-placeholder">
                <p class="placeholder-text">Loading pools...</p>
              </div>
            {:else if poolsError}
              <div class="tab-placeholder">
                <p class="placeholder-text error">{poolsError}</p>
                <button class="retry-btn" onclick={() => { poolsOverview = []; fetchPools(); }}>Retry</button>
              </div>
            {:else if poolsOverview.length > 0}
              <!-- Active Pools -->
              <div class="info-section">
                <h3 class="section-heading">Active Pools</h3>
                <div class="pool-table">
                  <div class="pool-header">
                    <span class="pool-col"></span>
                    <span class="pool-col right">Positions</span>
                    <span class="pool-col right">Price</span>
                    <span class="pool-col right">Fee</span>
                    <span class="pool-col right">{baseSymbol}</span>
                    <span class="pool-col right">{quoteSymbol}</span>
                    <span class="pool-col right">Volume 24h</span>
                    <span class="pool-col right">APR</span>
                  </div>
                  {#each poolsOverview as pool, i}
                    {@const totalUsd = pool.base_usd_e6 + pool.quote_usd_e6}
                    {@const quoteRank = poolsOverview.filter(p => p.quote_usd_e6 > pool.quote_usd_e6).length}
                    {@const isActive = totalUsd >= 1_000_000_000n && quoteRank < 3}
                    <div class="pool-row">
                      <span class="pool-col"><span class="pool-indicator" class:active={isActive}></span></span>
                      <span class="pool-col right mono">{pool.positions.toString()}</span>
                      <span class="pool-col right mono">{formatSigFig(tickToPrice(pool.tick, baseDecimals, quoteDecimals), 5, { subscriptZeros: true })}</span>
                      <span class="pool-col right mono">{(pool.fee_pips / 10000).toFixed(2)}%</span>
                      <span class="pool-col right mono">${formatToken({ value: pool.base_usd_e6, unitName: 6, short: true })}</span>
                      <span class="pool-col right mono">${formatToken({ value: pool.quote_usd_e6, unitName: 6, short: true })}</span>
                      <span class="pool-col right mono">${formatToken({ value: pool.volume_24h_usd_e6, unitName: 6, short: true })}</span>
                      <span class="pool-col right mono">{(Number(pool.apr_bps) / 100).toFixed(2)}%</span>
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="tab-placeholder">
                <p class="placeholder-text">No active pools</p>
              </div>
            {/if}

            <!-- Liquidity Locks (Phase 3) -->
            <div class="info-section">
              <h3 class="section-heading">Liquidity Locks</h3>
              <div class="tab-placeholder">
                <p class="placeholder-text">Lock schedule will be available after replica reset.</p>
              </div>
            </div>
          </div>

        {:else if currentTab === "balance-sheet"}
          <!-- ═══ BALANCE SHEET TAB ═══ -->
          <div class="info-sections">
            {#if bsLoading && !balanceSheet}
              <div class="tab-placeholder">
                <p class="placeholder-text">Loading balance sheet...</p>
              </div>
            {:else if bsError}
              <div class="tab-placeholder">
                <p class="placeholder-text error">{bsError}</p>
                <button class="retry-btn" onclick={() => { balanceSheet = null; fetchBalanceSheet(); }}>Retry</button>
              </div>
            {:else if balanceSheet}
              <div class="info-section" class:has-drift={!balanceSheet.is_balanced}>
                <div class="tokens-grid">
                  <!-- Column Headers (same style as Overview tokens grid) -->
                  <div class="tokens-row tokens-header-row">
                    <span class="tokens-label">Balance Sheet</span>
                    <span class="tokens-header-token">
                      <Logo src={baseToken?.logo ?? undefined} alt={baseSymbol} size="xxs" circle={true} />
                      <span>{baseSymbol}</span>
                    </span>
                    <span class="tokens-header-token">
                      <Logo src={quoteToken?.logo ?? undefined} alt={quoteSymbol} size="xxs" circle={true} />
                      <span>{quoteSymbol}</span>
                    </span>
                  </div>

                  <!-- Assets (single line item, no expand) -->
                  <div class="tokens-row bs-section-row">
                    <span class="tokens-label bs-section-title">Assets</span>
                    <span class="tokens-val mono">{fmtBase(balanceSheet.assets.base_balance)}</span>
                    <span class="tokens-val mono">{fmtQuote(balanceSheet.assets.quote_balance)}</span>
                  </div>

                  <!-- Liabilities -->
                  <button class="tokens-row bs-section-row bs-clickable" onclick={() => liabilitiesExpanded = !liabilitiesExpanded}>
                    <span class="tokens-label bs-section-title">Liabilities <span class="bs-expand-icon">{liabilitiesExpanded ? '\u2212' : '+'}</span></span>
                    <span class="tokens-val mono">{fmtBase(balanceSheet.liabilities.total_base)}</span>
                    <span class="tokens-val mono">{fmtQuote(balanceSheet.liabilities.total_quote)}</span>
                  </button>
                  {#if liabilitiesExpanded}
                    <div class="bs-breakdown">
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Orders (Input)</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.liabilities.orders_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.liabilities.orders_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Orders (Output)</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.liabilities.orders_output_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.liabilities.orders_output_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Triggers</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.liabilities.triggers_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.liabilities.triggers_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Pending Outflows</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.liabilities.pending_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.liabilities.pending_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Available</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.liabilities.available_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.liabilities.available_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Pool Reserves</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.liabilities.pool_reserves_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.liabilities.pool_reserves_quote)}</span>
                      </div>
                    </div>
                  {/if}

                  <!-- Equity -->
                  <button class="tokens-row bs-section-row bs-clickable" onclick={() => equityExpanded = !equityExpanded}>
                    <span class="tokens-label bs-section-title">Equity <span class="bs-expand-icon">{equityExpanded ? '\u2212' : '+'}</span></span>
                    <span class="tokens-val mono">{fmtBase(balanceSheet.equity.total_base)}</span>
                    <span class="tokens-val mono">{fmtQuote(balanceSheet.equity.total_quote)}</span>
                  </button>
                  {#if equityExpanded}
                    <div class="bs-breakdown">
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Book Fees</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.equity.book_fees_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.equity.book_fees_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Pool Fees</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.equity.pool_fees_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.equity.pool_fees_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Operation Fees</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.equity.op_fees_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.equity.op_fees_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Available</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.equity.available_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.equity.available_quote)}</span>
                      </div>
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">Withdrawn</span>
                        <span class="tokens-val mono muted">{fmtBase(balanceSheet.equity.withdrawn_base)}</span>
                        <span class="tokens-val mono muted">{fmtQuote(balanceSheet.equity.withdrawn_quote)}</span>
                      </div>
                    </div>
                  {/if}

                  <!-- Drift -->
                  <div class="tokens-row bs-section-row">
                    <span class="tokens-label bs-section-title">Drift</span>
                    <span class="tokens-val mono" class:drift-error={balanceSheet.drift_base != null && balanceSheet.drift_base !== 0n}>{fmtDrift(balanceSheet.drift_base)}</span>
                    <span class="tokens-val mono" class:drift-error={balanceSheet.drift_quote != null && balanceSheet.drift_quote !== 0n}>{fmtDrift(balanceSheet.drift_quote)}</span>
                  </div>

                  <!-- INV-2: User Funds -->
                  <div class="tokens-row bs-section-row">
                    <span class="tokens-label bs-section-title">User Funds</span>
                    {#if balanceSheet.users_debug.inv2_balanced}
                      <span class="tokens-val mono inv-pass" style="grid-column: 2 / -1; text-align: right;">Conserved</span>
                    {:else}
                      <span class="tokens-val mono inv-fail" style="grid-column: 2 / -1; text-align: right;">{balanceSheet.users_debug.users_with_drift.toString()} users drifted</span>
                    {/if}
                  </div>
                  {#if !balanceSheet.users_debug.inv2_balanced}
                    <div class="bs-breakdown">
                      <div class="tokens-row bs-sub-row">
                        <span class="tokens-label">INV-2 Drift</span>
                        <span class="tokens-val mono muted">{fmtDrift(balanceSheet.users_debug.total_inv2_drift_base)}</span>
                        <span class="tokens-val mono muted">{fmtDrift(balanceSheet.users_debug.total_inv2_drift_quote)}</span>
                      </div>
                    </div>
                  {/if}

                  <!-- INV-3: Pool Health -->
                  {#if balanceSheet.pool_invariants.all_pools_healthy}
                    <div class="tokens-row bs-section-row">
                      <span class="tokens-label bs-section-title">Pool Health</span>
                      <span class="tokens-val mono inv-pass" style="grid-column: 2 / -1; text-align: right;">All Healthy</span>
                    </div>
                  {:else}
                    <button class="tokens-row bs-section-row bs-clickable" onclick={() => inv3Expanded = !inv3Expanded}>
                      <span class="tokens-label bs-section-title">Pool Health <span class="bs-expand-icon">{inv3Expanded ? '\u2212' : '+'}</span></span>
                      <span class="tokens-val mono inv-fail" style="grid-column: 2 / -1; text-align: right;">{balanceSheet.pool_invariants.unhealthy_pools.length} unhealthy</span>
                    </button>
                    {#if inv3Expanded}
                      <div class="bs-breakdown">
                        {#each balanceSheet.pool_invariants.pools as pool}
                          {#if !pool.inv3a_balanced || !pool.inv3b_balanced || !pool.inv3c_balanced}
                            <div class="tokens-row bs-sub-row">
                              <span class="tokens-label">{pool.fee_pips} pips</span>
                              <span class="tokens-val mono muted inv-fail" style="grid-column: 2 / -1; text-align: right;">
                                {[!pool.inv3a_balanced ? '3a' : '', !pool.inv3b_balanced ? '3b' : '', !pool.inv3c_balanced ? '3c' : ''].filter(Boolean).join(', ')} failed
                              </span>
                            </div>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                  {/if}
                </div>
              </div>
            {:else}
              <div class="tab-placeholder">
                <p class="placeholder-text">No data available</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/snippet}
  </Tabs>
</div>

<style>
  .market-info-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .tab-content {
    padding: 1rem;
    overflow-y: auto;
    height: 100%;
  }

  /* ── Overview Tab ── */
  .info-sections {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .info-section {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  .section-heading {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--foreground);
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--table-header-bg);
    margin: 0;
  }

  .info-grid {
    display: flex;
    flex-direction: column;
    min-width: 280px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    transition: background 0.15s;
  }

  .info-row:hover {
    background: var(--hover-overlay);
  }

  .info-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .info-label {
    color: var(--muted-foreground);
  }

  .info-value {
    color: var(--foreground);
    text-align: right;
  }

  .info-value.mono, .mono {
    font-family: var(--font-mono);
  }

  /* ── Tokens Grid (two-column table) ── */
  .tokens-grid {
    display: flex;
    flex-direction: column;
    min-width: 360px;
  }

  .tokens-row {
    display: grid;
    grid-template-columns: minmax(6rem, 1fr) minmax(7rem, 1fr) minmax(7rem, 1fr);
    gap: 0.75rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    align-items: center;
    transition: background 0.15s;
  }

  .tokens-row:not(.tokens-header-row):hover {
    background: var(--hover-overlay) !important;
  }

  .tokens-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .tokens-row:nth-child(even):not(.tokens-header-row):not(.bs-section-row) {
    background: oklch(1 0 0 / 0.03);
  }

  :global(.dark) .tokens-row:nth-child(even):not(.tokens-header-row):not(.bs-section-row) {
    background: oklch(1 0 0 / 0.02);
  }

  .tokens-header-row {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--table-header-bg);
  }

  .tokens-header-row .tokens-label {
    color: var(--foreground);
  }

  .tokens-header-token {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    justify-self: end;
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tokens-label {
    color: var(--muted-foreground);
  }

  .tokens-val {
    text-align: right;
    justify-self: end;
    color: var(--foreground);
  }

  /* ── Active Pools ── */
  .pool-table {
    display: flex;
    flex-direction: column;
    min-width: 600px;
  }

  .pool-header {
    display: grid;
    grid-template-columns: 1.5rem repeat(7, minmax(4.5rem, 1fr));
    padding: 0.375rem 0.75rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
    border-bottom: 1px solid var(--border);
    background: var(--table-header-bg);
  }

  .pool-row {
    display: grid;
    grid-template-columns: 1.5rem repeat(7, minmax(4.5rem, 1fr));
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    transition: background 0.15s;
  }

  .pool-row:hover {
    background: var(--hover-overlay);
  }

  .pool-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .pool-col {
    color: var(--foreground);
  }

  .pool-col.right {
    text-align: right;
  }

  .pool-indicator {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-bearish);
  }

  .pool-indicator.active {
    background: var(--color-bullish);
  }

  /* ── Tab Placeholder ── */
  .tab-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    gap: 0.75rem;
  }

  .placeholder-text {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  .placeholder-text.error {
    color: var(--color-bearish);
  }

  .retry-btn {
    padding: 0.5rem 1rem;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.8125rem;
  }

  /* ── Balance Sheet (Audit) Tab ── */
  .bs-section-row {
    background: oklch(1 0 0 / 0.03);
    border-bottom: 1px solid var(--border);
  }

  :global(.dark) .bs-section-row {
    background: oklch(1 0 0 / 0.02);
  }

  .bs-section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--foreground);
  }

  .bs-expand-icon {
    font-size: 0.875rem;
    font-weight: 400;
    color: var(--muted-foreground);
    margin-left: 0.25rem;
  }

  .bs-clickable {
    width: 100%;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .bs-clickable:hover {
    background: var(--hover-overlay);
  }

  .bs-sub-row {
    padding: 0.25rem 0.75rem;
  }

  .bs-sub-row .tokens-label {
    padding-left: 0.75rem;
  }

  .muted {
    color: var(--muted-foreground);
  }

  .bs-breakdown {
    animation: slideDown 0.15s ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-0.25rem); }
    to { opacity: 1; transform: translateY(0); }
  }

  .info-section.has-drift {
    border-color: var(--color-bearish);
  }

  .drift-error {
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
</style>
