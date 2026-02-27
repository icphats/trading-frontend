<script lang="ts">
  import { onMount } from 'svelte';
  import { treasuryState } from '$lib/domain/treasury';
  import Logo from '$lib/components/ui/Logo.svelte';

  // ============================================
  // Types
  // ============================================

  type StatementTab = 'income' | 'balance' | 'cashflow';

  // ============================================
  // Lifecycle
  // ============================================

  onMount(() => {
    treasuryState.fetchStatement();
  });

  // ============================================
  // UI State
  // ============================================

  let activeTab = $state<StatementTab>('income');
  let revenueExpanded = $state(true);
  let expensesExpanded = $state(true);

  // ============================================
  // Derived State
  // ============================================

  const statement = $derived(treasuryState.statement);
  const isLoading = $derived(treasuryState.isStatementLoading);

  // USD Totals (e6 precision)
  const totalRevenueUsd = $derived(statement?.fees_usd_e6 ?? 0n);
  const totalExpensesUsd = $derived(statement?.cycles_expense_usd_e6 ?? 0n);
  const grossMarginUsd = $derived(totalRevenueUsd - totalExpensesUsd);

  // Gains/Losses
  const realizedGainLoss = $derived(statement?.realized_gain_loss_e6 ?? 0n);
  const unrealizedGainLoss = $derived(statement?.unrealized_gain_loss_e6 ?? 0n);
  const totalOtherIncome = $derived(realizedGainLoss + unrealizedGainLoss);

  // Net Income
  const netIncome = $derived(grossMarginUsd + totalOtherIncome);

  // Capital Returns (Buybacks)
  const buybackSpendUsd = $derived(statement?.buyback_usd_e6 ?? 0n);
  const partyBurned = $derived(statement?.party_burned ?? 0n);
  const effectiveBurnPrice = $derived.by(() => {
    if (partyBurned === 0n || buybackSpendUsd === 0n) return 0;
    // buybackSpendUsd is e6, partyBurned is e8
    // price = (usd_e6 / 1e6) / (party_e8 / 1e8) = usd_e6 * 1e8 / (party_e8 * 1e6) = usd_e6 * 100 / party_e8
    return Number(buybackSpendUsd) * 100 / Number(partyBurned);
  });

  // Balance Sheet
  const icpBalance = $derived(statement?.icp_balance ?? 0n);
  const icpFairValueUsd = $derived(statement?.icp_fair_value_usd_e6 ?? 0n);
  const cyclesBalance = $derived(statement?.cycles_balance ?? 0n);
  const cyclesCostBasisUsd = $derived(statement?.cycles_cost_basis_usd_e6 ?? 0n);
  const totalAssetsUsd = $derived(icpFairValueUsd + cyclesCostBasisUsd);

  // ============================================
  // Formatters
  // ============================================

  function formatUsd(value: bigint): string {
    const usd = Number(value) / 1_000_000;
    return usd.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatUsdSigned(value: bigint): string {
    const usd = Number(value) / 1_000_000;
    const formatted = Math.abs(usd).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (usd < 0) return `(${formatted})`;
    return formatted;
  }

  function formatIcp(value: bigint): string {
    const icp = Number(value) / 100_000_000;
    return icp.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatCycles(value: bigint): string {
    const cycles = Number(value);
    if (cycles >= 1_000_000_000_000) {
      return (cycles / 1_000_000_000_000).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + 'T';
    }
    if (cycles >= 1_000_000_000) {
      return (cycles / 1_000_000_000).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + 'B';
    }
    return cycles.toLocaleString('en-US');
  }

  function formatParty(value: bigint): string {
    const party = Number(value) / 100_000_000;
    if (party >= 1_000_000) {
      return (party / 1_000_000).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + 'M';
    }
    if (party >= 1_000) {
      return (party / 1_000).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + 'K';
    }
    return party.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatPrice(value: number): string {
    if (value === 0) return '—';
    if (value < 0.01) {
      return '$' + value.toFixed(6);
    }
    return '$' + value.toFixed(4);
  }

  function formatDate(ms: bigint): string {
    const date = new Date(Number(ms));
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<div class="financial-statement">
  {#if isLoading && !statement}
    <div class="loading-state">Loading...</div>
  {:else if !statement}
    <div class="empty-state">No data available</div>
  {:else}
    <!-- Statement Header with Tabs -->
    <header class="statement-header">
      <div class="header-content">
        <div class="header-left">
          <h2>Treasury Statement</h2>
          <p class="period">As of {formatDate(statement.timestamp)}</p>
        </div>
        <nav class="tabs">
          <button
            class="tab"
            class:active={activeTab === 'income'}
            onclick={() => (activeTab = 'income')}
          >
            Income
          </button>
          <button
            class="tab"
            class:active={activeTab === 'balance'}
            onclick={() => (activeTab = 'balance')}
          >
            Balance
          </button>
          <button
            class="tab"
            class:active={activeTab === 'cashflow'}
            onclick={() => (activeTab = 'cashflow')}
          >
            Cash Flow
          </button>
        </nav>
      </div>
    </header>

    <!-- INCOME STATEMENT TAB -->
    {#if activeTab === 'income'}
      <table class="statement-table">
        <tbody>
          <!-- REVENUE SECTION -->
          <tr class="section-header" onclick={() => (revenueExpanded = !revenueExpanded)}>
            <td class="line-item">
              <span class="toggle-icon" class:expanded={revenueExpanded}>+</span>
              Revenue
            </td>
            <td class="amount"></td>
          </tr>

          {#if revenueExpanded}
            <tr class="detail-row">
              <td class="line-item indent">Trading Fees (ICP)</td>
              <td class="amount">{formatIcp(statement?.fees_icp ?? 0n)}</td>
            </tr>
          {/if}

          <tr class="subtotal-row">
            <td class="line-item indent-2">Total Fee Revenue</td>
            <td class="amount underline">{formatUsd(totalRevenueUsd)}</td>
          </tr>

          <!-- Spacer -->
          <tr class="spacer"><td colspan="2"></td></tr>

          <!-- OPERATING EXPENSES SECTION -->
          <tr class="section-header" onclick={() => (expensesExpanded = !expensesExpanded)}>
            <td class="line-item">
              <span class="toggle-icon" class:expanded={expensesExpanded}>+</span>
              Operating Expenses
            </td>
            <td class="amount"></td>
          </tr>

          {#if expensesExpanded}
            <tr class="detail-row">
              <td class="line-item indent">Cycles Infrastructure</td>
              <td class="amount expense">({formatUsd(totalExpensesUsd)})</td>
            </tr>
          {/if}

          <tr class="subtotal-row">
            <td class="line-item indent-2">Total Operating Expenses</td>
            <td class="amount underline expense">({formatUsd(totalExpensesUsd)})</td>
          </tr>

          <!-- Spacer -->
          <tr class="spacer"><td colspan="2"></td></tr>

          <!-- GROSS MARGIN -->
          <tr class="subtotal-row">
            <td class="line-item bold">Gross Margin</td>
            <td class="amount underline">{formatUsdSigned(grossMarginUsd)}</td>
          </tr>

          <!-- Spacer -->
          <tr class="spacer"><td colspan="2"></td></tr>

          <!-- OTHER INCOME / EXPENSE -->
          <tr class="section-label">
            <td class="line-item">Other Income / (Expense)</td>
            <td class="amount"></td>
          </tr>

          <tr class="detail-row">
            <td class="line-item indent">Realized Gain/(Loss) on ICP</td>
            <td class="amount" class:gain={realizedGainLoss > 0n} class:loss={realizedGainLoss < 0n}>
              {formatUsdSigned(realizedGainLoss)}
            </td>
          </tr>

          <tr class="detail-row">
            <td class="line-item indent">Unrealized Gain/(Loss) on ICP</td>
            <td class="amount" class:gain={unrealizedGainLoss > 0n} class:loss={unrealizedGainLoss < 0n}>
              {formatUsdSigned(unrealizedGainLoss)}
            </td>
          </tr>

          <tr class="subtotal-row">
            <td class="line-item indent-2">Total Other Income</td>
            <td class="amount underline" class:gain={totalOtherIncome > 0n} class:loss={totalOtherIncome < 0n}>
              {formatUsdSigned(totalOtherIncome)}
            </td>
          </tr>

          <!-- Spacer -->
          <tr class="spacer"><td colspan="2"></td></tr>

          <!-- NET INCOME -->
          <tr class="total-row">
            <td class="line-item bold">Net Income</td>
            <td class="amount double-underline" class:gain={netIncome > 0n} class:loss={netIncome < 0n}>
              {formatUsdSigned(netIncome)}
            </td>
          </tr>
        </tbody>
      </table>
    {/if}

    <!-- BALANCE SHEET TAB -->
    {#if activeTab === 'balance'}
      <table class="statement-table">
        <tbody>
          <!-- ASSETS SECTION -->
          <tr class="section-label">
            <td class="line-item">Assets</td>
            <td class="amount"></td>
          </tr>

          <tr class="detail-row">
            <td class="line-item indent">ICP</td>
            <td class="amount">
              <span class="token-label">
                {formatIcp(icpBalance)}
                <Logo src="/tokens/icp.svg" alt="ICP" size="xxs" circle />
              </span>
            </td>
          </tr>
          <tr class="detail-row sub-detail">
            <td class="line-item indent-2 muted">Fair Value</td>
            <td class="amount muted">{formatUsd(icpFairValueUsd)}</td>
          </tr>

          <!-- Spacer -->
          <tr class="spacer"><td colspan="2"></td></tr>

          <tr class="detail-row">
            <td class="line-item indent">Cycles</td>
            <td class="amount">{formatCycles(cyclesBalance)}</td>
          </tr>
          <tr class="detail-row sub-detail">
            <td class="line-item indent-2 muted">Cost Basis</td>
            <td class="amount muted">{formatUsd(cyclesCostBasisUsd)}</td>
          </tr>

          <!-- Spacer -->
          <tr class="spacer large"><td colspan="2"></td></tr>

          <!-- TOTAL ASSETS -->
          <tr class="total-row">
            <td class="line-item bold">Total Assets</td>
            <td class="amount double-underline">{formatUsd(totalAssetsUsd)}</td>
          </tr>
        </tbody>
      </table>
    {/if}

    <!-- CASH FLOW TAB -->
    {#if activeTab === 'cashflow'}
      <table class="statement-table">
        <tbody>
          <!-- FINANCING ACTIVITIES -->
          <tr class="section-label">
            <td class="line-item">Financing Activities</td>
            <td class="amount"></td>
          </tr>

          <tr class="detail-row">
            <td class="line-item indent">PARTY Buybacks</td>
            <td class="amount expense">({formatUsd(buybackSpendUsd)})</td>
          </tr>

          <tr class="subtotal-row">
            <td class="line-item indent-2">Cash Used in Financing</td>
            <td class="amount underline expense">({formatUsd(buybackSpendUsd)})</td>
          </tr>

          <!-- Spacer -->
          <tr class="spacer large"><td colspan="2"></td></tr>

          <!-- BUYBACK METRICS -->
          <tr class="section-label">
            <td class="line-item">Buyback Metrics</td>
            <td class="amount"></td>
          </tr>

          <tr class="detail-row">
            <td class="line-item indent">PARTY Burned</td>
            <td class="amount">
              <span class="token-label">
                {formatParty(partyBurned)}
                <Logo src="/tokens/party.svg" alt="PARTY" size="xxs" circle />
              </span>
            </td>
          </tr>

          <tr class="detail-row">
            <td class="line-item indent">Effective Burn Price</td>
            <td class="amount">{formatPrice(effectiveBurnPrice)}</td>
          </tr>
        </tbody>
      </table>
    {/if}
  {/if}
</div>

<style>
  .financial-statement {
    font-family: 'Basel', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--foreground);
    margin-top: 24px;
    background: var(--muted);
    border-radius: 20px;
    padding: 40px;
  }

  /* Header */
  .statement-header {
    width: 100%;
    margin-bottom: 32px;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left h2 {
    font-size: 1.25rem;
    font-weight: 500;
    margin: 0 0 4px 0;
  }

  .header-left .period {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    margin: 0;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 2px;
  }

  .tab {
    padding: 8px 16px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s ease;
    position: relative;
  }

  .tab::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background: var(--foreground);
    border-radius: 1px;
    transition: width 0.2s ease;
  }

  .tab:hover {
    color: var(--foreground);
  }

  .tab.active {
    color: var(--foreground);
  }

  .tab.active::after {
    width: calc(100% - 16px);
  }

  /* Table */
  .statement-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.875rem;
  }

  .statement-table tr {
    transition: background 0.15s ease;
    border-radius: 8px;
  }

  .statement-table tr:hover:not(.spacer):not(.section-header):not(.section-label) {
    background: var(--background);
  }

  .statement-table tr:hover:not(.spacer):not(.section-header):not(.section-label) td:first-child {
    border-radius: 8px 0 0 8px;
  }

  .statement-table tr:hover:not(.spacer):not(.section-header):not(.section-label) td:last-child {
    border-radius: 0 8px 8px 0;
  }

  .statement-table td {
    padding: 12px 20px;
    vertical-align: middle;
  }

  .line-item {
    text-align: left;
  }

  .amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Section Headers (collapsible) */
  .section-header {
    cursor: pointer;
  }

  .section-header:hover .line-item {
    color: var(--muted-foreground);
  }

  .section-header .line-item {
    font-weight: 600;
    transition: color 0.15s ease;
  }

  .section-header td {
    padding: 20px 20px 8px 20px;
  }

  /* Section Labels (non-collapsible) */
  .section-label .line-item {
    font-weight: 600;
  }

  .section-label td {
    padding: 20px 20px 8px 20px;
  }

  .toggle-icon {
    display: inline-block;
    width: 16px;
    margin-right: 8px;
    color: var(--muted-foreground);
    font-weight: 400;
    transition: transform 0.2s ease;
  }

  .toggle-icon.expanded {
    transform: rotate(45deg);
  }

  /* Indentation */
  .indent {
    padding-left: 32px !important;
  }

  .indent-2 {
    padding-left: 32px !important;
  }

  /* Detail Rows */
  .detail-row {
    color: var(--muted-foreground);
  }

  .detail-row:hover {
    color: var(--foreground);
  }

  .muted {
    font-style: normal;
    opacity: 0.6;
  }

  .token-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* Expense styling */
  .expense {
    color: var(--muted-foreground);
  }

  /* Gain/Loss colors */
  .gain {
    color: var(--success, #22c55e);
  }

  .loss {
    color: var(--destructive, #ef4444);
  }

  /* Subtotals */
  .subtotal-row .line-item {
    font-weight: 500;
  }

  .subtotal-row td {
    padding: 16px 20px 14px 20px;
  }

  .underline {
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
  }

  /* Totals */
  .total-row .line-item {
    padding-top: 16px;
  }

  .bold {
    font-weight: 600;
  }

  .double-underline {
    border-bottom: 3px double var(--foreground);
    padding-bottom: 10px;
  }

  /* Spacer */
  .spacer td {
    height: 4px;
    padding: 0;
  }

  .spacer.large td {
    height: 16px;
  }

  /* Loading & Empty States */
  .loading-state,
  .empty-state {
    text-align: center;
    padding: 48px;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .financial-statement {
      padding: 24px;
      border-radius: 16px;
    }

    .statement-header {
      margin-bottom: 24px;
    }

    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .header-left h2 {
      font-size: 1.125rem;
    }

    .tabs {
      width: 100%;
      justify-content: flex-start;
    }

    .tab {
      padding: 8px 12px;
      font-size: 0.75rem;
    }

    .statement-table {
      font-size: 0.8125rem;
    }

    .statement-table td {
      padding: 10px 16px;
    }

    .section-header td,
    .section-label td {
      padding: 16px 16px 6px 16px;
    }

    .subtotal-row td {
      padding: 12px 16px 10px 16px;
    }

    .total-row td {
      padding: 20px 16px 10px 16px;
    }

    .indent,
    .indent-2 {
      padding-left: 24px !important;
    }
  }
</style>
