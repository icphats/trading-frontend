/**
 * SpotMarket Entity
 *
 * Domain entity for spot markets with CLOB+V3 hybrid functionality.
 * Consolidates trading (CLOB) and liquidity (V3 AMM) features.
 * Uses repository pattern for data access.
 *
 * Single-Market Architecture:
 * Each spot canister serves exactly one BASE/QUOTE market pair.
 * The quote token (ICP, USDC, or USDT) is fixed at canister creation
 * and available via diagnostics.tokens.quote.ledger. No user selection needed.
 *
 * Key features:
 * - Uses marketRepository instead of direct services
 * - Implements BaseMarket interface
 * - Consolidates trading + liquidity into single entity
 * - Quote token derived from canister diagnostics (tokens.quote.ledger)
 */

import { marketRepository } from '$lib/repositories/market.repository';

import { type QuoteToken, toQuoteToken } from '../quote-token.types';
import type { SpotMarket as ISpotMarket, MarketCapabilities } from '../market.types';
import { SvelteMap } from 'svelte/reactivity';
import { Principal } from '@dfinity/principal';
import { formatApiError, formatResultError, logDetailedError } from '$lib/utils/error.utils';
import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
import { pollingCoordinator } from '$lib/domain/orchestration/polling-coordinator.svelte';
import type {
  Tick,
  SqrtPriceX96,
  Liquidity,
  PositionView,
  PositionViewEnhanced,
  SpotCandle,
  PlatformData,
  SpotTransactionResponse,
  Side,
  OrderId,
  OrderView,
  Amount,
  UpdateOrderResult,
  MarketDepthResponse,
  QuoteResult,
  BookOrderSpec,
  PoolSwapSpec,
  CreateOrdersResult,
  PositionId,
  TriggerView,
  TriggerType,
  TriggerId,
  TriggerSpec,
  CreateTriggersResult,
  ChartInterval,
  CandleData,
  BalanceSheet,
  ClaimTokenId,
  DepositResult,
  WithdrawResult,
  ActivityView,
  ChainCursor,
} from '$lib/actors/services/spot.service';

import * as utils from '$lib/domain/markets/utils';
import { formatSigFig } from '$lib/utils/format.utils';

// Token registration - use repository (handles caching internally)
import { tokenRepository } from '$lib/repositories/token.repository';

// Quote token ledger canister IDs (well-known IC canisters) for reverse lookup
const QUOTE_TOKEN_BY_LEDGER: Record<string, 'icp' | 'usdc' | 'usdt'> = {
  'ryjl3-tyaaa-aaaaa-aaaba-cai': 'icp',
  'xevnm-gaaaa-aaaar-qafnq-cai': 'usdc',
  'cngnf-vqaaa-aaaar-qag4q-cai': 'usdt'
};

/**
 * Ensure a token is registered in the entityStore
 * Uses tokenRepository which handles L1/L2 caching internally (cache transparency)
 * This is critical for production: tokens may not be pre-registered
 */
async function ensureTokenRegistered(ledgerPrincipal: Principal): Promise<void> {
  const canisterId = ledgerPrincipal.toString();

  // Already registered in entityStore? Done.
  if (entityStore.getToken(canisterId)) {
    return;
  }

  // Use repository - handles L1 memory → L2 IndexedDB → network fetch internally
  const result = await tokenRepository.discoverToken(canisterId);

  if ('ok' in result) {
    const metadata = result.ok;
    entityStore.upsertToken({
      canisterId,
      symbol: metadata.symbol,
      name: metadata.name,
      decimals: metadata.decimals,
      logo: metadata.logo ?? null,
      fee: metadata.fee,
    });
  } else {
    // Fallback: register with minimal info so UI doesn't break
    console.warn(`[SpotMarket] Failed to discover token ${canisterId}:`, result.err);
    entityStore.upsertToken({
      canisterId,
      symbol: 'TOKEN',
      name: 'Unknown Token',
      decimals: 8,
    });
  }
}

// Re-export QuoteToken for consumers
export type { QuoteToken };

// ============================================
// SpotMarket Class
// ============================================

export class SpotMarket implements ISpotMarket {
  // ============================================
  // BaseMarket Implementation
  // ============================================

  readonly assetType = 'spot' as const;
  readonly canister_id: string;
  readonly token_name: string;
  readonly token_symbol: string;

  // ============================================
  // Pool State (Reactive)
  // ============================================

  /**
   * Last trade tick (log base 1.0001 of price) — from most recent trade or first pool init
   */
  lastTradeTick = $state<Tick | null>(null);

  /**
   * Last trade sqrt price in Q64.96 format
   */
  lastTradeSqrtPriceX96 = $state<SqrtPriceX96 | null>(null);

  /**
   * Last book trade tick — triggers anchor to this, not platform-wide last trade.
   */
  lastBookTick = $state<Tick | null>(null);

  /**
   * Reference tick — live market price signal for pool initialization.
   * Priority: book mid > viable pool median > last_trade_tick > null.
   */
  referenceTick = $state<Tick | null>(null);

  /**
   * Active liquidity at current tick
   */
  liquidity = $state<Liquidity>(0n);

  /**
   * Pool fee in pips (e.g., 3000 = 0.3%)
   */
  fee = $state<number>(3000);

  /**
   * Tick spacing (determines valid tick intervals)
   */
  tickSpacing = $state<number>(1);

  /**
   * Whether pool has been initialized with liquidity
   */
  initialized = $state<boolean>(false);

  /**
   * Token addresses [token0, token1]
   */
  tokens = $state<[Principal, Principal] | null>(null);

  // ============================================
  // Token Metadata (DERIVED from entityStore)
  // ============================================

  /**
   * Base token (token0) decimals
   * DERIVED from entityStore - single source of truth
   * Used for volume scaling in chart transforms
   */
  get baseTokenDecimals(): number {
    if (!this.tokens?.[0]) return 8; // Default to ICP decimals
    const token = entityStore.getToken(this.tokens[0].toString());
    return token?.decimals ?? 8;
  }

  /**
   * Quote token (token1) decimals
   * DERIVED from entityStore - single source of truth
   */
  get quoteTokenDecimals(): number {
    if (!this.tokens?.[1]) return 8; // Default to ICP decimals
    const token = entityStore.getToken(this.tokens[1].toString());
    return token?.decimals ?? 8;
  }

  // ============================================
  // CLOB Order State (DERIVED from entityStore)
  // ============================================

  /**
   * User's active orders (limit orders in book)
   * DERIVED from entityStore - single source of truth
   * Unified array - side field indicates buy/sell
   */
  get userOrders(): OrderView[] {
    return entityStore.getUserMarketData(this.canister_id)?.orders ?? [];
  }

  /**
   * User's active triggers (stop-loss and take-profit)
   * DERIVED from entityStore - single source of truth
   * Unified array - trigger_type field indicates above/below
   */
  get userTriggers(): TriggerView[] {
    return entityStore.getUserMarketData(this.canister_id)?.triggers ?? [];
  }

  /**
   * User's order history (completed/cancelled orders from stable storage)
   * TODO: Re-enable when backend history endpoint is available
   */
  userOrderHistory = $state<OrderView[]>([]);

  /**
   * Cursor for pagination of order history
   * TODO: Re-enable when backend history endpoint is available
   */
  userOrderHistoryCursor = $state<bigint | null>(null);

  /**
   * Whether there are more orders to load
   */
  userOrderHistoryHasMore = $state<boolean>(true);

  /**
   * Loading state for order history
   */
  userOrderHistoryLoading = $state<boolean>(false);

  /**
   * User's trigger history (completed/cancelled triggers from stable storage)
   * TODO: Re-enable when backend history endpoint is available
   */
  userTriggerHistory = $state<TriggerView[]>([]);

  /**
   * Cursor for pagination of trigger history
   * TODO: Re-enable when backend history endpoint is available
   */
  userTriggerHistoryCursor = $state<bigint | null>(null);

  /**
   * Whether there are more triggers to load
   */
  userTriggerHistoryHasMore = $state<boolean>(true);

  /**
   * Loading state for trigger history
   */
  userTriggerHistoryLoading = $state<boolean>(false);

  // ============================================
  // Unified Activity History
  // ============================================

  /**
   * User's activity history (unified feed of orders, triggers, LP, transfers)
   */
  activityItems = $state<ActivityView[]>([]);

  /**
   * Cursor for activity pagination (chain cursor format)
   */
  private activityCursor: ChainCursor | null = null;

  /**
   * Whether there are more activities to load
   */
  activityHasMore = $state<boolean>(true);

  /**
   * Loading state for activity fetch
   */
  activityLoading = $state<boolean>(false);

  // ============================================
  // User Balance Breakdown (DERIVED from entityStore)
  // ============================================

  /**
   * Available base token balance (pre-deposited for atomic orders)
   * DERIVED from entityStore - single source of truth
   */
  get availableBase(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.available.base ?? 0n;
  }

  /**
   * Available quote token balance (pre-deposited for atomic orders)
   * DERIVED from entityStore - single source of truth
   */
  get availableQuote(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.available.quote ?? 0n;
  }

  /**
   * Base token locked in limit orders
   * DERIVED from entityStore - single source of truth
   */
  get ordersLockedBase(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.locked.orders.base ?? 0n;
  }

  /**
   * Quote token locked in limit orders
   * DERIVED from entityStore - single source of truth
   */
  get ordersLockedQuote(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.locked.orders.quote ?? 0n;
  }

  /**
   * Base token locked in triggers (stop-loss / take-profit)
   * DERIVED from entityStore - single source of truth
   */
  get triggersLockedBase(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.locked.triggers.base ?? 0n;
  }

  /**
   * Quote token locked in triggers (stop-loss / take-profit)
   * DERIVED from entityStore - single source of truth
   */
  get triggersLockedQuote(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.locked.triggers.quote ?? 0n;
  }

  /**
   * Base token locked in LP positions (principal liquidity)
   * DERIVED from entityStore - single source of truth
   */
  get positionsLockedBase(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.locked.positions.base ?? 0n;
  }

  /**
   * Quote token locked in LP positions (principal liquidity)
   * DERIVED from entityStore - single source of truth
   */
  get positionsLockedQuote(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.locked.positions.quote ?? 0n;
  }

  /**
   * Uncollected LP fees (base token)
   * DERIVED from entityStore - single source of truth
   */
  get feesBase(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.fees.base ?? 0n;
  }

  /**
   * Uncollected LP fees (quote token)
   * DERIVED from entityStore - single source of truth
   */
  get feesQuote(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.fees.quote ?? 0n;
  }

  /**
   * Market depth (separated book + pool liquidity)
   * Book bids/asks contain limit orders only
   * Pools contain AMM liquidity curves for depth visualization
   */
  marketDepth = $state<MarketDepthResponse | null>(null);

  /**
   * User's preferred orderbook bucket size in basis points (10 = 0.1%)
   * Used for both platform polling and explicit orderbook fetches
   */
  orderBookBucketSize = $state<number>(10);

  // ============================================
  // Chart & Platform Data (Reactive)
  // ============================================

  /**
   * Chart data for current interval
   */
  chartData = $state<SpotCandle[]>([]);

  /**
   * Current chart interval
   */
  chartInterval = $state<ChartInterval>({ hour1: null });

  /**
   * Whether chart is transitioning between intervals
   * Used to prevent live candle updates during transition
   */
  isTransitioningInterval = $state<boolean>(false);

  /**
   * Live candle data (current incomplete candle)
   * Tuple: (timestamp, open, high, low, close, volume, quote_usd_rate)
   */
  liveCandle = $state<CandleData | null>(null);

  /**
   * Total number of LP positions in the market
   */
  totalPositions = $state<bigint>(0n);

  // ============================================
  // Market Stats (Flat Fields from MarketStats)
  // ============================================

  // NOTE: Price is derived from tick via spotPrice (single source of truth)
  // No priceE12 field - use spotPrice derived field instead

  /**
   * 24h price change percentage (e.g., 5.25 = +5.25%)
   */
  priceChange24h = $state<number>(0);

  /**
   * 24h trading volume in USD (E6 format - canonical USD accumulator precision)
   */
  volume24hUsd = $state<bigint>(0n);

  // ============================================
  // Platform Stats (from PlatformData polling)
  // ============================================

  users = $state<bigint>(0n);
  ordersLive = $state<bigint>(0n);
  triggersLive = $state<bigint>(0n);
  totalTransactions = $state<bigint>(0n);
  poolDepthBaseUsdE6 = $state<bigint>(0n);
  poolDepthQuoteUsdE6 = $state<bigint>(0n);
  bookDepthBaseUsdE6 = $state<bigint>(0n);
  bookDepthQuoteUsdE6 = $state<bigint>(0n);

  // ============================================
  // User Position State (DERIVED from entityStore)
  // ============================================

  /**
   * Current user's position IDs
   * DERIVED from entityStore - single source of truth
   */
  get userPositionIds(): bigint[] {
    return entityStore.getUserMarketData(this.canister_id)?.positions.map(p => p.position_id) ?? [];
  }

  /**
   * Current user's positions with enhanced metadata
   * DERIVED from entityStore - single source of truth
   * Includes APY, USD values, fees, and token amounts
   * Sorted by USD value descending
   */
  get userPositions(): PositionViewEnhanced[] {
    return entityStore.getUserMarketData(this.canister_id)?.positions ?? [];
  }

  /**
   * User positions aggregate: total TVL in USD (E6 precision)
   * DERIVED from entityStore - single source of truth
   */
  get userPositionsTotalTvl(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.totalPositionsTvlE6 ?? 0n;
  }

  /**
   * User positions aggregate: total fees earned in USD (E6 precision)
   * DERIVED from entityStore - single source of truth
   */
  get userPositionsTotalFees(): bigint {
    return entityStore.getUserMarketData(this.canister_id)?.totalPositionsFeesE6 ?? 0n;
  }

  /**
   * User positions aggregate: weighted average APY
   * DERIVED from entityStore - single source of truth
   */
  get userPositionsWeightedApy(): number {
    return entityStore.getUserMarketData(this.canister_id)?.weightedAvgApy ?? 0;
  }

  // ============================================
  // Transaction State (Reactive)
  // ============================================

  /**
   * Recent transactions (SvelteMap for reactive updates)
   * Uses tx_id as key (persistent, unique transaction ID)
   * Note: quoteToken removed - now fixed per canister (derived from config)
   */
  txs = new SvelteMap<bigint, {
    id: bigint;              // Unique transaction ID (from backend)
    price_e12: bigint;       // Execution price (E12 precision)
    timestamp: number;       // Unix timestamp in milliseconds
    base_amount: bigint;     // Base token (token0) amount traded
    quote_amount: bigint;    // Quote token amount traded
    usd_value: bigint;       // Pre-computed USD value (E6 - canonical USD accumulator precision)
    side: 'buy' | 'sell';    // Trade direction
  }>();

  /**
   * Cursor for transaction pagination (null = no more transactions)
   */
  private txCursor: bigint | null = null;

  /**
   * Whether there are more transactions to load
   */
  txHasMore = $state<boolean>(true);

  /**
   * Loading state for transaction pagination
   */
  txLoading = $state<boolean>(false);

  // ============================================
  // Derived Properties
  // ============================================

  /**
   * Current price in E12 format (canonical display price)
   * Derived directly from lastTradeSqrtPriceX96 using pure bigint math.
   * This is the single source of truth for display price - no floating-point precision loss.
   */
  priceE12 = $derived.by(() => {
    if (this.lastTradeSqrtPriceX96 === null) return 0n;
    return utils.sqrtPriceX96ToPriceE12(this.lastTradeSqrtPriceX96, this.baseTokenDecimals, this.quoteTokenDecimals);
  });

  /**
   * Current spot price (token1 / token0)
   * Derived from priceE12 for consistency with E12 display format.
   */
  spotPrice = $derived.by(() => {
    if (this.priceE12 === 0n) return 0;
    return Number(this.priceE12) / 1e12;
  });

  /**
   * Display decimals for chart axis formatting.
   * Calculates decimal places needed to show 6 significant figures.
   * Used by Chart.svelte for lightweight-charts price axis precision.
   *
   * Examples:
   * - 100,000 = 6 sig figs, 0 decimals
   * - 123.456 = 6 sig figs, 3 decimals
   * - 1.23456 = 6 sig figs, 5 decimals
   * - 0.123456 = 6 sig figs, 6 decimals
   * - 0.0000468712 = 6 sig figs, 10 decimals
   */
  displayDecimals = $derived.by(() => {
    const price = this.spotPrice;

    if (price === 0) return 6;

    // For prices >= 1, count integer digits
    if (price >= 1) {
      const integerDigits = Math.floor(Math.log10(price)) + 1;
      // If we already have 6+ significant digits in the integer part, no decimals needed
      if (integerDigits >= 6) return 0;
      // Otherwise show enough decimals to reach 6 total significant digits
      return 6 - integerDigits;
    }

    // For prices < 1, find leading zeros after decimal point
    const priceStr = price.toString();
    const match = priceStr.match(/^0\.0*/);

    if (!match) return 6;

    // Count leading zeros (e.g., 0.0001 has 4 leading zeros)
    const leadingZeros = match[0].length - 2; // Subtract "0."

    // Show leadingZeros + 6 significant digits
    return leadingZeros + 6;
  });

  /**
   * Current price as a formatted string with 6 significant figures
   */
  formattedPrice = $derived.by(() => {
    return formatSigFig(this.spotPrice);
  });

  /**
   * Active quote token as Candid variant for backend calls
   * Derived from the token1 (quote token) ledger stored in this.tokens
   * Returns { ICP: null } as fallback if tokens not yet loaded
   */
  activeQuoteToken = $derived.by((): QuoteToken => {
    return toQuoteToken(this.getQuoteTokenSymbol());
  });

  private currentUserPrincipal: Principal | null = null;

  // ============================================
  // Constructor
  // ============================================

  constructor(canister_id: string, token_name: string, token_symbol: string) {
    this.canister_id = canister_id;
    this.token_name = token_name;
    this.token_symbol = token_symbol;
  }

  // ============================================
  // Quote Token Helpers (derived from config)
  // ============================================

  /**
   * Get the quote token symbol for cache keys and display
   * Derived from the token1 (quote token) ledger stored in this.tokens
   * Returns 'icp' as fallback if tokens not yet loaded
   */
  getQuoteTokenSymbol(): 'icp' | 'usdc' | 'usdt' {
    if (!this.tokens || !this.tokens[1]) {
      return 'icp'; // Default fallback
    }
    const token1Ledger = this.tokens[1].toString();
    return QUOTE_TOKEN_BY_LEDGER[token1Ledger] ?? 'icp';
  }

  // ============================================
  // Lifecycle Methods (using repository)
  // ============================================

  /**
   * Initialize market state with initial data fetch
   * Uses atomic hydrate_all endpoint for optimal performance (40-60% faster)
   */
  async hydrateAll(interval?: ChartInterval, limit: number = 100): Promise<void> {
    try {
      const t0 = performance.now();
      const chartInterval = interval ?? this.chartInterval;

      // Fetch main hydrate data (critical path)
      // Pass orderBookBucketSize to respect user's preferred aggregation level
      const hydrateResult = await marketRepository.fetchSpotMarketData(
        this.canister_id,
        chartInterval,
        limit,
        this.orderBookBucketSize
      );

      // Fetch indexer data in background (non-critical, fallback for volume)
      // Don't await - this endpoint can fail without blocking UI
      // Note: Backend uses E6 precision for USD accumulators
      marketRepository.fetchSpotIndexerData(this.canister_id).then(indexerResult => {
        if ('ok' in indexerResult && this.volume24hUsd === 0n) {
          this.volume24hUsd = indexerResult.ok.token_data.volume_24h_usd_e6;
        }
      }).catch(() => {
        // Silent fail - indexer data is optional
      });

      if ('err' in hydrateResult) {
        throw new Error(hydrateResult.err);
      }

      const hydrateResponse = hydrateResult.ok;

      // Validate chart data before assignment (chart is now paginated: { data, next_cursor, has_more })
      if (!hydrateResponse.chart || !Array.isArray(hydrateResponse.chart.data)) {
        throw new Error('Invalid chart data received from backend');
      }

      // Hydrate config (required for tokens)
      // MUST await - tokens are needed by UI components immediately after hydrateAll()
      // NOTE: Transactions are already included in hydrateResponse.recent_trades,
      // so we don't need a separate hydrateTransactions() call here.
      const t1 = performance.now();
      await this.hydrateStaticConfig().catch((err) => {
        console.error('[SpotMarket.hydrateAll] Failed to hydrate static config:', err);
      });

      // Update chart data (extract from paginated response)
      this.chartData = hydrateResponse.chart.data;
      this.chartInterval = chartInterval;

      // Destructure platform data into flat fields
      const platform = hydrateResponse.platform;
      this.lastTradeTick = platform.last_trade_tick?.[0] ?? null;
      this.lastTradeSqrtPriceX96 = platform.last_trade_sqrt_price_x96?.[0] ?? null;
      this.lastBookTick = platform.last_book_tick?.[0] ?? null;
      this.referenceTick = platform.reference_tick?.[0] ?? null;
      this.liquidity = platform.liquidity;
      this.liveCandle = platform.candle;
      this.totalPositions = platform.total_positions;
      this.marketDepth = platform.market_depth;

      // Market stats now included in platform data (price derived from tick, not duplicated)
      // price_change_24h_bps is in basis points (bigint), convert to percentage
      this.priceChange24h = utils.bpsToPercent(platform.price_change_24h_bps);
      this.volume24hUsd = platform.volume_24h_usd_e6;

      // Platform stats
      this.users = platform.users;
      this.ordersLive = platform.orders_live;
      this.triggersLive = platform.triggers_live;
      this.totalTransactions = platform.total_transactions;
      this.poolDepthBaseUsdE6 = platform.pool_depth_base_usd_e6;
      this.poolDepthQuoteUsdE6 = platform.pool_depth_quote_usd_e6;
      this.bookDepthBaseUsdE6 = platform.book_depth_base_usd_e6;
      this.bookDepthQuoteUsdE6 = platform.book_depth_quote_usd_e6;

      // Process user data from hydrate response - PUSH to entityStore (single source of truth)
      if (hydrateResponse.user && hydrateResponse.user.length > 0) {
        const userDataInner = hydrateResponse.user[0];
        if (userDataInner) {
          this.pushUserDataToEntityStore(userDataInner);
        }
      }

      // Process recent trades from hydrate response
      // This is the primary source of transactions on initial load
      if (hydrateResponse.recent_trades) {
        const { data: transactions, next_cursor } = hydrateResponse.recent_trades;

        // Clear existing transactions and reset pagination state
        this.txs.clear();

        // Store transactions in the txs map (SpotTransactionResponse is now a record with base/quote framing)
        for (const tx of transactions) {
          // Skip empty/placeholder transactions (id = 0)
          if (tx.id === 0n) continue;

          this.txs.set(tx.id, {
            id: tx.id,
            price_e12: tx.price_e12,
            timestamp: Number(tx.timestamp),
            base_amount: tx.base_amount,
            quote_amount: tx.quote_amount,
            usd_value: tx.usd_value_e6,
            side: 'buy' in tx.side ? 'buy' : 'sell',
          });
        }

        // Update pagination state correctly
        if (next_cursor.length > 0 && next_cursor[0] !== undefined) {
          this.txCursor = next_cursor[0];
          this.txHasMore = true;
        } else {
          this.txCursor = null;
          this.txHasMore = false;
        }
      }

      // Check initialization status based on liquidity
      this.initialized = this.liquidity > 0n;

      // Push data to entityStore for unified state
      this.pushPriceToEntityStore();
      entityStore.upsertMarket({
        canisterId: this.canister_id,
        lastTradeTick: this.lastTradeTick,
        referenceTick: this.referenceTick,
        lastTradeSqrtPriceX96: this.lastTradeSqrtPriceX96,
        lastTradePrice: platform.current_price_usd_e12,
        volume24h: platform.volume_24h_usd_e6,
        priceChange24h: utils.bpsToPercent(platform.price_change_24h_bps),
        tvl: platform.pool_depth_base_usd_e6 + platform.pool_depth_quote_usd_e6,
      });

      // Persist state to L2 cache for instant UI on next page load
      this.persistStateToCache();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Hydrate chart data for a specific interval
   * Uses get_chart endpoint (NOT full hydrate) for efficiency
   */
  private async hydrateChartData(interval?: ChartInterval, limit: number = 300): Promise<void> {
    const chartInterval = interval ?? this.chartInterval;
    const result = await marketRepository.fetchChartData(
      this.canister_id,
      chartInterval,
      limit
    );

    if ('ok' in result) {
      this.chartData = result.ok;
      this.chartInterval = chartInterval;
    }
  }

  /**
   * Hydrate platform data (price, volume, live candle, orderbook)
   * Called by PollingCoordinator when platform_version changes
   * Uses user's preferred orderbook bucket size
   */
  async hydratePlatformData(): Promise<void> {
    const result = await marketRepository.fetchSpotPlatformData(
      this.canister_id,
      this.chartInterval,
      false, // Bypass cache read - we're here because version changed, fresh data available
      this.orderBookBucketSize // Use user's preferred bucket size
    );

    if ('ok' in result) {
      const platform = result.ok;
      // Destructure platform data into flat fields
      this.lastTradeTick = platform.last_trade_tick?.[0] ?? null;
      this.lastTradeSqrtPriceX96 = platform.last_trade_sqrt_price_x96?.[0] ?? null;
      this.lastBookTick = platform.last_book_tick?.[0] ?? null;
      this.referenceTick = platform.reference_tick?.[0] ?? null;
      this.liquidity = platform.liquidity;
      this.liveCandle = platform.candle;
      this.totalPositions = platform.total_positions;
      this.marketDepth = platform.market_depth;

      // Market stats now included in platform data (updated during polling)
      // price_change_24h_bps is in basis points (bigint), convert to percentage
      this.priceChange24h = utils.bpsToPercent(platform.price_change_24h_bps);
      this.volume24hUsd = platform.volume_24h_usd_e6;

      // Platform stats
      this.users = platform.users;
      this.ordersLive = platform.orders_live;
      this.triggersLive = platform.triggers_live;
      this.totalTransactions = platform.total_transactions;
      this.poolDepthBaseUsdE6 = platform.pool_depth_base_usd_e6;
      this.poolDepthQuoteUsdE6 = platform.pool_depth_quote_usd_e6;
      this.bookDepthBaseUsdE6 = platform.book_depth_base_usd_e6;
      this.bookDepthQuoteUsdE6 = platform.book_depth_quote_usd_e6;

      // Push updated data to entityStore (token + market)
      this.pushPriceToEntityStore();
      entityStore.upsertMarket({
        canisterId: this.canister_id,
        lastTradeTick: this.lastTradeTick,
        referenceTick: this.referenceTick,
        lastTradeSqrtPriceX96: this.lastTradeSqrtPriceX96,
        lastTradePrice: platform.current_price_usd_e12,
        volume24h: platform.volume_24h_usd_e6,
        priceChange24h: utils.bpsToPercent(platform.price_change_24h_bps),
        tvl: platform.pool_depth_base_usd_e6 + platform.pool_depth_quote_usd_e6,
      });
    }
  }

  /**
   * Hydrate static configuration from diagnostics
   * Note: tick_spacing is pool-specific, not in diagnostics
   * Token1 (quote token) is now fixed in the canister's config (single-market architecture)
   *
   * IMPORTANT: This method also ensures tokens are registered in entityStore.
   * Without this, SpotOrderForm will show "Loading market data..." forever
   * because entityStore.getToken() returns undefined for unknown tokens.
   */
  private async hydrateStaticConfig(): Promise<void> {
    // Read token principals from entityStore (populated by market-loader on app init)
    const marketData = entityStore.getMarket(this.canister_id);
    if (!marketData || !marketData.baseToken || !marketData.quoteToken) {
      console.warn(`[SpotMarket] Market ${this.canister_id} not found in entityStore — skipping static config`);
      return;
    }

    const basePrincipal = Principal.fromText(marketData.baseToken);
    const quotePrincipal = Principal.fromText(marketData.quoteToken);

    // Store token ledger principals
    this.tokens = [basePrincipal, quotePrincipal];

    // Ensure both tokens are registered in entityStore
    await Promise.all([
      ensureTokenRegistered(basePrincipal),
      ensureTokenRegistered(quotePrincipal),
    ]);

    // Fetch totalSupply for base token (needed for market cap calculation)
    tokenRepository.fetchTotalSupply(marketData.baseToken).then(supplyResult => {
      if ('ok' in supplyResult) {
        entityStore.upsertToken({
          canisterId: marketData.baseToken,
          totalSupply: supplyResult.ok,
        });
      }
    }).catch(err => {
      console.warn(`[SpotMarket] Failed to fetch totalSupply for ${marketData.baseToken}:`, err);
    });
  }

  /**
   * Hydrate user positions for a specific principal
   * Delegates to hydrateUserDataOnly which fetches all user data and pushes to entityStore
   */
  async hydrateUserPositions(userPrincipal: Principal): Promise<void> {
    this.currentUserPrincipal = userPrincipal;
    await this.hydrateUserDataOnly();
  }

  /**
   * Hydrate user triggers (stop-loss and take-profit)
   * Delegates to hydrateUserDataOnly which fetches all user data and pushes to entityStore
   */
  async hydrateUserTriggers(): Promise<void> {
    await this.hydrateUserDataOnly();
  }

  /**
   * Fetch caller's order history from stable storage
   * Supports pagination - call with reset=true to start fresh
   * Uses caller identity from actor - no principal parameter needed
   *
   * TODO: Re-enable when backend history endpoint is available
   * The fetchSpotUserOrderHistory repository method has been removed
   */
  async fetchUserOrderHistory(
    _limit: number = 50,
    reset: boolean = false
  ): Promise<void> {
    // Reset pagination if requested
    if (reset) {
      this.userOrderHistory = [];
      this.userOrderHistoryCursor = null;
      this.userOrderHistoryHasMore = true;
    }

    // TODO: Re-enable when backend history endpoint is available
    // For now, order history is not available - only live orders from get_user endpoint
    console.warn('[SpotMarket.fetchUserOrderHistory] Order history endpoint not available - use userOrders for live orders');
    this.userOrderHistoryHasMore = false;
    this.userOrderHistoryLoading = false;
  }

  /**
   * Fetch caller's trigger history from stable storage
   * Supports pagination - call with reset=true to start fresh
   * Uses caller identity from actor - no principal parameter needed
   *
   * TODO: Re-enable when backend history endpoint is available
   * The fetchSpotUserTriggerHistory repository method has been removed
   * Use userTriggers (from get_user endpoint) for live triggers only
   */
  async fetchUserTriggerHistory(
    _limit: number = 10,
    reset: boolean = false
  ): Promise<void> {
    // Reset pagination if requested
    if (reset) {
      this.userTriggerHistory = [];
      this.userTriggerHistoryCursor = null;
      this.userTriggerHistoryHasMore = true;
    }

    // TODO: Re-enable when backend history endpoint is available
    // For now, trigger history is not available - only live triggers from get_user endpoint
    console.warn('[SpotMarket.fetchUserTriggerHistory] Trigger history endpoint not available - use userTriggers for live triggers');
    this.userTriggerHistoryHasMore = false;
    this.userTriggerHistoryLoading = false;
  }

  /**
   * Fetch user activity history with pagination
   * Unified feed of orders, triggers, LP events, and transfers
   *
   * @param limit - Items per page (default 20)
   * @param reset - If true, start fresh from newest
   */
  async fetchUserActivity(limit: number = 20, reset: boolean = false): Promise<void> {
    if (this.activityLoading) return;
    if (!reset && !this.activityHasMore) return;

    if (reset) {
      this.activityItems = [];
      this.activityCursor = null;
      this.activityHasMore = true;
    }

    this.activityLoading = true;

    try {
      const result = await marketRepository.fetchUserActivity(
        this.canister_id,
        this.activityCursor ?? undefined,
        limit
      );

      if ('ok' in result) {
        const { data, next_cursor, has_more } = result.ok;

        this.activityItems = reset ? data : [...this.activityItems, ...data];
        this.activityCursor = next_cursor.length > 0 && next_cursor[0] !== undefined
          ? next_cursor[0]
          : null;
        this.activityHasMore = has_more;
      }
    } catch (error) {
      console.error('[SpotMarket.fetchUserActivity] Error:', error);
    } finally {
      this.activityLoading = false;
    }
  }

  /**
   * Load more activities (for infinite scroll)
   */
  async loadMoreActivity(): Promise<void> {
    if (!this.activityHasMore || this.activityLoading) return;
    await this.fetchUserActivity(20, false);
  }


  /**
   * Hydrate market depth only (when orderbook_version changes but platform_version doesn't)
   * Called by PollingCoordinator — cheaper than full platform data
   * PUSHES last_trade_sqrt_price_x96 to entityStore (single source of truth for market price)
   */
  async hydrateOrderBookOnly(): Promise<void> {
    try {
      const result = await marketRepository.getSpotMarketDepth(
        this.canister_id,
        20, // 20 levels per side
        this.orderBookBucketSize // tick bucket size
      );

      if ('ok' in result) {
        this.marketDepth = result.ok;

        // Update local lastTradeSqrtPriceX96 from market depth response
        const newSqrtPrice = result.ok.last_trade_sqrt_price_x96;
        if (newSqrtPrice && newSqrtPrice !== this.lastTradeSqrtPriceX96) {
          this.lastTradeSqrtPriceX96 = newSqrtPrice;

          // Push to entityStore (single source of truth)
          entityStore.upsertMarket({
            canisterId: this.canister_id,
            lastTradeSqrtPriceX96: newSqrtPrice,
          });
        }
      }
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Hydrate chart data only (when candle_version changes)
   * Called by PollingCoordinator — uses get_chart endpoint
   */
  async hydrateChartOnly(): Promise<void> {
    try {
      const result = await marketRepository.fetchChartData(
        this.canister_id,
        this.chartInterval,
        300 // Fetch 300 candles
      );

      if ('ok' in result) {
        this.chartData = result.ok;
      }
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Hydrate user data only (when user_version changes or on login)
   * Uses get_user endpoint instead of polling all user data separately
   * Public so updateUserPrincipal can trigger immediate fetch on login
   * PUSHES to entityStore (single source of truth)
   */
  async hydrateUserDataOnly(): Promise<void> {
    try {
      const result = await marketRepository.fetchUserData(this.canister_id);

      if ('ok' in result && result.ok.length > 0) {
        const userData = result.ok[0];
        if (userData) {
          this.pushUserDataToEntityStore(userData);
        }
      }
    } catch (error) {
      // Silent error handling
    }
  }

  // ============================================
  // Transaction Methods
  // ============================================

  /**
   * Fetch and process recent transactions (refresh on version change)
   * Called by PollingCoordinator when platform_version changes
   * Merges new transactions into existing map, preserves pagination state
   */
  async hydrateTransactions(): Promise<void> {
    try {
      // Fetch newest transactions (cursor=undefined means start from newest)
      const result = await marketRepository.fetchSpotTransactions(this.canister_id, undefined, 50);

      if ('ok' in result) {
        const { data } = result.ok;
        // Merge mode: add new transactions without clearing existing ones
        // This preserves scroll position and previously loaded transactions
        this.processTransactions(data, true);

        // NOTE: Do NOT update txCursor or txHasMore here.
        // Those are for pagination state (loadMoreTransactions).
        // Refreshing newest transactions shouldn't reset scroll position.
      }
      // Silently ignore errors - backend may not have transactions yet or have bugs
    } catch (error) {
      // Silent error handling - don't spam console during polling
    }
  }

  /**
   * Process transaction data from backend
   * Backend returns: SpotTransactionResponse record with base/quote framing
   *
   * @param txData - Array of SpotTransactionResponse records
   * @param append - If true, append to existing transactions (for pagination)
   */
  private processTransactions(txData: SpotTransactionResponse[], append: boolean = false): void {
    // Clear existing transactions if not appending
    if (!append) {
      this.txs.clear();
    }

    for (const tx of txData) {
      // Skip empty/placeholder transactions (id = 0)
      if (tx.id === 0n) {
        continue;
      }

      // Parse Side variant to string ('buy' or 'sell')
      const side: 'buy' | 'sell' = 'buy' in tx.side ? 'buy' : 'sell';

      this.txs.set(tx.id, {
        id: tx.id,
        price_e12: tx.price_e12,
        timestamp: Number(tx.timestamp),
        base_amount: tx.base_amount,
        quote_amount: tx.quote_amount,
        usd_value: tx.usd_value_e6,
        side,
      });
    }
  }

  /**
   * Load more transactions (for infinite scroll)
   * Uses cursor-based pagination
   */
  async loadMoreTransactions(): Promise<void> {
    if (!this.txHasMore || this.txLoading) return;

    this.txLoading = true;

    try {
      const result = await marketRepository.fetchSpotTransactions(
        this.canister_id,
        this.txCursor ?? undefined,
        50
      );

      if ('ok' in result) {
        const { data, next_cursor, has_more } = result.ok;
        this.processTransactions(data, true); // Append mode

        // Update cursor and hasMore state
        if (next_cursor.length > 0 && next_cursor[0] !== undefined) {
          this.txCursor = next_cursor[0];
        } else {
          this.txCursor = null;
        }
        this.txHasMore = has_more;
      }
    } catch (error) {
      console.error('[SpotMarket.loadMoreTransactions] Error:', error);
    } finally {
      this.txLoading = false;
    }
  }

  // ============================================
  // Trading Operations (CLOB) - REPOSITORY INTEGRATION
  // ============================================

  /**
   * Unified order creation: optional cancels + book orders + pool swaps
   * Replaces createLimitOrder, executeMarketOrder, and convertToMarket.
   *
   * @param cancelIds - Order IDs to cancel before creating new orders
   * @param bookOrders - Book order specs (from QuoteResult.book_order or manually built)
   * @param poolSwaps - Pool swap specs (from QuoteResult.pool_swaps)
   * @returns The full CreateOrdersResult.ok shape on success
   */
  async createOrders(
    cancelIds: OrderId[],
    bookOrders: BookOrderSpec[],
    poolSwaps: PoolSwapSpec[]
  ): Promise<Extract<CreateOrdersResult, { ok: unknown }>['ok']> {
    const result = await marketRepository.createSpotOrders(
      this.canister_id,
      cancelIds,
      bookOrders,
      poolSwaps
    );

    if ('ok' in result) {
      // Step 1: Instant balance feedback + optimistic order removal for cancels
      const updateData: Parameters<typeof entityStore.upsertUserMarketData>[0] = {
        spotCanisterId: this.canister_id,
        available: { base: result.ok.available_base, quote: result.ok.available_quote },
      };
      if (cancelIds.length > 0) {
        const cancelSet = new Set(cancelIds.map(id => id));
        updateData.orders = this.userOrders.filter(o => !cancelSet.has(o.order_id));
      }
      entityStore.upsertUserMarketData(updateData);
      // Step 2: Immediate hydration of changed data + version cache update
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return result.ok;
    }

    // Step 3: Throw for toast
    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.createOrders', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Cancel limit order
   */
  async cancelOrder(orderId: OrderId): Promise<void> {
    const result = await marketRepository.cancelSpotLimitOrder(
      this.canister_id,
      orderId
    );

    if ('ok' in result) {
      // Step 1: Instant balance feedback + optimistic order removal
      entityStore.upsertUserMarketData({
        spotCanisterId: this.canister_id,
        available: { base: result.ok.available_base, quote: result.ok.available_quote },
        orders: this.userOrders.filter(o => o.order_id !== orderId),
      });
      // Step 2: Bump versions (skip redundant poll)
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return;
    }

    // Step 3: Throw for toast
    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.cancelOrder', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Update (modify) limit order atomically
   * Cancels old order and creates new order in single backend transaction
   * Book-only operation - does not route through AMM pools
   *
   * For converting a limit order to market (IOC) execution with routing, use createOrders() with cancelIds
   *
   * @param orderId - The order to update
   * @param newTick - New limit price as tick
   * @param newInputAmount - New input token amount
   * @returns UpdateOrderResult variant:
   *   - { replaced: { available_base, available_quote } } for increase/tick change (new order ID)
   *   - { modified: { refunded, available_base, available_quote } } for decrease at same tick (retains order ID)
   */
  async updateOrder(
    orderId: OrderId,
    newTick: Tick,
    newInputAmount: Amount
  ): Promise<{ order_id: bigint; wasReplaced: boolean }> {
    const result = await marketRepository.updateSpotLimitOrder(
      this.canister_id,
      orderId,
      newTick,
      newInputAmount
    );

    if ('ok' in result) {
      if ('replaced' in result.ok) {
        const r = result.ok.replaced;
        entityStore.upsertUserMarketData({
          spotCanisterId: this.canister_id,
          available: { base: r.available_base, quote: r.available_quote },
        });
        pollingCoordinator.applyMutationVersions(this.canister_id, r.versions);
        return { order_id: r.order_id, wasReplaced: true };
      } else {
        const m = result.ok.modified;
        entityStore.upsertUserMarketData({
          spotCanisterId: this.canister_id,
          available: { base: m.available_base, quote: m.available_quote },
        });
        pollingCoordinator.applyMutationVersions(this.canister_id, m.versions);
        return { order_id: orderId, wasReplaced: false };
      }
    }

    // Step 3: Throw for toast
    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.updateOrder', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Unified trigger creation: optional cancels + batch create in a single call.
   * Replaces the old createTrigger + replaceTrigger pattern.
   */
  async createTriggers(
    cancelIds: TriggerId[],
    specs: TriggerSpec[]
  ): Promise<Extract<CreateTriggersResult, { ok: unknown }>['ok']> {
    const result = await marketRepository.createSpotTriggers(
      this.canister_id,
      cancelIds,
      specs
    );

    if ('ok' in result) {
      const innerResult = result.ok;
      if ('ok' in innerResult) {
        const updateData: Parameters<typeof entityStore.upsertUserMarketData>[0] = {
          spotCanisterId: this.canister_id,
          available: { base: innerResult.ok.available_base, quote: innerResult.ok.available_quote },
        };
        if (cancelIds.length > 0) {
          const cancelSet = new Set(cancelIds.map(id => id));
          updateData.triggers = this.userTriggers.filter(t => !cancelSet.has(BigInt(t.trigger_id)));
        }
        entityStore.upsertUserMarketData(updateData);
        pollingCoordinator.applyMutationVersions(this.canister_id, innerResult.ok.versions);
        return innerResult.ok;
      }
      const errorMessage = formatResultError(innerResult);
      logDetailedError('SpotMarket.createTriggers', innerResult.err);
      throw new Error(errorMessage);
    }

    const outerError = typeof result.err === 'string' ? result.err : formatApiError(result.err);
    throw new Error(outerError);
  }

  /**
   * Cancel trigger order by ID
   * Restores locked balance for the trigger
   */
  async cancelTrigger(triggerId: bigint): Promise<void> {
    const result = await marketRepository.cancelSpotTrigger(
      this.canister_id,
      triggerId
    );

    if ('ok' in result) {
      const innerResult = result.ok;
      if ('ok' in innerResult) {
        // Step 1: Instant balance feedback + optimistic trigger removal
        entityStore.upsertUserMarketData({
          spotCanisterId: this.canister_id,
          available: { base: innerResult.ok.available_base, quote: innerResult.ok.available_quote },
          triggers: this.userTriggers.filter(t => BigInt(t.trigger_id) !== triggerId),
        });
        // Step 2: Bump versions (skip redundant poll)
        pollingCoordinator.applyMutationVersions(this.canister_id, innerResult.ok.versions);
        return;
      }
      // Inner error (ApiError)
      const errorMessage = formatResultError(innerResult);
      logDetailedError('SpotMarket.cancelTrigger', innerResult.err);
      throw new Error(errorMessage);
    }

    // Outer error (repository-level error)
    const outerError = typeof result.err === 'string' ? result.err : formatApiError(result.err);
    throw new Error(outerError);
  }


  // ============================================================================
  // LIQUIDITY MUTATIONS (canonical 3-step pattern)
  // ============================================================================

  /**
   * Collect accrued fees from a liquidity position
   * @returns Collected amounts { collected_amt0, collected_amt1 }
   */
  async collectFees(positionId: PositionId): Promise<{ collected_amt0: bigint; collected_amt1: bigint }> {
    const result = await marketRepository.collectSpotFees(this.canister_id, positionId);

    if ('ok' in result) {
      // Step 2: Bump versions (no available balances in response — poll handles it)
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return { collected_amt0: result.ok.collected_amt0, collected_amt1: result.ok.collected_amt1 };
    }

    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.collectFees', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Lock a position until a given timestamp (one-way ratchet: can only extend)
   * Blocks decrease_liquidity while locked. Fee collection and increase remain unaffected.
   */
  async lockPosition(positionId: PositionId, lockUntilMs: bigint): Promise<void> {
    const result = await marketRepository.lockSpotPosition(this.canister_id, positionId, lockUntilMs);

    if ('ok' in result) {
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return;
    }

    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.lockPosition', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Transfer a position to a new owner
   * No balance change — only bumps versions so polling picks up the removed position
   */
  async transferPosition(positionId: PositionId, recipient: Principal): Promise<void> {
    const result = await marketRepository.transferSpotPosition(
      this.canister_id, positionId, recipient,
    );

    if ('ok' in result) {
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return;
    }

    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.transferPosition', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Increase liquidity in an existing position
   * @returns Actual amounts deposited and liquidity delta
   */
  async increaseLiquidity(
    positionId: PositionId,
    amount0Desired: bigint,
    amount1Desired: bigint,
  ): Promise<{ liquidity_delta: bigint; actual_amt0: bigint; actual_amt1: bigint }> {
    const result = await marketRepository.increaseSpotLiquidity(
      this.canister_id, positionId, amount0Desired, amount1Desired,
    );

    if ('ok' in result) {
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return {
        liquidity_delta: result.ok.liquidity_delta,
        actual_amt0: result.ok.actual_amt0,
        actual_amt1: result.ok.actual_amt1,
      };
    }

    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.increaseLiquidity', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Add liquidity to create a new position
   * @returns Position ID and actual amounts deposited
   */
  async addLiquidity(
    feePips: number,
    tickLower: Tick,
    tickUpper: Tick,
    amount0Desired: bigint,
    amount1Desired: bigint,
    initialTick?: Tick,
    lockUntilMs?: bigint,
  ): Promise<{ position_id: PositionId; actual_amt0: bigint; actual_amt1: bigint }> {
    const result = await marketRepository.addSpotLiquidity(
      this.canister_id, feePips, tickLower, tickUpper, amount0Desired, amount1Desired, initialTick, lockUntilMs,
    );

    if ('ok' in result) {
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return { position_id: result.ok.position_id, actual_amt0: result.ok.actual_amt0, actual_amt1: result.ok.actual_amt1 };
    }

    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.addLiquidity', result.err);
    throw new Error(errorMessage);
  }

  /**
   * Decrease liquidity from a position (partial or full withdrawal)
   * @returns Amounts received (principal + fees)
   */
  async decreaseLiquidity(
    positionId: PositionId,
    liquidityDelta: bigint,
  ): Promise<{ amount0: bigint; amount1: bigint }> {
    const result = await marketRepository.decreaseSpotLiquidity(
      this.canister_id, positionId, liquidityDelta,
    );

    if ('ok' in result) {
      pollingCoordinator.applyMutationVersions(this.canister_id, result.ok.versions);
      return { amount0: result.ok.amount0, amount1: result.ok.amount1 };
    }

    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.decreaseLiquidity', result.err);
    throw new Error(errorMessage);
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Fetch market depth with specified bucket size
   * @param bucketSizeBps - Bucket size in basis points (10 = 0.1%)
   * PUSHES last_trade_sqrt_price_x96 to entityStore (single source of truth for market price)
   */
  async fetchMarketDepth(bucketSizeBps: number = 10): Promise<void> {
    try {
      const result = await marketRepository.getSpotMarketDepth(
        this.canister_id,
        20, // 20 levels per side
        bucketSizeBps
      );

      if ('ok' in result) {
        this.marketDepth = result.ok;

        // Update local lastTradeSqrtPriceX96 from market depth response
        const newSqrtPrice = result.ok.last_trade_sqrt_price_x96;
        if (newSqrtPrice && newSqrtPrice !== this.lastTradeSqrtPriceX96) {
          this.lastTradeSqrtPriceX96 = newSqrtPrice;

          // Push to entityStore (single source of truth)
          entityStore.upsertMarket({
            canisterId: this.canister_id,
            lastTradeSqrtPriceX96: newSqrtPrice,
          });
        }
      }
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * @deprecated Use fetchMarketDepth instead
   */
  async fetchOrderBook(bucketSizeBps: number = 10): Promise<void> {
    return this.fetchMarketDepth(bucketSizeBps);
  }

  // ============================================
  // Price & Quote Methods
  // ============================================

  /**
   * Get current price from multiple sources
   */
  getCurrentPrice(): number {
    if (this.lastTradeTick !== null) {
      return utils.tickToPrice(this.lastTradeTick, this.baseTokenDecimals, this.quoteTokenDecimals);
    }

    if (this.lastTradeSqrtPriceX96 !== null) {
      return utils.sqrtPriceX96ToPrice(this.lastTradeSqrtPriceX96, this.baseTokenDecimals, this.quoteTokenDecimals);
    }

    return 0;
  }

  /**
   * Quote order - get execution preview with totals and price impact
   * Returns result directly to caller (components manage their own quote state)
   * @param slippageBps - Optional slippage tolerance in basis points (default 50 = 0.5%)
   * @returns QuoteResult with pool_swaps + book_order for pass-through to createOrders
   */
  async quoteOrder(
    side: Side,
    amountIn: Amount,
    limitTick: Tick,
    slippageBps?: number
  ): Promise<QuoteResult> {
    const result = await marketRepository.quoteSpotOrder(
      this.canister_id,
      side,
      amountIn,
      limitTick,
      slippageBps
    );

    if ('ok' in result) {
      return result.ok;
    }

    throw new Error(result.err);
  }

  // ============================================
  // Liquidity Operations (V3 AMM) - REPOSITORY INTEGRATION
  // ============================================

  /**
   * Quote liquidity for position
   * Uses client-side Uniswap V3 math utilities
   */

  /**
   * Estimate price impact
   */
  estimatePriceImpact(amountIn: bigint, zeroForOne: boolean): bigint {
    // TODO: Implement calculation
    return 0n;
  }

  // ============================================
  // Market Capabilities
  // ============================================

  /**
   * Get market capabilities for UI rendering
   */
  getCapabilities(): MarketCapabilities {
    return {
      supportsMarketOrders: true,
      supportsLimitOrders: true,
      supportsStopOrders: false,
      supportsTPSL: false,
      supportsLeverage: false,
      supportsShortSelling: false,
      hasOrderBook: true,
      supportsPartialFills: true,
      liquidityModel: 'concentrated_liquidity',
      hasPriceOracle: false,
      supportsPriceImpact: true,
      hasFundingRate: false,
      hasExpiration: false
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get position by ID
   */
  async getPosition(positionId: bigint): Promise<PositionView | null> {
    const result = await marketRepository.getSpotPosition(this.canister_id, positionId);
    return 'ok' in result ? result.ok : null;
  }

  /**
   * Get market depth (separated book + pool liquidity)
   */
  async getMarketDepth(levels: number = 20, tickBucketSize: number = 10): Promise<MarketDepthResponse> {
    const result = await marketRepository.getSpotMarketDepth(
      this.canister_id,
      levels,
      tickBucketSize
    );

    if ('ok' in result) {
      return result.ok;
    }

    // Format and log the error properly
    const errorMessage = formatResultError(result);
    logDetailedError('SpotMarket.getMarketDepth', result.err);
    throw new Error(errorMessage);
  }

  /**
   * @deprecated Use getMarketDepth instead
   */
  async getOrderBook(bucketSizeBps: number = 10): Promise<MarketDepthResponse> {
    return this.getMarketDepth(20, bucketSizeBps);
  }

  /**
   * Check if tick is valid
   */
  isValidTick(tick: number): boolean {
    return tick % this.tickSpacing === 0;
  }

  /**
   * Get nearest usable tick
   */
  getNearestUsableTick(tick: number): number {
    return Math.round(tick / this.tickSpacing) * this.tickSpacing;
  }

  /**
   * Format current price for display
   */
  formatPrice(decimals: number = 6): string {
    return this.spotPrice.toFixed(decimals);
  }

  /**
   * Format liquidity for display
   */
  formatLiquidity(decimals: number = 2): string {
    return utils.formatLiquidity(this.liquidity, decimals);
  }

  // ============================================
  // EntityStore Integration
  // ============================================

  /**
   * Push current market data to entityStore
   * Called after hydrateAll() and hydratePlatformData() to keep entityStore in sync
   *
   * IMPORTANT: This method updates volume, TVL, and spotCanisterId only.
   * priceUsd is NOT updated here - the indexer is the source of truth for USD prices.
   * This ensures market cap calculations are consistent across all views
   * (SpotChartHead, MarketSelection, Explore pages).
   */
  private pushPriceToEntityStore(): void {
    // Need tokens to know which token to update
    if (!this.tokens || !this.tokens[0]) {
      return;
    }

    const token0CanisterId = this.tokens[0].toString();
    const existing = entityStore.getToken(token0CanisterId);

    // Quote tokens (ckUSDT, ICP, ckUSDC): indexer is source of truth for TVL/volume.
    // A single spot market only has its own slice — pushing it would overwrite
    // the correct cross-market aggregate from the indexer.
    const isQuote = existing?.isQuoteToken === true;

    entityStore.upsertToken({
      canisterId: token0CanisterId,
      // NOTE: priceUsd intentionally NOT set here - indexer is source of truth
      priceChange24h: this.priceChange24h,
      ...(!isQuote && {
        volume24h: this.volume24hUsd,
        tvl: this.poolDepthBaseUsdE6 + this.poolDepthQuoteUsdE6,
      }),
      source: 'canister',
    });
  }

  /**
   * Persist current state to L2 cache (localStorage)
   * Enables instant UI on next page load with last known values
   */
  private persistStateToCache(): void {
    const token0 = this.tokens?.[0] ? entityStore.getToken(this.tokens[0].toString()) : null;
    const token1 = this.tokens?.[1] ? entityStore.getToken(this.tokens[1].toString()) : null;

    marketRepository.persistHydrateResult(
      this.canister_id,
      this.getQuoteTokenSymbol(),
      this.lastTradeTick,
      this.lastTradeSqrtPriceX96,
      this.liquidity,
      this.volume24hUsd,
      this.priceChange24h,
      token0 ? { canisterId: token0.canisterId, symbol: token0.symbol, decimals: token0.decimals } : undefined,
      token1 ? { canisterId: token1.canisterId, symbol: token1.symbol, decimals: token1.decimals } : undefined
    );
  }

  /**
   * Restore state from L2 cache for instant UI
   * Call this before hydrateAll() to show last known values immediately
   * Returns true if cache was found and applied
   */
  restoreFromCache(): boolean {
    const cached = marketRepository.getCachedState(this.canister_id, this.getQuoteTokenSymbol());

    if (!cached) {
      return false;
    }

    // Restore state from cache
    this.lastTradeTick = cached.lastTradeTick;
    this.lastTradeSqrtPriceX96 = cached.lastTradeSqrtPriceX96 !== null ? BigInt(cached.lastTradeSqrtPriceX96) : null;
    this.liquidity = BigInt(cached.liquidity);
    this.volume24hUsd = BigInt(cached.volume24h);
    this.initialized = this.liquidity > 0n;

    return true;
  }

  // ============================================
  // Chart & Platform Management
  // ============================================

  /**
   * Change chart interval and fetch new data
   * Uses get_chart endpoint (NOT full hydrate) for efficiency
   */
  async setChartInterval(interval: ChartInterval, limit: number = 300): Promise<void> {
    try {
      this.isTransitioningInterval = true;

      // Update interval immediately
      this.chartInterval = interval;

      // Clear existing chart data to prevent stale candles from old interval
      this.chartData = [];

      // Fetch new chart data using get_chart (NOT full hydrate)
      const result = await marketRepository.fetchChartData(
        this.canister_id,
        interval,
        limit
      );

      if ('ok' in result) {
        this.chartData = result.ok;
      }

      // Wait a tick for chart to update
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      throw error;
    } finally {
      this.isTransitioningInterval = false;
    }
  }

  /**
   * Manually refresh chart data
   * Uses get_chart endpoint for efficiency
   */
  async refreshChart(limit: number = 300): Promise<void> {
    const result = await marketRepository.fetchChartData(
      this.canister_id,
      this.chartInterval,
      limit
    );

    if ('ok' in result) {
      this.chartData = result.ok;
    }
  }

  /**
   * Manually refresh platform data
   */
  async refreshPlatform(): Promise<void> {
    await this.hydratePlatformData();
  }

  // ============================================
  // User Data Cleanup (Identity Change)
  // ============================================

  // ============================================
  // Accounting & Reconciliation
  // ============================================

  /**
   * Get complete balance sheet with reconciliation data
   * Implements the global invariant: ASSETS = LIABILITIES + EQUITY
   */
  async getBalanceSheet(): Promise<BalanceSheet> {
    return await marketRepository.getSpotBalanceSheet(this.canister_id);
  }

  // ============================================
  // Token Cache Operations (Deposit/Withdraw)
  // ============================================

  /**
   * Deposit tokens to cache for atomic order creation
   * Pre-deposits tokens so subsequent orders can skip ICRC transfer (fully atomic)
   *
   * @param token - #base or #quote - which token to deposit
   * @param amount - Amount to deposit (must exceed protocol fee)
   * @returns Object with credited amount and new balance
   * @throws Error if deposit fails
   */
  async deposit(
    token: ClaimTokenId,
    amount: bigint
  ): Promise<{ credited: bigint; newBalance: bigint; blockIndex: bigint }> {
    const result = await marketRepository.deposit(
      this.canister_id,
      token,
      amount
    );

    if ('ok' in result) {
      const depositResult = result.ok;
      if ('ok' in depositResult) {
        const success = depositResult.ok;
        // Refresh user data from backend to update entityStore
        // This ensures entityStore has the latest balance
        this.hydrateUserDataOnly().catch(() => {});
        return {
          credited: success.credited,
          newBalance: success.new_balance,
          blockIndex: success.block_index,
        };
      }
      // Inner error
      const errorMessage = formatResultError(depositResult);
      logDetailedError('SpotMarket.deposit', depositResult.err);
      throw new Error(errorMessage);
    }

    // Outer error (repository-level error)
    const outerError = typeof result.err === 'string' ? result.err : formatApiError(result.err);
    throw new Error(outerError);
  }

  /**
   * Withdraw tokens from cache
   * Deducts from cache BEFORE async transfer (prevents race conditions)
   * On transfer failure, tokens are credited back to cache (no claims needed)
   *
   * @param token - #base or #quote - which token to withdraw
   * @param amount - Amount to withdraw (must exceed ledger fee)
   * @returns Object with withdrawn amount, remaining balance, and optional block index
   * @throws Error if withdraw fails
   */
  async withdraw(
    token: ClaimTokenId,
    amount: bigint
  ): Promise<{ withdrawn: bigint; remaining: bigint; blockIndex?: bigint }> {
    const result = await marketRepository.withdraw(
      this.canister_id,
      token,
      amount
    );

    if ('ok' in result) {
      const withdrawResult = result.ok;
      if ('ok' in withdrawResult) {
        const success = withdrawResult.ok;
        // Refresh user data from backend to update entityStore
        // This ensures entityStore has the latest balance
        this.hydrateUserDataOnly().catch(() => {});
        return {
          withdrawn: success.withdrawn,
          remaining: success.remaining,
          blockIndex: success.block_index.length > 0 ? success.block_index[0] : undefined,
        };
      }
      // Inner error
      const errorMessage = formatResultError(withdrawResult);
      logDetailedError('SpotMarket.withdraw', withdrawResult.err);
      throw new Error(errorMessage);
    }

    // Outer error (repository-level error)
    const outerError = typeof result.err === 'string' ? result.err : formatApiError(result.err);
    throw new Error(outerError);
  }

  // ============================================
  // User Data Management
  // ============================================

  /**
   * Push user data to entityStore (single source of truth)
   * Called by hydrateAll and hydrateUserDataOnly
   */
  private pushUserDataToEntityStore(userData: {
    orders: OrderView[];
    triggers: TriggerView[];
    positions: PositionViewEnhanced[];
    available: { base: bigint; quote: bigint };
    locked: {
      orders: { base: bigint; quote: bigint };
      triggers: { base: bigint; quote: bigint };
      positions: { base: bigint; quote: bigint };
    };
    fees: { base: bigint; quote: bigint };
  }): void {
    // Compute position aggregates
    // apr_bps is in basis points (bigint), convert to percentage for weighted average
    let totalTvl = 0n;
    let totalFees = 0n;
    let weightedAprBpsNumerator = 0n;
    for (const pos of userData.positions) {
      totalTvl += pos.usd_value_e6;
      totalFees += pos.fees_usd_value_e6;
      weightedAprBpsNumerator += pos.apr_bps * pos.usd_value_e6;
    }

    entityStore.upsertUserMarketData({
      spotCanisterId: this.canister_id,
      orders: userData.orders,
      triggers: userData.triggers,
      positions: userData.positions,
      available: userData.available,
      locked: userData.locked,
      fees: userData.fees,
      totalPositionsTvlE6: totalTvl,
      totalPositionsFeesE6: totalFees,
      // Convert weighted apr_bps to percentage
      weightedAvgApy: totalTvl > 0n ? utils.bpsToPercent(weightedAprBpsNumerator / totalTvl) : 0,
    });
  }

  /**
   * Clear all user-specific data
   * Called on identity change (logout/login/switch)
   * Market data (tick, liquidity, orderbook) is preserved
   */
  clearUserData(): void {
    // Clear user data from entityStore (single source of truth)
    entityStore.clearUserMarketData(this.canister_id);

    // Clear local history state (not in entityStore - paginated data)
    this.userOrderHistory = [];
    this.userOrderHistoryCursor = null;
    this.userOrderHistoryHasMore = true;

    this.userTriggerHistory = [];
    this.userTriggerHistoryCursor = null;
    this.userTriggerHistoryHasMore = true;

    // Clear current user principal
    this.currentUserPrincipal = null;
  }

  /**
   * Update user principal stored on this market instance
   * Called on identity change — coordinator handles polling and data fetching
   */
  updateUserPrincipal(principal: Principal | null): void {
    this.currentUserPrincipal = principal;
  }
}
