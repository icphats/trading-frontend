<script lang="ts">
  import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
  import TokenDetailHeader from '$lib/components/explore/TokenDetailHeader.svelte';
  import { ExploreChart, EXPLORE_INTERVAL_CONFIG, toCandidChartInterval, type TimeInterval, type RawCandle, type FeeDataPoint } from '$lib/components/ui/charts';
  import ActivityTable from '$lib/components/explore/ActivityTable.svelte';
  import LinksSection from '$lib/components/ui/LinksSection.svelte';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { calculateMarketCap } from '$lib/utils/market-cap.utils';
  import { findNearestRate } from '$lib/utils/price.utils';
  import { marketRepository } from '$lib/repositories/market.repository';
  import { indexerRepository } from '$lib/repositories/indexer.repository';
  import { oracleRepository } from '$lib/repositories';
  import type { PriceEntry } from '$lib/repositories/cache';

  interface Props {
    ledger: string;
  }

  let { ledger }: Props = $props();

  // Read token directly from entityStore (single source of truth)
  const token = $derived(entityStore.getToken(ledger));

  // Resolve spot canister ID for chart/TVL data
  const spotCanisterId = $derived.by(() => {
    if (!token) return null;
    return token.baseMarkets?.[0] ?? token.quoteMarkets?.[0] ?? null;
  });

  // Derived values from entityStore
  const tokenLabel = $derived(token?.displaySymbol ?? ledger.slice(0, 8) + '...');
  const priceUsd = $derived(token ? Number(token.priceUsd) / 1e12 : 0); // E12 per 06-Precision.md
  const priceChange24h = $derived(token?.priceChange24h ?? 0);
  const volume24h = $derived(token ? Number(token.volume24h) / 1e6 : 0); // E6 per 06-Precision.md
  const tvl = $derived(token ? Number(token.tvl) / 1e6 : 0); // E6 per 06-Precision.md

  // Market cap (calculated from totalSupply if available)
  const marketCap = $derived.by(() => {
    if (!token?.totalSupply || !token?.priceUsd) return null;
    return calculateMarketCap(token.totalSupply, token.priceUsd, token.decimals);
  });

  // Format total supply with token decimals
  const totalSupplyFormatted = $derived.by(() => {
    if (!token?.totalSupply) return null;
    const raw = Number(token.totalSupply) / Math.pow(10, token.decimals);
    if (raw >= 1_000_000_000_000) {
      return `${(raw / 1_000_000_000_000).toFixed(2)}T`;
    } else if (raw >= 1_000_000_000) {
      return `${(raw / 1_000_000_000).toFixed(2)}B`;
    } else if (raw >= 1_000_000) {
      return `${(raw / 1_000_000).toFixed(2)}M`;
    } else if (raw >= 1_000) {
      return `${(raw / 1_000).toFixed(2)}K`;
    }
    return raw.toLocaleString();
  });

  // Fetch chart data for ExploreChart
  async function fetchChartData(interval: TimeInterval): Promise<RawCandle[]> {
    const marketCanisterId = spotCanisterId;
    if (!marketCanisterId) {
      console.warn('[TokenDetail] No spot canister ID available for chart');
      return [];
    }

    const config = EXPLORE_INTERVAL_CONFIG[interval];
    const chartInterval = toCandidChartInterval(config.backend);

    const result = await marketRepository.fetchChartData(
      marketCanisterId,
      chartInterval,
      config.candles
    );
    if ('err' in result) {
      console.error('[TokenDetail] Failed to fetch chart:', result.err);
      return [];
    }
    return result.ok;
  }

  // Whether this token is a quote token (appears as quote in 1+ markets).
  // Quote tokens (ckUSDT, ICP, ckUSDC) use the indexer for 1M/1Y to avoid fanning out to 100+ markets.
  const isQuoteToken = $derived((token?.quoteMarkets ?? []).length > 0);

  // Snapshot interval mapping (maps TimeInterval to snapshot parameters)
  // Used for Volume/TVL charts — fan-out path (baseMarkets only for quote tokens, all for base-only tokens)
  const SNAPSHOT_INTERVAL_CONFIG: Record<TimeInterval, { intervalHours: number; limit: number }> = {
    '1D': { intervalHours: 1, limit: 24 },   // 24 × 1-hour bars
    '1W': { intervalHours: 6, limit: 28 },   // 28 × 6-hour bars
    '1M': { intervalHours: 24, limit: 30 },  // 30 × daily bars
    '1Y': { intervalHours: 168, limit: 52 }, // 52 × weekly bars
  };

  // Interval → indexer parameters for quote token snapshots
  const INDEXER_INTERVAL_CONFIG: Record<TimeInterval, { intervalHours: number; limit: bigint }> = {
    '1D': { intervalHours: 1, limit: 24n },
    '1W': { intervalHours: 6, limit: 28n },
    '1M': { intervalHours: 24, limit: 30n },
    '1Y': { intervalHours: 24, limit: 365n },
  };

  // Fetch snapshot data for Volume/TVL/Fees charts.
  //
  // Strategy:
  // - Quote tokens (ALL intervals): single indexer call (pre-aggregated, zero fan-out)
  // - Base-only tokens (all intervals): fan out to spot canisters (few markets)
  async function fetchFeesData(interval: TimeInterval): Promise<FeeDataPoint[]> {
    if (!token) return [];

    if (isQuoteToken) {
      return fetchFromIndexer(interval);
    }

    return fetchFromSpotCanisters(interval);
  }

  // Fetch from indexer's unified v2 endpoint (quote tokens, all intervals)
  async function fetchFromIndexer(interval: TimeInterval): Promise<FeeDataPoint[]> {
    const config = INDEXER_INTERVAL_CONFIG[interval];

    const result = await indexerRepository.getQuoteTokenSnapshots(
      ledger, config.intervalHours, config.limit
    );
    if ('err' in result) {
      console.error('[TokenDetail] Indexer quote snapshots failed:', result.err);
      return [];
    }

    return result.ok.data.map((snap) => ({
      timestamp: Math.floor(Number(snap.timestamp) / 1000), // ms → unix seconds
      fees: Number(snap.fees_usd_e6) / 1e6,
      volume: Number(snap.volume_usd_e6) / 1e6,
      tvl: Number(snap.tvl_usd_e6) / 1e6,
    }));
  }

  import { STABLECOIN_SYMBOLS } from '$lib/constants/app.constants';

  // Fan-out to spot canisters for snapshot data (base-only tokens).
  // Volume/Fees are already USD. TVL must be converted from native units using
  // reference_price_e12 (base→quote) and oracle prices (quote→USD).
  async function fetchFromSpotCanisters(interval: TimeInterval): Promise<FeeDataPoint[]> {
    const baseMarkets = token!.baseMarkets ?? [];
    const quoteMarkets = token!.quoteMarkets ?? [];

    const marketsToFetch: { canisterId: string; role: 'base' | 'quote' }[] = [
      ...baseMarkets.map((id) => ({ canisterId: id, role: 'base' as const })),
      ...quoteMarkets.map((id) => ({ canisterId: id, role: 'quote' as const })),
    ];

    if (marketsToFetch.length === 0) return [];

    const config = SNAPSHOT_INTERVAL_CONFIG[interval];

    // Fetch snapshots from all markets
    const fetches = marketsToFetch.map(async ({ canisterId, role }) => {
      const market = entityStore.getMarket(canisterId);
      const result = await marketRepository.fetchMarketSnapshots(canisterId, undefined, config.limit, config.intervalHours);
      if ('err' in result) {
        console.error(`[TokenDetail] Failed to fetch market snapshots for ${canisterId}:`, result.err);
        return { data: [] as any[], role, market };
      }
      return { data: result.ok.data, role, market };
    });

    const results = await Promise.all(fetches);

    // Collect unique quote token symbols that need oracle prices
    // and determine the time range across all snapshots
    let minTs = Infinity;
    let maxTs = 0;
    const quoteSymbolsNeeded = new Set<string>();
    const marketQuoteInfo = new Map<string, { symbol: string; decimals: number }>();

    for (const { data, market } of results) {
      if (!market) continue;
      const quoteToken = entityStore.getToken(market.quoteToken);
      if (!quoteToken) continue;
      const qSymbol = quoteToken.symbol.toLowerCase();
      marketQuoteInfo.set(market.canisterId, { symbol: qSymbol, decimals: quoteToken.decimals });

      if (!STABLECOIN_SYMBOLS.has(qSymbol)) {
        quoteSymbolsNeeded.add(qSymbol);
      }

      for (const snap of data) {
        const tsMs = Number(snap.timestamp);
        if (tsMs < minTs) minTs = tsMs;
        if (tsMs > maxTs) maxTs = tsMs;
      }
    }

    // Fetch oracle prices for non-stablecoin quote tokens
    const oraclePricesBySymbol = new Map<string, PriceEntry[]>();
    if (quoteSymbolsNeeded.size > 0 && minTs < Infinity) {
      const stepMs = BigInt(config.intervalHours) * 3_600_000n;
      const oracleFetches = [...quoteSymbolsNeeded].map(async (symbol) => {
        const result = await oracleRepository.fetchPriceArchive(symbol, BigInt(minTs), BigInt(maxTs), stepMs);
        if ('ok' in result) {
          oraclePricesBySymbol.set(symbol, result.ok);
        }
      });
      await Promise.all(oracleFetches);
    }

    // Aggregate by timestamp across all markets
    const byTimestamp = new Map<number, { fees: number; volume: number; tvl: number }>();
    const tokenDecimals = token!.decimals;

    for (const { data, role, market } of results) {
      if (!market) continue;
      const quoteInfo = marketQuoteInfo.get(market.canisterId);
      if (!quoteInfo) continue;

      const isStableQuote = STABLECOIN_SYMBOLS.has(quoteInfo.symbol);
      const quoteOraclePrices = isStableQuote ? [] : (oraclePricesBySymbol.get(quoteInfo.symbol) ?? []);

      for (const snapshot of data) {
        const ts = Math.floor(Number(snapshot.timestamp) / 1000);
        const existing = byTimestamp.get(ts) ?? { fees: 0, volume: 0, tvl: 0 };

        // Volume/Fees: already USD, split by venue — sum both
        existing.fees += (Number(snapshot.pool_fees_usd_e6) + Number(snapshot.book_fees_usd_e6)) / 1e6;
        existing.volume += (Number(snapshot.pool_volume_usd_e6) + Number(snapshot.book_volume_usd_e6)) / 1e6;

        // TVL: convert native custody to USD
        const quoteUsdRate = isStableQuote ? 1.0 : findNearestRate(quoteOraclePrices, Number(snapshot.timestamp));

        if (role === 'base') {
          // base_custody (native) → quote via reference_price → USD via oracle
          const baseCustodyNative = Number(snapshot.base_custody) / Math.pow(10, tokenDecimals);
          const refPrice = Number(snapshot.reference_price_e12) / 1e12;
          existing.tvl += baseCustodyNative * refPrice * quoteUsdRate;
        } else {
          // quote_custody (native) → USD via oracle
          const quoteCustodyNative = Number(snapshot.quote_custody) / Math.pow(10, tokenDecimals);
          existing.tvl += quoteCustodyNative * quoteUsdRate;
        }

        byTimestamp.set(ts, existing);
      }
    }

    // Sort ascending by timestamp
    return Array.from(byTimestamp.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, data]) => ({ timestamp, ...data }));
  }

  const breadcrumbItems = $derived([
    { label: 'Explore', href: '/explore/tokens' },
    { label: 'Tokens', href: '/explore/tokens' },
    { label: tokenLabel, active: true }
  ]);

  // Build links for LinksSection - token + all markets it participates in
  const links = $derived.by(() => {
    if (!token?.displaySymbol) return [];

    const items: { canisterId: string; label: string; tokenLogos: (string | null | undefined)[]; tokenSymbols: string[]; href?: string }[] = [
      {
        canisterId: ledger,
        label: token.displaySymbol,
        tokenLogos: [token.logo],
        tokenSymbols: []
      }
    ];

    // Add all markets where this token is base (TOKEN / quote)
    for (const canisterId of token.baseMarkets ?? []) {
      const market = entityStore.getMarket(canisterId);
      const quoteT = market?.quoteToken ? entityStore.getToken(market.quoteToken) : null;
      if (quoteT?.displaySymbol) {
        items.push({
          canisterId,
          label: `${token.displaySymbol} / ${quoteT.displaySymbol}`,
          tokenLogos: [token.logo, quoteT.logo],
          tokenSymbols: [],
          href: `/explore/pools/${canisterId}/${quoteT.displaySymbol.toLowerCase()}/${market!.feePips}`
        });
      }
    }

    // Add all markets where this token is quote (base / TOKEN)
    for (const canisterId of token.quoteMarkets ?? []) {
      const market = entityStore.getMarket(canisterId);
      const baseT = market?.baseToken ? entityStore.getToken(market.baseToken) : null;
      if (baseT?.displaySymbol) {
        items.push({
          canisterId,
          label: `${baseT.displaySymbol} / ${token.displaySymbol}`,
          tokenLogos: [baseT.logo, token.logo],
          tokenSymbols: [],
          href: `/explore/pools/${canisterId}/${token.displaySymbol.toLowerCase()}/${market!.feePips}`
        });
      }
    }
    return items;
  });

  // Format large numbers (market cap, volume, TVL)
  function formatLargeNumber(num: number | null | undefined): string {
    if (num === null || num === undefined || num === 0) return '—';
    if (num >= 1_000_000_000_000) {
      return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
    } else if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  }
</script>

<div class="token-detail-layout">
  <!-- Left Panel - Main Content -->
  <div class="token-detail-left">
    <Breadcrumb items={breadcrumbItems} />

    <div class="token-detail-content">
      <TokenDetailHeader {ledger} />

      <!-- Price Chart with overlay -->
      <div class="chart-section">
        <ExploreChart
          fetchData={fetchChartData}
          fetchFeesData={fetchFeesData}
          mode="token"
          currentPrice={priceUsd}
          priceChange={priceChange24h}
          baseTokenDecimals={token?.decimals ?? 8}
        />
      </div>

      <!-- Stats Section - Live Data -->
      <div class="stats-section">
        <h2 class="stats-title">Stats</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">TVL</span>
            <span class="stat-value">
              {formatLargeNumber(tvl)}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">24H Volume</span>
            <span class="stat-value">
              {formatLargeNumber(volume24h)}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Market Cap</span>
            <span class="stat-value">
              {formatLargeNumber(marketCap)}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Supply</span>
            <span class="stat-value">
              {totalSupplyFormatted ?? '—'}
            </span>
          </div>
        </div>
      </div>

      <!-- Recent Activity Section -->
      <div class="activity-section">
        <h2 class="section-title">Recent Activity</h2>
        <!-- TODO: Token appears in multiple markets, need market selector or aggregate activity -->
        <ActivityTable spotCanisterId={null} token0Ledger={ledger} />
      </div>
    </div>
  </div>

  <!-- Right Panel - Swap Widget & Info -->
  <div class="token-detail-right">
    <!-- Links Section - only render when data is ready -->
    {#if links.length > 0}
      <LinksSection {links} />
    {/if}

  </div>
</div>

<style>
  /* Two-column layout matching Uniswap */
  /* Note: Container styling (max-width, padding) inherited from parent +layout.svelte */
  .token-detail-layout {
    display: flex;
    justify-content: center;
    width: 100%;
    gap: 80px;
  }

  /* Left panel - main content */
  .token-detail-left {
    max-width: 780px;
    width: 100%;
    flex-grow: 1;
    flex-shrink: 1;
  }

  .token-detail-content {
    margin-top: 24px;
  }

  /* Right panel - swap & info */
  .token-detail-right {
    width: 360px;
    flex-shrink: 0;
    padding-top: 53px;
    display: flex;
    flex-direction: column;
    gap: 40px;
  }

  /* Chart Section */
  .chart-section {
    /* No extra margin - header has margin-bottom: 20px */
  }

  /* Activity Section */
  .activity-section {
    margin-top: 40px;
  }

  .section-title {
    font-family: 'Basel', sans-serif;
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0 0 16px;
  }

  /* Stats Section */
  .stats-section {
    margin-top: 40px;
    padding: 20px;
    border-radius: 20px;
    background: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .stats-title {
    font-family: 'Basel', sans-serif;
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-label {
    font-family: 'Basel', sans-serif;
    font-size: 15px;
    line-height: 19.5px;
    font-weight: 485;
    color: var(--muted-foreground);
  }

  .stat-value {
    font-family: 'Basel', sans-serif;
    font-size: 36px;
    line-height: 44px;
    font-weight: 485;
    color: var(--foreground);
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .token-detail-layout {
      flex-direction: column;
      gap: 40px;
      padding: 16px;
    }

    .token-detail-left {
      max-width: 100%;
    }

    .token-detail-right {
      width: 100%;
      max-width: 780px;
      padding-top: 0;
    }
  }

  @media (max-width: 768px) {
    .stats-section {
      padding: 16px;
      gap: 20px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .stat-value {
      font-size: 28px;
      line-height: 36px;
    }
  }
</style>
