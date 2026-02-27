<script lang="ts">
  import { browser } from "$app/environment";
  import MarketSelection from "$lib/components/trade/shared/MarketSelection.svelte";
  import Chart from "$lib/components/trade/shared/Chart.svelte";

  // Spot-specific imports
  import SpotChartHead from "$lib/components/trade/spot/SpotChartHead.svelte";
  import SpotOrderBook from "$lib/components/trade/spot/SpotOrderBook.svelte";
  import SpotOrderForm from "$lib/components/trade/spot/SpotOrderForm.svelte";
  import SpotUserPanel from "$lib/components/trade/spot/SpotUserPanel.svelte";
  import TradingBalance from "$lib/components/trade/spot/TradingBalance.svelte";
  import MarketInfoPanel from "$lib/components/trade/spot/MarketInfoPanel.svelte";

  // Mobile drawer
  import ResponsiveDrawer from "$lib/components/portal/drawers/shared/ResponsiveDrawer.svelte";

  // UI components
  import Tabs from "$lib/components/ui/Tabs.svelte";

  // Proactive allowance management
  import { checkAndApprove } from "$lib/utils/allowance.utils";
  import { user } from "$lib/domain/user/auth.svelte";
  import { userPortfolio } from "$lib/domain/user";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import type { SpotMarket as SpotMarketImpl } from "$lib/domain/markets/state/spot-market.svelte";

  let { market }: { market: SpotMarketImpl } = $props();

  // Derive display symbol for page title (e.g., "BTC/USDT" instead of "ckBTC/ckUSDT")
  let displayPair = $derived.by(() => {
    const base = market.tokens?.[0] ? entityStore.getToken(market.tokens[0].toString()) : null;
    const quote = market.tokens?.[1] ? entityStore.getToken(market.tokens[1].toString()) : null;
    const baseSymbol = base?.displaySymbol ?? market.token_symbol.split('/')[0] ?? '';
    const quoteSymbol = quote?.displaySymbol ?? market.token_symbol.split('/')[1] ?? '';
    return `${baseSymbol}/${quoteSymbol}`;
  });

  // Breakpoints (768px mobile, 1280px tablet per 08-Responsive.md)
  const MOBILE_BREAKPOINT = 768;
  const TABLET_BREAKPOINT = 1280;
  let innerWidth = $state(browser ? window.innerWidth : 1024);
  let isMobile = $derived(innerWidth < MOBILE_BREAKPOINT);
  let isTablet = $derived(innerWidth >= MOBILE_BREAKPOINT && innerWidth < TABLET_BREAKPOINT);

  // Track window resize
  $effect(() => {
    if (!browser) return;
    const handleResize = () => {
      innerWidth = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Info panel toggle (replaces chart area)
  let infoOpen = $state(false);

  // Pool tab ↔ Order book shared state
  let poolTabActive = $state(false);
  let poolPendingRange = $state<{ tickLower: number; tickUpper: number; feePips: number } | null>(null);

  function handlePoolTabChange(active: boolean) {
    poolTabActive = active;
    if (!active) poolPendingRange = null;
  }

  function handlePoolRangeChange(tickLower: number, tickUpper: number, feePips: number) {
    poolPendingRange = { tickLower, tickUpper, feePips };
  }

  // Existing positions for depth chart overlay
  let existingPositions = $derived(
    market.userPositions.map(p => ({
      positionId: p.position_id,
      tickLower: p.tick_lower,
      tickUpper: p.tick_upper,
      feePips: p.fee_pips,
    }))
  );

  // Trade drawer state (mobile only)
  let tradeDrawerOpen = $state(false);

  // Mobile view toggle: Chart vs Order Book (Depth)
  type MobileView = "chart" | "depth";
  let mobileView = $state<MobileView>("chart");

  // Tabs config for mobile Chart/Order Book toggle
  const mobileViewTabs = [
    { id: "chart", label: "Chart" },
    { id: "depth", label: "Order Book" },
  ];

  // Format price for page title
  let formattedPrice = $derived(market.formattedPrice);

  // Get balances reactively - triggers re-check when balance changes
  let token0Balance = $derived(
    market.tokens?.[0] ? userPortfolio.getToken(market.tokens[0].toString())?.balance ?? 0n : 0n
  );
  let token1Balance = $derived(
    market.tokens?.[1] ? userPortfolio.getToken(market.tokens[1].toString())?.balance ?? 0n : 0n
  );

  // Proactive Allowance: Token0 (Base Token)
  // Re-runs when balance changes from 0 → non-zero
  $effect(() => {
    if (!user.principal || !market.tokens?.[0]) return;
    if (token0Balance > 0n) {
      checkAndApprove(market.tokens[0].toString(), market.canister_id);
    }
  });

  // Proactive Allowance: Token1 (Quote Token)
  // Re-runs when balance changes from 0 → non-zero
  $effect(() => {
    if (!user.principal || !market.tokens?.[1]) return;
    if (token1Balance > 0n) {
      checkAndApprove(market.tokens[1].toString(), market.canister_id);
    }
  });
</script>

<svelte:head>
  <title>{displayPair} | ${formattedPrice}</title>
</svelte:head>

<main class="min-h-screen bg-border py-0.5">
  <div class="trading-grid" class:mobile={isMobile} class:tablet={isTablet}>
    <!-- Header Row: Market Selection -->
    <div class="token-selection bg-background rounded-xs">
      <MarketSelection />
    </div>

    <!-- Chart Header -->
    <div class="chart-head bg-background rounded-xs">
      <SpotChartHead spot={market} {infoOpen} onInfoToggle={() => infoOpen = !infoOpen} />
    </div>

    <!-- Mobile: Chart/Depth Tabs -->
    {#if isMobile}
      <div class="mobile-tabs bg-background rounded-xs">
        <Tabs
          tabs={mobileViewTabs}
          activeTab={mobileView}
          onTabChange={(tabId) => mobileView = tabId as MobileView}
          compact
        />
      </div>
    {/if}

    <!-- Main View: Chart / Info Panel / Order Book (varies by breakpoint) -->
    {#if isMobile}
      <!-- Mobile: Show based on toggle -->
      {#if infoOpen}
        <div class="chart bg-background rounded-xs">
          <MarketInfoPanel spot={market} />
        </div>
      {:else if mobileView === "chart"}
        <div class="chart bg-background rounded-xs">
          <Chart {market} enableRealtime={true} />
        </div>
      {:else}
        <div class="chart bg-background rounded-xs">
          <SpotOrderBook spot={market} {poolTabActive} poolPendingRange={poolPendingRange} {existingPositions} />
        </div>
      {/if}
    {:else if isTablet}
      <!-- Tablet: Chart or Info Panel full width, OrderBook in sidebar -->
      <div class="chart bg-background rounded-xs">
        {#if infoOpen}
          <MarketInfoPanel spot={market} />
        {:else}
          <Chart {market} enableRealtime={true} />
        {/if}
      </div>
    {:else}
      <!-- Desktop: Chart/Info Panel + separate OrderBook column -->
      <div class="chart bg-background rounded-xs">
        {#if infoOpen}
          <MarketInfoPanel spot={market} />
        {:else}
          <Chart {market} enableRealtime={true} />
        {/if}
      </div>
      <div class="order-book bg-background rounded-xs">
        <SpotOrderBook spot={market} {poolTabActive} poolPendingRange={poolPendingRange} {existingPositions} />
      </div>
    {/if}

    <!-- User Panel -->
    <div class="user-panel bg-background">
      <SpotUserPanel spot={market} />
    </div>

    <!-- Right Column: Tablet = separate grid items, Desktop = single column -->
    {#if isTablet}
      <div class="tablet-orderbook bg-background rounded-xs">
        <SpotOrderBook spot={market} {poolTabActive} poolPendingRange={poolPendingRange} {existingPositions} />
      </div>
      <div class="tablet-balance bg-background rounded-xs">
        <TradingBalance spot={market} />
      </div>
      <div class="tablet-form bg-background rounded-xs">
        <SpotOrderForm spot={market} onPoolTabChange={handlePoolTabChange} onPoolRangeChange={handlePoolRangeChange} />
      </div>
    {:else if !isMobile}
      <div class="right-column bg-background rounded-xs">
        <TradingBalance spot={market} />
        <SpotOrderForm spot={market} onPoolTabChange={handlePoolTabChange} onPoolRangeChange={handlePoolRangeChange} />
      </div>
    {/if}
  </div>

  <!-- Mobile: Trade FAB -->
  {#if isMobile}
    <button
      class="trade-fab"
      onclick={() => tradeDrawerOpen = true}
      aria-label="Open trade form"
    >
      Trade
    </button>
  {/if}

</main>

<!-- Mobile: Trade Drawer -->
<ResponsiveDrawer
  open={tradeDrawerOpen}
  onClose={() => tradeDrawerOpen = false}
>
  <div class="trade-drawer-content">
    <TradingBalance spot={market} />
    <SpotOrderForm spot={market} onPoolTabChange={handlePoolTabChange} onPoolRangeChange={handlePoolRangeChange} />
  </div>
</ResponsiveDrawer>

<style>
  /* ✅ Enterprise Grid Layout - Modular and Extensible */
  .trading-grid {
    --sidebar-width: 330px; /* Single source of truth for sidebar widths */

    display: grid;
    grid-template-columns: auto 1fr var(--sidebar-width) var(--sidebar-width); /* Token selector (auto) + Main column + 2 sidebars */
    grid-template-rows: auto 1fr auto; /* 3 rows: Header, Chart, UserPanel */
    gap: 0.125rem;
    max-width: 100%;
    background-color: var(--border);
  }

  /* Market Selection (left side of header row) */
  .token-selection {
    grid-column: 1;
    grid-row: 1;
    min-width: fit-content;
    width: auto;
    display: flex;
    align-items: center;
  }

  /* Chart Header (right side of header row, fills remaining space) */
  .chart-head {
    grid-column: 2; /* Second column (main area) */
    grid-row: 1;
    min-width: 0; /* Prevent grid blowout */
  }

  .chart {
    grid-column: 1 / 3; /* Spans token-selection + main column */
    grid-row: 2;
    min-height: 523px;
    min-width: 0; /* Critical: Prevents content from pushing grid beyond constraints */
    width: 100%;
    max-width: 100%;
    overflow: hidden; /* Contain any overflow */
    display: flex;
    flex-direction: column;
  }

  .order-book {
    grid-column: 3; /* Third column (first sidebar) */
    grid-row: 1 / 3; /* Spans header and chart rows */
    min-width: var(--sidebar-width);
    max-width: var(--sidebar-width);
    overflow-y: auto;
  }

  .user-panel {
    grid-column: 1 / 4; /* Spans all columns except right sidebar */
    grid-row: 3;
    min-width: 0; /* Prevent grid blowout */
    overflow-y: auto;
  }

  /* Sidebar column components (fourth column) */
  .right-column {
    grid-column: 4; /* Fourth column (second sidebar) */
    grid-row: 1 / 4; /* Spans all rows */
    align-self: start;
    min-width: var(--sidebar-width);
    max-width: var(--sidebar-width);
    max-height: 100vh;
    overflow-y: auto;
  }

  /* Ensure the chart container fills available space but respects boundaries */
  .chart :global(> *) {
    width: 100% !important;
    max-width: 100% !important;
    height: 100%;
    overflow: hidden;
  }

  /* ========================================
     Tablet Layout (768px - 1280px)

     Grid structure:
     - 3 columns: auto (token) | 1fr (chart-head) | var(--sidebar-width) (sidebar)
     - Row 1: Header          | OrderBook
     - Row 2: Chart           | OrderBook
     - Row 3: UserPanel       | Balance
     - Row 4: UserPanel       | Form
     - Row 5: (empty)         | Form
     - OrderBook height = header + chart height (strict match)
     ======================================== */
  .trading-grid.tablet {
    grid-template-columns: auto 1fr var(--sidebar-width);
    grid-template-rows: auto 1fr auto auto auto; /* Header, Chart, Row3, Row4, Row5 */
  }

  .trading-grid.tablet .token-selection {
    grid-column: 1;
    grid-row: 1;
  }

  .trading-grid.tablet .chart-head {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }

  .trading-grid.tablet .chart {
    grid-column: 1 / 3; /* Span token + chart-head columns */
    grid-row: 2;
    min-height: 500px;
  }

  .trading-grid.tablet .user-panel {
    grid-column: 1 / 3; /* Span token + chart-head columns */
    grid-row: 3 / 5; /* Rows 3-4 */
    align-self: start;
  }

  /* Tablet OrderBook: Exact grid placement spanning rows 1-2 (header + chart) */
  .trading-grid.tablet .tablet-orderbook {
    grid-column: 3;
    grid-row: 1 / 3; /* Spans header row + chart row - bottom aligns with chart */
    min-width: var(--sidebar-width);
    max-width: var(--sidebar-width);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .trading-grid.tablet .tablet-orderbook > :global(*) {
    flex: 1;
    min-height: 0;
  }

  /* Tablet Balance: Row 3 */
  .trading-grid.tablet .tablet-balance {
    grid-column: 3;
    grid-row: 3;
    min-width: var(--sidebar-width);
    max-width: var(--sidebar-width);
  }

  /* Tablet Form: Rows 4-5 */
  .trading-grid.tablet .tablet-form {
    grid-column: 3;
    grid-row: 4 / 6; /* Rows 4-5 */
    min-width: var(--sidebar-width);
    max-width: var(--sidebar-width);
    align-self: start;
  }

  /* ========================================
     Mobile Layout (< 768px)
     Per 08-Responsive.md canonical breakpoint

     Grid structure:
     - Row 1: MarketSelection + SpotChartHead (same row, like desktop)
     - Row 2: Chart/Depth Tabs
     - Row 3: Chart or OrderBook (420px)
     - Row 4: UserPanel (auto)
     ======================================== */
  .trading-grid.mobile {
    --mobile-chart-height: 420px;

    grid-template-columns: auto 1fr; /* Token selector (auto) + ChartHead (fills) */
    grid-template-rows: auto auto auto auto; /* Header, Tabs, Chart/Depth, UserPanel */
    gap: 0; /* No gap on mobile - borders handle separation */
  }

  .trading-grid.mobile .token-selection {
    grid-column: 1;
    grid-row: 1;
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }

  .trading-grid.mobile .chart-head {
    grid-column: 2;
    grid-row: 1;
    min-width: 0; /* Prevent grid blowout */
    border-bottom: 1px solid var(--border);
  }

  .trading-grid.mobile .mobile-tabs {
    grid-column: 1 / 3; /* Span both columns */
    grid-row: 2;
    border-top: 1px solid var(--border); /* Double border with header row */
    /* Tabs component has internal border-bottom */
  }

  .trading-grid.mobile .chart {
    grid-column: 1 / 3; /* Span both columns */
    grid-row: 3;
    height: var(--mobile-chart-height);
    min-height: unset; /* Reset desktop min-height (500px) for mobile */
    border-bottom: 1px solid var(--border);
  }

  .trading-grid.mobile .user-panel {
    grid-column: 1 / 3; /* Span both columns */
    grid-row: 4;
    /* No border - last row */
  }

  /* Trade FAB - Floating Action Button (mobile only) */
  .trade-fab {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    padding: 0.875rem 2.5rem;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: var(--radius-full, 9999px);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .trade-fab:hover {
    transform: translateX(-50%) scale(1.02);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .trade-fab:active {
    transform: translateX(-50%) scale(0.98);
  }

  /* Trade Drawer Content */
  .trade-drawer-content {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    /* Content flows naturally - drawer handles scrolling */
  }

  /* ========================================
     Wide Screen (1920px+)
     Expand sidebars for larger displays
     ======================================== */
  @media (min-width: 1920px) {
    .trading-grid {
      --sidebar-width: 400px;
    }
  }
</style>
