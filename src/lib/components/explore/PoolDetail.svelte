<script lang="ts">
  import { onMount } from 'svelte';
  import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
  import PoolDetailHeader from '$lib/components/explore/PoolDetailHeader.svelte';
  import PoolStats from '$lib/components/explore/PoolStats.svelte';
  import ActivityTable from '$lib/components/explore/ActivityTable.svelte';
  import { ExploreChart, EXPLORE_INTERVAL_CONFIG, toCandidChartInterval, type TimeInterval, type RawCandle, type FeeDataPoint } from '$lib/components/ui/charts';
  import type { PoolDepthRow } from '$lib/components/trade/shared/orderbook.utils';
  import LinksSection from '$lib/components/ui/LinksSection.svelte';
  import { indexerRepository, poolItemToUpsert, tokenItemToUpsert } from '$lib/repositories/indexer.repository';
  import { marketRepository } from '$lib/repositories/market.repository';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import type { PoolListItem, TokenListItem } from 'declarations/indexer/indexer.did';

  interface Props {
    canister: string;
    quote: string;
    fee: number;
  }

  let { canister, quote, fee }: Props = $props();

  // Local state for data
  let poolItems = $state<PoolListItem[]>([]);
  let tokenItems = $state<TokenListItem[]>([]);
  let isLoading = $state(true);

  // Pool depth data for liquidity chart
  let poolDepthData = $state<PoolDepthRow[]>([]);
  let isLoadingDepth = $state(false);

  // Find pool in local state
  const pool = $derived(
    poolItems.find(p =>
      p.spot_canister.toString() === canister &&
      p.fee_pips === fee
    )
  );

  // Get token ledger IDs directly from pool data (more reliable than parsing symbol)
  const baseLedger = $derived(pool?.base_ledger?.toString() ?? null);
  const quoteLedger = $derived(pool?.quote_ledger?.toString() ?? null);

  // Find tokens from tokenItems using ledger IDs
  const baseFromItems = $derived(
    baseLedger ? tokenItems.find(t => t.token_ledger.toString() === baseLedger) : null
  );
  const quoteFromItems = $derived(
    quoteLedger ? tokenItems.find(t => t.token_ledger.toString() === quoteLedger) : null
  );

  // Get tokens from entity store for logos and other metadata
  const baseToken = $derived(baseLedger ? entityStore.getToken(baseLedger) : null);
  const quoteToken = $derived(quoteLedger ? entityStore.getToken(quoteLedger) : null);

  // Get display symbols — prefer entityStore (normalized), fallback to indexer/pool
  const poolSymbolParts = $derived(pool?.symbol?.split('/') ?? []);
  const baseSymbol = $derived(
    baseToken?.displaySymbol ?? baseFromItems?.symbol ?? poolSymbolParts[0]?.trim() ?? ''
  );
  const quoteSymbol = $derived(
    quoteToken?.displaySymbol ?? quoteFromItems?.symbol ?? poolSymbolParts[1]?.trim() ?? quote.toUpperCase()
  );

  const poolLabel = $derived(`${baseSymbol}/${quoteSymbol}`);

  // Breadcrumb
  const breadcrumbItems = $derived([
    { label: 'Explore', href: '/explore/pools' },
    { label: 'Pools', href: '/explore/pools' },
    { label: poolLabel, active: true }
  ]);

  // Reverse toggle state
  let isReversed = $state(false);
  function toggleReversed() {
    isReversed = !isReversed;
  }

  // Displayed token order (based on reversed state)
  const displayBaseSymbol = $derived(isReversed ? quoteSymbol : baseSymbol);
  const displayQuoteSymbol = $derived(isReversed ? baseSymbol : quoteSymbol);
  const displayBaseLogo = $derived(isReversed ? quoteToken?.logo : baseToken?.logo);
  const displayQuoteLogo = $derived(isReversed ? baseToken?.logo : quoteToken?.logo);

  // Derive pool from entityStore (populated by fetchPoolState from spot canister)
  const poolId = $derived(`${canister}:${fee}`);
  const normalizedPool = $derived(entityStore.getPool(poolId));

  // Pool stats - derived from entityStore (real-time from get_pool())
  // Falls back to indexer data if canister data not yet loaded
  const tvl = $derived.by(() => {
    if (normalizedPool?.tvl) return Number(normalizedPool.tvl) / 1e6;
    if (pool?.tvl_usd_e6 !== undefined) return Number(pool.tvl_usd_e6) / 1e6;
    return null;
  });
  const volume24h = $derived.by(() => {
    if (normalizedPool?.volume24h) return Number(normalizedPool.volume24h) / 1e6;
    if (pool?.volume_24h_usd_e6 !== undefined) return Number(pool.volume_24h_usd_e6) / 1e6;
    return null;
  });
  const fees24h = $derived.by(() => {
    if (normalizedPool?.fees24h) return Number(normalizedPool.fees24h) / 1e6;
    if (pool?.fees_24h_usd_e6 !== undefined) return Number(pool.fees_24h_usd_e6) / 1e6;
    return null;
  });
  const apr = $derived(normalizedPool?.apr ?? (pool?.apr_bps !== undefined ? Number(pool.apr_bps ?? 0n) / 100 : null));

  // Pool balances - derived from entityStore reserves (fetched from spot canister)
  // When isReversed, display tokens are swapped but underlying reserves stay the same
  const baseBalance = $derived.by(() => {
    if (!pool) return null;

    const reserves = normalizedPool;
    // When reversed, "display base" is actually the underlying quote
    const underlyingToken = isReversed ? quoteToken : baseToken;
    const underlyingReserve = isReversed ? reserves?.quoteReserve : reserves?.baseReserve;
    const decimals = underlyingToken?.decimals ?? 8;
    const hasReserves = underlyingReserve !== null && underlyingReserve !== undefined;

    // Calculate actual token amount from raw reserves
    const rawAmount = hasReserves ? underlyingReserve : 0n;
    const amount = Number(rawAmount) / Math.pow(10, decimals);

    // Calculate USD value from token price if available, otherwise estimate from TVL
    const priceUsd = underlyingToken?.priceUsd ? Number(underlyingToken.priceUsd) / 1e12 : 0;
    const valueUsd = priceUsd > 0 ? amount * priceUsd : (tvl ?? 0) / 2;

    return {
      symbol: displayBaseSymbol,
      logo: displayBaseLogo ?? undefined,
      amount,
      valueUsd
    };
  });

  const quoteBalance = $derived.by(() => {
    if (!pool) return null;

    const reserves = normalizedPool;
    // When reversed, "display quote" is actually the underlying base
    const underlyingToken = isReversed ? baseToken : quoteToken;
    const underlyingReserve = isReversed ? reserves?.baseReserve : reserves?.quoteReserve;
    const decimals = underlyingToken?.decimals ?? 8;
    const hasReserves = underlyingReserve !== null && underlyingReserve !== undefined;

    // Calculate actual token amount from raw reserves
    const rawAmount = hasReserves ? underlyingReserve : 0n;
    const amount = Number(rawAmount) / Math.pow(10, decimals);

    // Calculate USD value from token price if available, otherwise estimate from TVL
    const priceUsd = underlyingToken?.priceUsd ? Number(underlyingToken.priceUsd) / 1e12 : 0;
    const valueUsd = priceUsd > 0 ? amount * priceUsd : (tvl ?? 0) / 2;

    return {
      symbol: displayQuoteSymbol,
      logo: displayQuoteLogo ?? undefined,
      amount,
      valueUsd
    };
  });

  // Build links for LinksSection - only when pool data is available
  const links = $derived.by(() => {
    // Don't show links until we have pool data with valid symbols
    if (!pool || !baseSymbol || !quoteSymbol) {
      return [];
    }

    const items = [
      {
        canisterId: canister,
        label: 'Pool',
        tokenLogos: [baseToken?.logo, quoteToken?.logo],
        tokenSymbols: [baseSymbol, quoteSymbol]
      }
    ];
    if (baseLedger) {
      items.push({
        canisterId: baseLedger,
        label: baseSymbol,
        tokenLogos: [baseToken?.logo],
        tokenSymbols: []
      });
    }
    if (quoteLedger) {
      items.push({
        canisterId: quoteLedger,
        label: quoteSymbol,
        tokenLogos: [quoteToken?.logo],
        tokenSymbols: []
      });
    }
    return items;
  });

  // Load data on mount
  async function loadData() {
    isLoading = true;

    // Fetch indexer data for general pool/token info
    const [poolsResult, tokensResult] = await Promise.all([
      indexerRepository.getPools(100n, undefined, true),
      indexerRepository.getTokens(100n, undefined, true)
    ]);

    if ('ok' in poolsResult) {
      poolItems = poolsResult.ok.data;
      // Populate entityStore with indexer data
      const upserts = poolsResult.ok.data.map(poolItemToUpsert);
      entityStore.upsertPools(upserts);
    }

    if ('ok' in tokensResult) {
      tokenItems = tokensResult.ok.data;
      // Populate entityStore
      const upserts = tokensResult.ok.data.map(tokenItemToUpsert);
      entityStore.upsertTokens(upserts);
    }

    // Fetch pool state from spot canister for reserves + real-time analytics
    // get_pool() now returns tvl, volume, fees, apr directly
    if (canister && fee) {
      const poolStateResult = await marketRepository.fetchPoolState(canister, fee);

      if ('ok' in poolStateResult) {
        const poolState = poolStateResult.ok;
        if (!poolState) return;
        // Update entityStore with reserves and analytics from spot canister
        entityStore.upsertPool({
          poolId: `${canister}:${fee}`,
          spotCanisterId: canister,
          // Reserves
          baseReserve: poolState.base_reserve,
          quoteReserve: poolState.quote_reserve,
          liquidity: poolState.liquidity,
          feePips: poolState.fee_pips,
          // Analytics (real-time from get_pool)
          tvl: poolState.tvl_usd_e6,
          volume24h: poolState.volume_24h_usd_e6,
          fees24h: poolState.fees_24h_usd_e6,
          apr: Number(poolState.apr_bps) / 100,
          source: 'canister',
        });
      }
    }

    isLoading = false;

    // Fetch pool depth data for liquidity chart (async, non-blocking)
    loadPoolDepthData();
  }

  // Fetch pool depth data for liquidity visualization
  async function loadPoolDepthData() {
    if (!canister) return;

    isLoadingDepth = true;
    try {
      const depthResult = await marketRepository.getSpotMarketDepth(canister, 50, 1);

      if ('ok' in depthResult) {
        // Transform to PoolDepthRow format
        // Filter to only include the pool for this fee tier if available
        poolDepthData = depthResult.ok.pools.map((pool) => ({
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
      }
    } catch (err) {
      console.error('[PoolDetail] Failed to fetch pool depth:', err);
      poolDepthData = [];
    } finally {
      isLoadingDepth = false;
    }
  }

  onMount(() => {
    loadData();
  });

  // Fetch chart data for ExploreChart (OHLCV candles - market-wide)
  async function fetchChartData(interval: TimeInterval): Promise<RawCandle[]> {
    if (!canister) return [];

    const config = EXPLORE_INTERVAL_CONFIG[interval];
    const chartInterval = toCandidChartInterval(config.backend);

    const result = await marketRepository.fetchChartData(
      canister,
      chartInterval,
      config.candles
    );
    if ('err' in result) {
      console.error('[PoolDetail] Failed to fetch chart:', result.err);
      return [];
    }
    return result.ok;
  }

  // Fees interval config: maps UI interval to backend params
  // Backend: interval_hours (1, 6, 24, 168) and limit
  // Returns as many bars as available (up to limit) if time period not fully populated
  const FEES_INTERVAL_CONFIG: Record<TimeInterval, { intervalHours: number; limit: number }> = {
    '1D': { intervalHours: 1, limit: 24 },   // 24 × 1-hour bars
    '1W': { intervalHours: 6, limit: 28 },   // 28 × 6-hour bars
    '1M': { intervalHours: 24, limit: 30 },  // 30 × daily bars
    '1Y': { intervalHours: 168, limit: 52 }, // 52 × weekly bars
  };

  // Fetch fees data for pool-specific chart (from get_pool_snapshots)
  async function fetchFeesData(interval: TimeInterval): Promise<FeeDataPoint[]> {
    if (!canister || !fee) return [];

    const config = FEES_INTERVAL_CONFIG[interval];

    const result = await marketRepository.fetchPoolSnapshots(
      canister,
      fee,
      config.intervalHours,
      config.limit
    );

    if ('err' in result) {
      console.error('[PoolDetail] Failed to fetch fees data:', result.err);
      return [];
    }

    // Token prices (E12) for converting native reserves to USD
    const price0 = baseToken?.priceUsd ? Number(baseToken.priceUsd) / 1e12 : 0;
    const price1 = quoteToken?.priceUsd ? Number(quoteToken.priceUsd) / 1e12 : 0;
    const dec0 = Math.pow(10, baseToken?.decimals ?? 8);
    const dec1 = Math.pow(10, quoteToken?.decimals ?? 8);

    // Transform snapshots to FeeDataPoint format (enriched: fees, volume, TVL)
    // Backend returns oldest-first (ascending) via build_response
    return result.ok.data
      .map((s) => ({
        timestamp: Math.floor(Number(s.timestamp) / 1000), // Convert ms to seconds for chart
        fees: Number(s.fees_usd_e6) / 1e6,
        volume: Number(s.volume_usd_e6) / 1e6,
        tvl: (Number(s.base_reserve) / dec0) * price0 + (Number(s.quote_reserve) / dec1) * price1,
      }));
  }
</script>

<div class="pool-detail-layout">
  <!-- Left Panel - Main Content -->
  <div class="pool-detail-left">
    <Breadcrumb items={breadcrumbItems} />

    <div class="pool-detail-content">
      <PoolDetailHeader
        baseSymbol={displayBaseSymbol}
        quoteSymbol={displayQuoteSymbol}
        baseLogo={displayBaseLogo ?? undefined}
        quoteLogo={displayQuoteLogo ?? undefined}
        feePips={fee}
        isLoading={isLoading || !pool}
        onToggleReversed={toggleReversed}
      />

      <!-- Chart Section (includes Liquidity view via dropdown) -->
      <div class="chart-section">
        {#if canister}
          <ExploreChart
            fetchData={fetchChartData}
            fetchFeesData={fetchFeesData}
            mode="pool"
            baseSymbol={baseSymbol}
            quoteSymbol={quoteSymbol}
            {isReversed}
            baseTokenDecimals={baseToken?.decimals ?? 8}
            {poolDepthData}
            isLoadingDepth={isLoadingDepth}
            baseDecimals={baseToken?.decimals ?? 8}
            quoteDecimals={quoteToken?.decimals ?? 8}
            baseLogo={baseToken?.logo ?? undefined}
            quoteLogo={quoteToken?.logo ?? undefined}
            basePriceUsd={baseToken?.priceUsd ?? null}
            quotePriceUsd={quoteToken?.priceUsd ?? null}
          />
        {:else}
          <div class="chart-placeholder">
            <span class="placeholder-text">Loading chart...</span>
          </div>
        {/if}
      </div>

      <!-- APR Highlight Card (on mobile) -->
      {#if apr !== null}
        <div class="apr-card apr-card-mobile">
          <div class="apr-title">
            <span class="apr-dot"></span>
            <span>APR</span>
          </div>
          <div class="apr-value">{apr.toFixed(2)}%</div>
        </div>
      {/if}

      <!-- Stats Section (on mobile, appears here) -->
      <div class="stats-section-mobile">
        <PoolStats
          {tvl}
          {volume24h}
          {fees24h}
          baseBalance={baseBalance}
          quoteBalance={quoteBalance}
          isLoading={isLoading || !pool}
        />
      </div>

      <!-- Recent Activity Section -->
      <div class="activity-section">
        <h2 class="section-title">Transactions</h2>
        {#if canister}
          <ActivityTable
            spotCanisterId={canister}
            baseSymbol={displayBaseSymbol}
            quoteSymbol={displayQuoteSymbol}
          />
        {:else}
          <div class="activity-placeholder">
            <span class="placeholder-text">Loading transactions...</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Right Panel - Stats & Info -->
  <div class="pool-detail-right">
    <!-- Links Section - only show when we have link data -->
    {#if links.length > 0}
      <LinksSection {links} />
    {/if}

    <!-- APR Highlight Card (on desktop) -->
    {#if apr !== null}
      <div class="apr-card">
        <div class="apr-title">
          <span class="apr-dot"></span>
          <span>APR</span>
        </div>
        <div class="apr-value">{apr.toFixed(2)}%</div>
      </div>
    {/if}

    <!-- Stats Section (on desktop) -->
    <div class="stats-section-desktop">
      <PoolStats
        {tvl}
        {volume24h}
        {fees24h}
        baseBalance={baseBalance}
        quoteBalance={quoteBalance}
        isLoading={isLoading || !pool}
      />
    </div>

  </div>
</div>

<style>
  /* Two-column layout matching Uniswap */
  /* Note: Container styling (max-width, padding) inherited from parent +layout.svelte */
  .pool-detail-layout {
    display: flex;
    justify-content: center;
    width: 100%;
    gap: 80px;
  }

  /* Left panel - main content */
  .pool-detail-left {
    max-width: 780px;
    width: 100%;
    flex-grow: 1;
    flex-shrink: 1;
  }

  .pool-detail-content {
    margin-top: 24px;
  }

  /* Right panel - stats & info */
  .pool-detail-right {
    width: 360px;
    flex-shrink: 0;
    padding-top: 53px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Chart Section */
  .chart-section {
    margin-top: 0;
  }

  .chart-placeholder {
    height: 320px;
    background: var(--muted);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Activity Section */
  .activity-section {
    margin-top: 40px;
  }

  .section-title {
    font-family: 'Basel', sans-serif;
    font-size: 24px;
    line-height: 36px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0 0 16px;
  }

  .activity-placeholder {
    height: 200px;
    background: var(--muted);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* APR Highlight Card */
  .apr-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;

    padding: 1.5rem;
    border-radius: 20px;
    overflow: hidden;

    /* Same background as regular stats */
    background: var(--muted);
  }

  .apr-card-mobile {
    display: none;
    margin-top: 40px;
  }

  .apr-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'Basel', sans-serif;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--color-bullish);
    line-height: 1.4;
  }

  .apr-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-bullish);
    animation: apr-pulsate 1s ease-in-out infinite alternate;
  }

  @keyframes apr-pulsate {
    0% {
      box-shadow: 0 0 0 0 oklch(from var(--color-bullish) l c h / 0.4);
    }
    100% {
      box-shadow: 0 0 0 4px oklch(from var(--color-bullish) l c h / 0.2);
    }
  }

  .apr-value {
    font-family: 'Basel', sans-serif;
    font-size: 2.5rem;
    font-weight: 500;
    color: var(--color-bullish);
    line-height: 1;
    font-variant-numeric: lining-nums tabular-nums;
  }

  /* Stats sections - show/hide based on viewport */
  .stats-section-mobile {
    display: none;
    margin-top: 40px;
  }

  .stats-section-desktop {
    display: block;
  }

  .placeholder-text {
    font-family: 'Basel', sans-serif;
    font-size: 15px;
    color: var(--muted-foreground);
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .pool-detail-layout {
      flex-direction: column;
      gap: 40px;
      padding: 16px;
    }

    .pool-detail-left {
      max-width: 100%;
    }

    .pool-detail-right {
      width: 100%;
      max-width: 780px;
      padding-top: 0;
    }

    /* Show stats in mobile position, hide desktop */
    .stats-section-mobile {
      display: block;
    }

    .stats-section-desktop {
      display: none;
    }

    /* Show mobile APR card, hide desktop one */
    .apr-card-mobile {
      display: flex;
    }

    .pool-detail-right .apr-card:not(.apr-card-mobile) {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .apr-card {
      padding: 1rem;
    }

    .apr-title {
      font-size: 0.875rem;
    }

    .apr-value {
      font-size: 1.5rem;
    }
  }
</style>
