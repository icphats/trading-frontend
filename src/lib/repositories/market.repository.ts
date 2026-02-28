/**
 * Market Repository
 *
 * Data access layer for Spot markets
 * - Manages actor creation and caching
 * - Wraps canister calls with error handling
 * - Provides hybrid caching (memory + IndexedDB)
 * - Transforms raw canister responses into domain types
 */

import type { Principal } from '@dfinity/principal';
import type { Amount } from '$lib/actors/services/spot.service';
import { idlFactory as spotIDL } from 'declarations/spot/spot.did.js';
import {
  MemoryCache,
  HybridCache,
  createCache,
  actorRegistry,
  getCachedMarketState,
  setCachedMarketState,
  pruneExpiredMarketStates,
  type CachedMarketState,
} from './cache';
import { type Result } from './shared/result';
import { cacheCleanupManager } from './shared/cleanup';
import type { _SERVICE as SpotService } from 'declarations/spot/spot.did';
import type {
  HydrateResponse as SpotHydrateResponse,
  PlatformData as SpotPlatformData,
  ChartInterval as SpotChartInterval,
  Side as SpotSide,
  Tick,
  OrderId,
  CancelOrdersResult,
  UpdateOrderResult,
  CreateOrdersResult,
  BookOrderSpec,
  PoolSwapSpec,
  CreateTriggersResult,
  CancelTriggersResult,
  TriggerSpec,
  TriggerId,
  LiquidityResult,
  IncreaseLiquidityResult,
  DecreaseLiquidityResult,
  PositionId,
  PositionView,
  MarketDepthResponse,
  CollectFeesResult,
  LockPositionResult,
  TransferPositionResult,

  SpotTransactionResponse,
  QuoteResult,
  ApiError,
  BalanceSheet,
  ClaimTokenId,
  PassThroughTradeArgs,
  PassThroughTradeResult,
  DepositResult,
  WithdrawResult,
  PoolState,
  PoolSnapshotsResponse,
  GetUserActivityResult,
  ChainCursor,
} from 'declarations/spot/spot.did';

// Re-export for consumers
export type { Result } from './shared/result';

// Market-specific result type with ApiError support
export type MarketResult<T> = Result<T, ApiError | string>;

// ============================================
// Market Repository Class
// ============================================

export class MarketRepository {
  // Data caches (typed by data category)
  private platformCache: MemoryCache<SpotPlatformData>;
  private configCache: HybridCache<any>;

  constructor() {
    // Initialize caches with presets
    this.platformCache = createCache<SpotPlatformData>('PLATFORM') as MemoryCache<SpotPlatformData>;
    this.configCache = createCache<any>('CONFIG') as HybridCache<any>;
  }

  // ============================================
  // Actor Management (Internal)
  // ============================================

  private getSpotActor(canisterId: string): SpotService {
    return actorRegistry.getCache<SpotService>('spot', spotIDL).get(canisterId);
  }

  // ============================================
  // Polling (Version-Based Conditional Fetching)
  // ============================================

  /**
   * Poll version counters (ONLY polling endpoint - called every ~500ms)
   * Returns lightweight version numbers to determine what needs updating
   */
  async fetchPollVersions(
    canisterId: string
  ): Promise<Result<import('../../../../declarations/spot/spot.did').PollVersions>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_versions();
      return { ok: result };
    } catch (error) {
      return { err: error instanceof Error ? error.message : 'Failed to poll versions' };
    }
  }

  // ============================================
  // Spot Market Data Fetching
  // ============================================

  /**
   * Hydrate all spot market data in a single call
   */
  async fetchSpotMarketData(
    canisterId: string,
    interval: SpotChartInterval = { hour1: null },
    chartLimit: number = 1440,
    bucketSizeTicks: number = 10
  ): Promise<Result<SpotHydrateResponse>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_hydration(interval, chartLimit, 20, bucketSizeTicks);

      if (!result.chart || !Array.isArray(result.chart.data)) {
        console.error(`[MarketRepository] VALIDATION FAILED - Invalid chart data structure:`, {
          chartExists: !!result.chart,
          chartDataIsArray: Array.isArray(result.chart?.data),
          chartType: typeof result.chart,
          chart: result.chart
        });
        return { err: 'Invalid chart data structure received from canister' };
      }

      if (result.chart.data.length === 0) {
        console.warn(`[MarketRepository] Empty chart array received from canister ${canisterId}`);
      }

      this.platformCache.set(`${canisterId}:platform`, result.platform as SpotPlatformData, 60_000);

      return { ok: result };
    } catch (error) {
      console.error(`[MarketRepository] FAILED to fetch spot market data:`, {
        canisterId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return { err: error instanceof Error ? error.message : 'Failed to fetch market data' };
    }
  }

  /**
   * Fetch spot platform data
   */
  async fetchSpotPlatformData(
    canisterId: string,
    interval: SpotChartInterval = { hour1: null },
    useCache: boolean = true,
    bucketSizeTicks: number = 10
  ): Promise<Result<SpotPlatformData>> {
    const cacheKey = `${canisterId}:platform`;

    if (useCache) {
      const cached = this.platformCache.get(cacheKey);
      if (cached) {
        return { ok: cached as SpotPlatformData };
      }
    }

    try {
      const actor = this.getSpotActor(canisterId);
      const platformData = await actor.get_platform(interval, 20, bucketSizeTicks);

      this.platformCache.set(cacheKey, platformData as SpotPlatformData, 60_000);
      return { ok: platformData as SpotPlatformData };
    } catch (error) {
      console.error(`[MarketRepository] Failed to fetch spot platform data:`, {
        canisterId,
        error: error instanceof Error ? error.message : String(error)
      });
      return { err: error instanceof Error ? error.message : 'Failed to fetch platform data' };
    }
  }

  /**
   * Fetch chart data only (conditional fetch when candle_version changes)
   */
  async fetchChartData(
    canisterId: string,
    interval: SpotChartInterval = { hour1: null },
    limit: number = 300,
    beforeTs?: bigint
  ): Promise<Result<import('../../../../declarations/spot/spot.did').SpotCandle[]>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const beforeTsOpt: [] | [bigint] = beforeTs !== undefined ? [beforeTs] : [];
      const result = await actor.get_chart(interval, beforeTsOpt, limit);
      return { ok: result.data };
    } catch (error) {
      return { err: error instanceof Error ? error.message : 'Failed to fetch chart data' };
    }
  }

  /**
   * Fetch user data only (conditional fetch when user_version changes)
   */
  async fetchUserData(
    canisterId: string
  ): Promise<Result<import('../../../../declarations/spot/spot.did').UserData>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_user();
      return { ok: result };
    } catch (error) {
      return { err: error instanceof Error ? error.message : 'Failed to fetch user data' };
    }
  }

  /**
   * Fetch spot indexer data (comprehensive market metrics)
   */
  async fetchSpotIndexerData(canisterId: string, useCache: boolean = true): Promise<Result<any>> {
    const cacheKey = `${canisterId}:indexer`;

    if (useCache) {
      const cached = this.platformCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_indexer_data();

      this.platformCache.set(cacheKey, result as any, 60_000);
      return { ok: result };
    } catch (error) {
      console.error(`Failed to fetch spot indexer data for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch indexer data' };
    }
  }

  // ============================================
  // Spot Trading Operations (CLOB)
  // ============================================

  /**
   * Unified order creation: optional cancels + book orders + pool swaps
   */
  async createSpotOrders(
    canisterId: string,
    cancelIds: OrderId[],
    bookOrders: BookOrderSpec[],
    poolSwaps: PoolSwapSpec[]
  ): Promise<CreateOrdersResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.create_orders(cancelIds, bookOrders, poolSwaps);
  }

  /**
   * Execute pass-through trade (wallet-to-wallet swap)
   */
  async executePassThroughTrade(
    canisterId: string,
    args: PassThroughTradeArgs
  ): Promise<PassThroughTradeResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.pass_through_trade(args);
  }

  /**
   * Cancel spot order
   */
  async cancelSpotOrder(
    canisterId: string,
    orderId: OrderId
  ): Promise<CancelOrdersResult | { err: string }> {
    try {
      const actor = this.getSpotActor(canisterId);
      return await actor.cancel_orders([orderId]);
    } catch (error) {
      console.error(`[marketRepository.cancelSpotOrder] Failed to cancel spot order for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to cancel order' };
    }
  }

  /**
   * @deprecated Use cancelSpotOrder instead
   */
  async cancelSpotLimitOrder(
    canisterId: string,
    orderId: OrderId
  ): Promise<CancelOrdersResult | { err: string }> {
    return this.cancelSpotOrder(canisterId, orderId);
  }

  /**
   * Update (modify) spot order atomically
   */
  async updateSpotOrder(
    canisterId: string,
    orderId: OrderId,
    newTick: Tick,
    newInputAmount: Amount
  ): Promise<UpdateOrderResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.update_order(orderId, newTick, newInputAmount);
  }

  /**
   * @deprecated Use updateSpotOrder instead
   */
  async updateSpotLimitOrder(
    canisterId: string,
    orderId: OrderId,
    newTick: Tick,
    newInputAmount: Amount,
    _dedupKey?: bigint
  ): Promise<UpdateOrderResult> {
    return this.updateSpotOrder(canisterId, orderId, newTick, newInputAmount);
  }

  // ============================================
  // Spot Liquidity Operations (V3 AMM)
  // ============================================

  /**
   * Add liquidity to spot pool
   */
  async addSpotLiquidity(
    canisterId: string,
    feePips: number,
    tickLower: Tick,
    tickUpper: Tick,
    amountBaseDesired: bigint,
    amountQuoteDesired: bigint,
    initialTick?: Tick,
    lockUntilMs?: bigint
  ): Promise<LiquidityResult> {
    const actor = this.getSpotActor(canisterId);
    const initialTickOpt: [] | [Tick] = initialTick !== undefined ? [initialTick] : [];
    const lockUntilMsOpt: [] | [bigint] = lockUntilMs !== undefined ? [lockUntilMs] : [];

    return await actor.add_liquidity(
      feePips,
      tickLower,
      tickUpper,
      amountBaseDesired,
      amountQuoteDesired,
      initialTickOpt,
      lockUntilMsOpt
    );
  }

  /**
   * Lock a position until a given timestamp
   */
  async lockSpotPosition(
    canisterId: string,
    positionId: PositionId,
    lockUntilMs: bigint
  ): Promise<LockPositionResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.lock_position(positionId, lockUntilMs);
  }

  /**
   * Transfer position to a new owner
   */
  async transferSpotPosition(
    canisterId: string,
    positionId: PositionId,
    recipient: Principal,
  ): Promise<TransferPositionResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.transfer_position(positionId, recipient);
  }

  /**
   * Increase liquidity in existing position
   */
  async increaseSpotLiquidity(
    canisterId: string,
    positionId: PositionId,
    amountBaseDesired: bigint,
    amountQuoteDesired: bigint
  ): Promise<IncreaseLiquidityResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.increase_liquidity(
      positionId,
      amountBaseDesired,
      amountQuoteDesired
    );
  }

  /**
   * Decrease liquidity from position
   */
  async decreaseSpotLiquidity(
    canisterId: string,
    positionId: PositionId,
    liquidityDelta: bigint
  ): Promise<DecreaseLiquidityResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.decrease_liquidity(positionId, liquidityDelta);
  }

  /**
   * Collect fees from position
   */
  async collectSpotFees(
    canisterId: string,
    positionId: PositionId
  ): Promise<CollectFeesResult> {
    const actor = this.getSpotActor(canisterId);
    return await actor.collect_fees(positionId);
  }

  /**
   * Get market depth (separated book + pool liquidity)
   */
  async getSpotMarketDepth(
    canisterId: string,
    levels: number = 20,
    tickBucketSize: number = 10
  ): Promise<Result<MarketDepthResponse>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_market_depth(levels, tickBucketSize);
      return { ok: result };
    } catch (error) {
      console.error(`Failed to get market depth for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to get market depth' };
    }
  }

  /**
   * Fetch all pool overviews for a spot market
   */
  async fetchPoolsOverview(
    canisterId: string
  ): Promise<Result<import('../../../../declarations/spot/spot.did').PoolOverview[]>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_pools_overview();
      return { ok: result };
    } catch (error) {
      console.error(`Failed to fetch pools overview for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch pools overview' };
    }
  }

  /**
   * Fetch market snapshots (TVL time series)
   */
  async fetchMarketSnapshots(
    canisterId: string,
    beforeTimestamp?: bigint,
    limit: number = 100,
    intervalHours: number = 1
  ): Promise<Result<import('../../../../declarations/spot/spot.did').MarketSnapshotsResponse>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const beforeOpt: [] | [bigint] = beforeTimestamp !== undefined ? [beforeTimestamp] : [];
      const result = await actor.get_market_snapshots(beforeOpt, limit, intervalHours);
      return { ok: result };
    } catch (error) {
      console.error(`Failed to fetch market snapshots for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch market snapshots' };
    }
  }

  /**
   * @deprecated Use getSpotMarketDepth instead
   */
  async getSpotUnifiedOrderBook(
    canisterId: string,
    bucketSizeTicks: number = 10
  ): Promise<Result<MarketDepthResponse>> {
    return this.getSpotMarketDepth(canisterId, 20, bucketSizeTicks);
  }

  /**
   * Get position details
   */
  async getSpotPosition(
    canisterId: string,
    positionId: PositionId
  ): Promise<Result<PositionView | null>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_position(positionId);
      const position = result.length > 0 && result[0] !== undefined ? result[0] : null;
      return { ok: position };
    } catch (error) {
      console.error(`Failed to get spot position for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to get position' };
    }
  }

  /**
   * Fetch pool state from spot canister
   */
  async fetchPoolState(
    canisterId: string,
    feePips: number
  ): Promise<Result<PoolState | null>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_pool(feePips);
      const pool = result.length > 0 && result[0] !== undefined ? result[0] : null;
      return { ok: pool };
    } catch (error) {
      console.error(`Failed to fetch pool state for ${canisterId} (fee=${feePips}):`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch pool state' };
    }
  }

  /**
   * Fetch historical fee snapshots for a pool
   */
  async fetchPoolSnapshots(
    canisterId: string,
    feePips: number,
    intervalHours: number = 1,
    limit: number = 100,
    beforeTimestamp?: bigint
  ): Promise<Result<PoolSnapshotsResponse>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const beforeOpt: [] | [bigint] = beforeTimestamp !== undefined ? [beforeTimestamp] : [];
      const result = await actor.get_pool_snapshots(feePips, beforeOpt, limit, intervalHours);
      return { ok: result };
    } catch (error) {
      console.error(`Failed to fetch pool snapshots for ${canisterId} (fee=${feePips}):`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch pool snapshots' };
    }
  }

  /**
   * Fetch spot transactions with cursor-based pagination
   */
  async fetchSpotTransactions(
    canisterId: string,
    cursor?: bigint,
    limit?: number
  ): Promise<Result<{ data: SpotTransactionResponse[]; next_cursor: [] | [bigint]; has_more: boolean }>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.get_transactions(
        limit !== undefined ? [limit] : [],
        cursor !== undefined ? [cursor] : []
      );
      return { ok: result };
    } catch (error) {
      return { err: error instanceof Error ? error.message : 'Failed to fetch transactions' };
    }
  }

  /**
   * Fetch user activity history (unified feed)
   */
  async fetchUserActivity(
    canisterId: string,
    cursor?: ChainCursor,
    limit: number = 20
  ): Promise<Result<GetUserActivityResult>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const cursorOpt: [] | [ChainCursor] = cursor !== undefined ? [cursor] : [];
      const limitOpt: [] | [number] = [limit];
      const result = await actor.get_user_activity(cursorOpt, limitOpt);
      return { ok: result };
    } catch (error) {
      console.error(`Failed to fetch user activity for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch user activity' };
    }
  }

  // ============================================
  // Quote Operations
  // ============================================

  /**
   * Quote an order - get execution preview with totals and price impact
   */
  async quoteSpotOrder(
    canisterId: string,
    side: SpotSide,
    inputAmount: Amount,
    limitTick: Tick,
    slippageBps?: number
  ): Promise<Result<QuoteResult>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const slippageOpt: [] | [number] = slippageBps !== undefined ? [slippageBps] : [];
      const result = await actor.quote_order(side, inputAmount, limitTick, slippageOpt);

      if ('ok' in result) {
        return { ok: result.ok };
      }

      const err = result.err;
      return { err: `Quote failed: [${err.code}] ${err.message}` };
    } catch (error) {
      console.error(`Failed to quote order for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to quote order' };
    }
  }

  // ============================================
  // Trigger Operations (Stop-Loss / Take-Profit)
  // ============================================

  /**
   * Create trigger orders
   */
  async createSpotTriggers(
    canisterId: string,
    cancelIds: TriggerId[],
    specs: TriggerSpec[]
  ): Promise<Result<CreateTriggersResult>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.create_triggers(cancelIds, specs);
      return { ok: result };
    } catch (error) {
      console.error(`Failed to create triggers for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to create triggers' };
    }
  }

  /**
   * Cancel a trigger order by ID
   */
  async cancelSpotTrigger(
    canisterId: string,
    triggerId: TriggerId
  ): Promise<Result<CancelTriggersResult>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.cancel_triggers([triggerId]);
      return { ok: result };
    } catch (error) {
      console.error(`Failed to cancel trigger for ${canisterId}:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to cancel trigger' };
    }
  }

  // ============================================
  // Cache Management
  // ============================================

  invalidateMarket(canisterId: string): void {
    this.platformCache.invalidatePrefix(`${canisterId}:`);
    this.configCache.invalidatePrefix(`${canisterId}:`);
  }

  clearAllCaches(): void {
    this.platformCache.clear();
    this.configCache.clear();
  }

  pruneExpiredCaches(): void {
    this.platformCache.prune();
    this.configCache.prune();
  }

  getCacheStats() {
    return {
      platform: this.platformCache.getStats()
    };
  }

  // ============================================
  // Market State Persistence (L2 localStorage)
  // ============================================

  getCachedState(
    canisterId: string,
    quoteTokenSymbol: 'icp' | 'usdc' | 'usdt' = 'icp'
  ): CachedMarketState | null {
    return getCachedMarketState(canisterId, quoteTokenSymbol);
  }

  persistMarketState(state: CachedMarketState): void {
    setCachedMarketState(state);
  }

  persistHydrateResult(
    canisterId: string,
    quoteTokenSymbol: 'icp' | 'usdc' | 'usdt',
    lastTradeTick: number | null,
    lastTradeSqrtPriceX96: bigint | null,
    liquidity: bigint,
    volume24h: bigint,
    priceChange24h: number,
    base?: { canisterId: string; symbol: string; decimals: number },
    quote?: { canisterId: string; symbol: string; decimals: number }
  ): void {
    this.persistMarketState({
      canisterId,
      quoteTokenSymbol,
      lastTradeTick,
      lastTradeSqrtPriceX96: lastTradeSqrtPriceX96?.toString() ?? null,
      liquidity: liquidity.toString(),
      volume24h: volume24h.toString(),
      priceChange24h,
      base: base ?? null,
      quote: quote ?? null,
      updatedAt: Date.now(),
    });
  }

  // ============================================
  // Accounting & Reconciliation
  // ============================================

  async getSpotBalanceSheet(canisterId: string): Promise<BalanceSheet> {
    const actor = this.getSpotActor(canisterId);
    return await actor.get_balance_sheet();
  }

  // ============================================
  // Token Cache Operations (Deposit/Withdraw)
  // ============================================

  async deposit(
    canisterId: string,
    token: ClaimTokenId,
    amount: bigint
  ): Promise<MarketResult<DepositResult>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.deposit(token, amount);
      return { ok: result };
    } catch (error) {
      return { err: error instanceof Error ? error.message : 'Failed to deposit' };
    }
  }

  async withdraw(
    canisterId: string,
    token: ClaimTokenId,
    amount: bigint
  ): Promise<MarketResult<WithdrawResult>> {
    try {
      const actor = this.getSpotActor(canisterId);
      const result = await actor.withdraw(token, amount);
      return { ok: result };
    } catch (error) {
      return { err: error instanceof Error ? error.message : 'Failed to withdraw' };
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const marketRepository = new MarketRepository();

// Register with centralized cleanup manager
cacheCleanupManager.register(() => {
  marketRepository.pruneExpiredCaches();
  pruneExpiredMarketStates();
});
