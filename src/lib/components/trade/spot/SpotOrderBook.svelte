<script lang="ts">
  import { browser } from "$app/environment";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import OrderBook from "../shared/OrderBook.svelte";
  import OrderBookCompact from "../shared/OrderBookCompact.svelte";
  import LiquidityOrderBookChart from "../shared/LiquidityOrderBookChart.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { DropdownMenu, type DropdownOption } from "$lib/components/ui";
  import ToolbarButton from "$lib/components/ui/ToolbarButton.svelte";
  import {
    transformMarketDepthToLegacy,
    type UnifiedOrderBookResponse,
    type PoolDepthRow,
  } from "../shared/orderbook.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";

  // Receive typed Spot instance as prop
  interface Props {
    spot: SpotMarket;
    /** Force compact mobile layout */
    compact?: boolean;
    /** Whether Pool tab is active in order form */
    poolTabActive?: boolean;
    /** Pending range from pool form */
    poolPendingRange?: { tickLower: number; tickUpper: number; feePips: number } | null;
    /** User's existing positions for overlay */
    existingPositions?: Array<{ positionId: bigint; tickLower: number; tickUpper: number; feePips: number }>;
  }
  let { spot, compact = false, poolTabActive = false, poolPendingRange = null, existingPositions = [] }: Props = $props();

  // Mobile detection (768px canonical breakpoint)
  const MOBILE_BREAKPOINT = 768;
  let innerWidth = $state(browser ? window.innerWidth : 1024);
  let isMobile = $derived(compact || innerWidth < MOBILE_BREAKPOINT);

  // Track window resize
  $effect(() => {
    if (!browser) return;
    const handleResize = () => {
      innerWidth = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Get token states from registry for logos and symbols
  let token0 = $derived(spot.tokens?.[0] ? entityStore.getToken(spot.tokens[0].toString()) : null);
  let token1 = $derived(spot.tokens?.[1] ? entityStore.getToken(spot.tokens[1].toString()) : null);

  // Bucket size selector (in basis points)
  // Use $derived to always reflect the market's current bucket size
  // This ensures the dropdown stays in sync with the actual data being displayed
  let bucketSizeBps = $derived(spot.orderBookBucketSize);

  // Token display selector
  type TokenDisplay = "token0" | "token1";
  let selectedToken = $state<TokenDisplay>("token1"); // Default to token1 (ICP)

  // AMM pool depth chart toggle
  let showPoolDepth = $state(false);

  // Auto-switch to depth chart when Pool tab is active
  $effect(() => {
    if (poolTabActive) {
      showPoolDepth = true;
    }
  });

  // Pool filter for AMM depth chart
  type PoolFilter = "all" | number; // "all" or fee pips (100, 500, 3000, 10000)
  let selectedPools = $state<PoolFilter[]>(["all"]);

  // Bucket size options
  const bucketOptions: DropdownOption<number>[] = [
    { value: 1, label: "0.01%" },
    { value: 10, label: "0.1%" },
    { value: 20, label: "0.2%" },
    { value: 50, label: "0.5%" },
    { value: 100, label: "1%" },
    { value: 1000, label: "10%" },
  ];

  // Token options (derived from actual tokens)
  let tokenOptions = $derived<DropdownOption<TokenDisplay>[]>([
    {
      value: "token0",
      label: token0?.displaySymbol ?? "Token0",
      icon: token0IconSnippet,
    },
    {
      value: "token1",
      label: token1?.displaySymbol ?? "Token1",
      icon: token1IconSnippet,
    },
  ]);

  // DERIVE from spot.marketDepth (single source of truth via SpotMarket polling)
  // SpotMarket polls versions every 500ms and conditionally fetches market depth
  // This eliminates duplicate polling and follows canonical data flow
  // Using legacy adapter for gradual component migration
  let rawBook = $derived.by<UnifiedOrderBookResponse>(() => {
    const marketDepth = spot.marketDepth;
    if (!marketDepth) {
      return { long: [], short: [], midTick: undefined, referencePriceE12: 0n };
    }
    return transformMarketDepthToLegacy(marketDepth, spot.baseTokenDecimals, spot.quoteTokenDecimals);
  });

  // Helper to get the correct amount based on token display
  function getAmount(row: typeof rawBook.long[0], token: TokenDisplay): bigint {
    return token === "token0" ? row.book_token0_amount! : row.book_token1_amount!;
  }

  // Display limits: desktop shows 10 levels, mobile shows all (20)
  const DESKTOP_LEVELS = 10;

  // Computed book based on selected token display (limit orders only)
  // Desktop is sliced to 10 levels for cleaner display
  let book = $derived<UnifiedOrderBookResponse>({
    long: rawBook.long.slice(0, DESKTOP_LEVELS).map((row) => ({
      ...row,
      amount: getAmount(row, selectedToken),
    })),
    short: rawBook.short.slice(0, DESKTOP_LEVELS).map((row) => ({
      ...row,
      amount: getAmount(row, selectedToken),
    })),
    midTick: rawBook.midTick,
    referencePriceE12: rawBook.referencePriceE12,
  });

  // Mobile book: all levels (no slicing)
  let mobileBook = $derived<UnifiedOrderBookResponse>({
    long: rawBook.long.map((row) => ({
      ...row,
      amount: getAmount(row, selectedToken),
    })),
    short: rawBook.short.map((row) => ({
      ...row,
      amount: getAmount(row, selectedToken),
    })),
    midTick: rawBook.midTick,
    referencePriceE12: rawBook.referencePriceE12,
  });

  // Pool depth data for AMM visualization (separate from order book)
  let poolDepthData = $derived.by<PoolDepthRow[]>(() => {
    const marketDepth = spot.marketDepth;
    if (!marketDepth || !marketDepth.pools) return [];

    return marketDepth.pools.map((pool) => ({
      feePips: pool.fee_pips,
      currentTick: pool.current_tick,
      sqrtPriceX96: pool.sqrt_price_x96,
      liquidity: pool.liquidity,
      tickSpacing: pool.tick_spacing,
      initializedTicks: pool.initialized_ticks.map((t) => ({
        tick: t.tick,
        liquidityNet: t.liquidity_net,
        liquidityGross: t.liquidity_gross,
      })),
    }));
  });

  // Whether pools have actual liquidity (initialized ticks)
  let hasPoolData = $derived(
    poolDepthData.length > 0 && poolDepthData.some((p) => p.initializedTicks.length > 0)
  );


  // ============================================================================
  // Pool Filter (for AMM Depth view)
  // ============================================================================

  /** Format fee tier for display */
  function formatFeeTier(feePips: number): string {
    const percent = feePips / 10000;
    return percent < 0.01 ? `${(percent * 100).toFixed(2)}%` : `${percent.toFixed(2)}%`;
  }

  /** Pool filter options derived from available pools */
  let poolOptions = $derived.by<DropdownOption<PoolFilter>[]>(() => {
    const options: DropdownOption<PoolFilter>[] = [
      { value: "all", label: "All Pools" },
    ];

    // Add option for each pool fee tier
    for (const pool of poolDepthData) {
      if (!options.some(o => o.value === pool.feePips)) {
        options.push({
          value: pool.feePips,
          label: formatFeeTier(pool.feePips),
        });
      }
    }

    return options;
  });

  /** Handle pool filter toggle */
  function handlePoolToggle(value: PoolFilter) {
    if (value === "all") {
      // If selecting "All", clear other selections
      selectedPools = ["all"];
    } else {
      // If selecting a specific pool, remove "All" and toggle the pool
      let newSelection = selectedPools.filter(v => v !== "all");
      const index = newSelection.indexOf(value);
      if (index >= 0) {
        newSelection.splice(index, 1);
      } else {
        newSelection.push(value);
      }
      // If nothing selected, revert to "All"
      selectedPools = newSelection.length === 0 ? ["all"] : newSelection;
    }
  }

  /** Label for pool filter trigger */
  let poolTriggerLabel = $derived.by(() => {
    if (selectedPools.includes("all")) return "All";
    if (selectedPools.length === 1) {
      const feePips = selectedPools[0];
      return typeof feePips === "number" ? formatFeeTier(feePips) : "All";
    }
    return `${selectedPools.length} pools`;
  });

  /** Filtered pools based on selection */
  let filteredPools = $derived.by<PoolDepthRow[]>(() => {
    if (selectedPools.includes("all")) return poolDepthData;
    return poolDepthData.filter(p => selectedPools.includes(p.feePips));
  });

  // Derived values for selected token (to pass to OrderBook)
  let selectedTokenData = $derived.by(() => {
    const token = selectedToken === "token0" ? token0 : token1;
    return {
      logo: token?.logo ?? undefined,
      symbol: token?.displaySymbol ?? (selectedToken === "token0" ? "Token0" : "Token1"),
      decimals: token?.decimals ?? 8,
    };
  });

  // Handle bucket size change from user (via dropdown)
  function handleBucketSizeChange(newSize: number) {
    if (newSize !== spot.orderBookBucketSize) {
      spot.orderBookBucketSize = newSize;
      spot.fetchOrderBook(newSize);
    }
  }
</script>

{#snippet token0IconSnippet()}
  {#if token0}
    <Logo src={token0.logo ?? undefined} alt={token0.displaySymbol} size="xxs" circle={true} />
  {/if}
{/snippet}

{#snippet token1IconSnippet()}
  {#if token1}
    <Logo src={token1.logo ?? undefined} alt={token1.displaySymbol} size="xxs" circle={true} />
  {/if}
{/snippet}

{#snippet bucketTrigger({ open, selectedOption }: { open: boolean; selectedOption: DropdownOption<number> | undefined })}
  <span class="bucket-label">{selectedOption?.label ?? "0.1%"}</span>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="chevron-icon {open ? 'rotated' : ''}"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
{/snippet}

{#snippet tokenTrigger({ open }: { open: boolean })}
  {#if selectedToken === "token0" && token0}
    <Logo src={token0.logo ?? undefined} alt={token0.displaySymbol} size="xxs" circle={true} />
  {:else if selectedToken === "token1" && token1}
    <Logo src={token1.logo ?? undefined} alt={token1.displaySymbol} size="xxs" circle={true} />
  {/if}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="chevron-icon {open ? 'rotated' : ''}"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
{/snippet}

{#snippet poolTrigger({ open }: { open: boolean })}
  <span class="pool-trigger-label">{poolTriggerLabel}</span>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="chevron-icon {open ? 'rotated' : ''}"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
{/snippet}

<!-- Wrapper for proper height distribution -->
<div class="spot-orderbook-wrapper">

{#if isMobile}
  <!-- Mobile: Compact horizontal layout with selectors -->
  <div class="selectors-container mobile">
    <!-- Left side: View toggle (fixed position) -->
    <ToolbarButton onclick={() => showPoolDepth = !showPoolDepth}>
      {showPoolDepth ? "Order Book" : "Pool Depth"}
    </ToolbarButton>

    <!-- Right side: context-specific controls -->
    <div class="right-controls">
      {#if !showPoolDepth}
        <!-- Order Book controls: Bucket size + Token selector -->
        <DropdownMenu
          options={bucketOptions}
          value={bucketSizeBps}
          onValueChange={handleBucketSizeChange}
          trigger={bucketTrigger}
          ariaLabel="Bucket size"
        />
        <DropdownMenu
          options={tokenOptions}
          bind:value={selectedToken}
          onValueChange={(v) => (selectedToken = v)}
          trigger={tokenTrigger}
          align="right"
          ariaLabel="Display token"
        />
      {:else if poolOptions.length > 1}
        <!-- AMM Depth controls: Pool filter -->
        <DropdownMenu
          options={poolOptions}
          values={selectedPools}
          onToggle={handlePoolToggle}
          multiSelect={true}
          trigger={poolTrigger}
          align="right"
          ariaLabel="Filter pools"
        />
      {/if}
    </div>
  </div>

  <!-- Content area: either Pool Depth or Order Book -->
  <div class="orderbook-flex-area">
    {#if showPoolDepth}
      <LiquidityOrderBookChart
        pools={filteredPools}
        token0Decimals={token0?.decimals ?? 8}
        token1Decimals={token1?.decimals ?? 8}
        token0Logo={token0?.logo ?? undefined}
        token1Logo={token1?.logo ?? undefined}
        token0Symbol={token0?.displaySymbol ?? "Token0"}
        token1Symbol={token1?.displaySymbol ?? "Token1"}
        token0PriceUsd={token0?.priceUsd ?? null}
        token1PriceUsd={token1?.priceUsd ?? null}
        quoteSymbol={token1?.displaySymbol ?? "Quote"}
        referenceTick={rawBook.midTick}
        referencePriceE12={rawBook.referencePriceE12}
        pendingRange={poolPendingRange}
        {existingPositions}
      />
    {:else}
      <OrderBookCompact book={mobileBook} market={spot} overrideTokenLogo={selectedTokenData.logo} overrideTokenSymbol={selectedTokenData.symbol} overrideTokenDecimals={selectedTokenData.decimals} selectedTokenType={selectedToken} />
    {/if}
  </div>
{:else}
  <!-- Desktop: Full layout with selectors -->
  <div class="selectors-container">
    <!-- Left side: View toggle (fixed position) -->
    <ToolbarButton onclick={() => showPoolDepth = !showPoolDepth}>
      {showPoolDepth ? "Order Book" : "Pool Depth"}
    </ToolbarButton>

    <!-- Right side: context-specific controls -->
    <div class="right-controls">
      {#if !showPoolDepth}
        <!-- Order Book controls: Bucket size + Token selector -->
        <DropdownMenu
          options={bucketOptions}
          value={bucketSizeBps}
          onValueChange={handleBucketSizeChange}
          trigger={bucketTrigger}
          ariaLabel="Bucket size"
        />
        <DropdownMenu
          options={tokenOptions}
          bind:value={selectedToken}
          onValueChange={(v) => (selectedToken = v)}
          trigger={tokenTrigger}
          align="right"
          ariaLabel="Display token"
        />
      {:else if poolOptions.length > 1}
        <!-- AMM Depth controls: Pool filter -->
        <DropdownMenu
          options={poolOptions}
          values={selectedPools}
          onToggle={handlePoolToggle}
          multiSelect={true}
          trigger={poolTrigger}
          align="right"
          ariaLabel="Filter pools"
        />
      {/if}
    </div>
  </div>

  <!-- Content area: either Pool Depth or Order Book -->
  <div class="orderbook-flex-area">
    {#if showPoolDepth}
      <LiquidityOrderBookChart
        pools={filteredPools}
        token0Decimals={token0?.decimals ?? 8}
        token1Decimals={token1?.decimals ?? 8}
        token0Logo={token0?.logo ?? undefined}
        token1Logo={token1?.logo ?? undefined}
        token0Symbol={token0?.displaySymbol ?? "Token0"}
        token1Symbol={token1?.displaySymbol ?? "Token1"}
        token0PriceUsd={token0?.priceUsd ?? null}
        token1PriceUsd={token1?.priceUsd ?? null}
        quoteSymbol={token1?.displaySymbol ?? "Quote"}
        referenceTick={rawBook.midTick}
        referencePriceE12={rawBook.referencePriceE12}
        pendingRange={poolPendingRange}
        {existingPositions}
      />
    {:else}
      <OrderBook {book} market={spot} overrideTokenLogo={selectedTokenData.logo} overrideTokenSymbol={selectedTokenData.symbol} overrideTokenDecimals={selectedTokenData.decimals} selectedTokenType={selectedToken} />
    {/if}
  </div>
{/if}

</div>

<style>
  /* Wrapper fills parent and distributes height via flexbox */
  .spot-orderbook-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* OrderBook area takes all remaining space */
  .orderbook-flex-area {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    /* CRITICAL: height: 100% establishes explicit height reference for children using height: 100%.
       Without this, .orderbook-container's height: 100% fails because flex: 1 alone
       doesn't create a height that percentage-based children can reference. */
    height: 100%;
  }
  /* Selectors container - flexbox for left/right alignment */
  .selectors-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.625rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0; /* Never shrink - fixed header height */
  }

  /* Mobile: More compact selectors */
  .selectors-container.mobile {
    padding: 0.375rem 0.5rem;
  }

  /* Right controls group */
  .right-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }


  /* Label styling */
  .bucket-label,
  .pool-trigger-label {
    font-size: 0.75rem;
    color: var(--foreground);
    font-weight: 500;
  }

  .chevron-icon {
    transition: transform 200ms ease-out;
  }

  .chevron-icon.rotated {
    transform: rotate(180deg);
  }

  /* Mobile: Compact header to maximize order book space */
  @media (max-width: 767px) {
    .selectors-container {
      padding: 0.375rem 0.5rem;
      gap: 0.5rem;
      height: 44px; /* Fixed height on mobile - touch-friendly, OrderBook gets remaining space */
    }

    .right-controls {
      gap: 0.5rem;
    }

    .bucket-label,
    .pool-trigger-label {
      font-size: 0.6875rem;
    }
  }
</style>
