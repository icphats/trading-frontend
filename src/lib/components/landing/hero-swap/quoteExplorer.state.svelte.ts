/**
 * Quote Explorer State Management
 *
 * Read-only quote explorer for the landing page hero section.
 * Showcases the multi-venue (CLOB+AMM) quoting system without swap execution.
 *
 * Fast path: Uses an anonymous agent for all read-only canister calls
 * (diagnostics, orderbook, quotes) so the widget renders without waiting
 * for user authentication. Swap execution still uses the authenticated path.
 *
 * Features:
 * - Market list fetching and switching
 * - Debounced quote calculation with request sequencing
 * - Orderbook fetching with legacy format transformation
 * - Side toggling (buy/sell)
 */

import { Actor } from '@icp-sdk/core/agent';
import { AnonymousIdentity } from '@icp-sdk/core/agent';
import { createAgent } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';
import { idlFactory as spotIDL } from 'declarations/spot/spot.did.js';
import type { _SERVICE as SpotService } from 'declarations/spot/spot.did';
import { marketRepository } from '$lib/repositories/market.repository';
import { indexerRepository } from '$lib/repositories/indexer.repository';
import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
import { SpotMarket } from '$lib/domain/markets/state/spot-market.svelte';
import {
  transformMarketDepthToLegacy,
  type UnifiedOrderBookResponse,
} from '$lib/components/trade/shared/orderbook.utils';
import { stringToBigInt, sqrtPriceX96ToTick } from '$lib/domain/markets/utils';
import { canisterIds, HOST, IS_LOCAL } from '$lib/constants/app.constants';
import { tokenRepository } from '$lib/repositories/token.repository';
import type { NormalizedToken } from '$lib/types/entity.types';
import type { QuoteResult, Side, PassThroughTradeArgs, PassThroughTradeSuccess } from '$lib/actors/services/spot.service';
import type { MarketListItem } from '$lib/actors/services/indexer.service';
import type { TokenDefinition } from '$lib/domain/tokens';

// ============================================
// Constants
// ============================================

/** Quote freshness window - quotes older than this should be refreshed */
const QUOTE_TTL_MS = 15_000;

/** Proactive refresh threshold - refresh quote before it expires */
const QUOTE_REFRESH_MS = 7_500;

/** Input debounce delay - wait for user to stop typing */
const DEBOUNCE_MS = 500;

/** Default market canister ID */
const DEFAULT_MARKET_CANISTER_ID = '';

// ============================================
// Token Registration Helper
// ============================================

async function ensureTokenRegistered(ledgerPrincipal: Principal): Promise<void> {
  const canisterId = ledgerPrincipal.toString();
  if (entityStore.getToken(canisterId)) return;

  const result = await tokenRepository.discoverToken(canisterId);
  if ('ok' in result) {
    entityStore.upsertToken({
      canisterId,
      symbol: result.ok.symbol,
      name: result.ok.name,
      decimals: result.ok.decimals,
      logo: result.ok.logo ?? null,
      fee: result.ok.fee,
    });
  } else {
    entityStore.upsertToken({
      canisterId,
      symbol: 'TOKEN',
      name: 'Unknown Token',
      decimals: 8,
    });
  }
}

// ============================================
// Types
// ============================================

export type SwapSide = 'buy' | 'sell';

// ============================================
// Quote Explorer State Class
// ============================================

class QuoteExplorerStateManager {
  // ============================================
  // Market State
  // ============================================

  market = $state<SpotMarket | null>(null);
  isMarketLoading = $state<boolean>(false);
  marketError = $state<string | null>(null);

  // ============================================
  // Market List State
  // ============================================

  marketList = $state<MarketListItem[]>([]);

  // ============================================
  // Token State (derived from market + entityStore)
  // ============================================

  baseToken = $derived.by((): NormalizedToken | null => {
    if (!this.market?.tokens?.[0]) return null;
    return entityStore.getToken(this.market.tokens[0].toString()) ?? null;
  });

  quoteToken = $derived.by((): NormalizedToken | null => {
    if (!this.market?.tokens?.[1]) return null;
    return entityStore.getToken(this.market.tokens[1].toString()) ?? null;
  });

  // ============================================
  // Input State
  // ============================================

  inputAmount = $state<string>('');
  side = $state<SwapSide>('buy');

  // ============================================
  // Quote State
  // ============================================

  quote = $state<QuoteResult | null>(null);
  quoteTimestamp = $state<number>(0);
  isQuoting = $state<boolean>(false);
  quoteError = $state<string | null>(null);
  private requestGeneration = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ============================================
  // Orderbook State
  // ============================================

  orderbook = $state<UnifiedOrderBookResponse | null>(null);

  // ============================================
  // Anonymous Agent Infrastructure
  // ============================================

  private anonAgent: Awaited<ReturnType<typeof createAgent>> | null = null;
  private anonSpotActors = new Map<string, SpotService>();
  private anonInitPromise: Promise<void> | null = null;

  /** Create anonymous agent (idempotent) */
  private async initAnon(): Promise<void> {
    if (this.anonAgent) return;
    if (this.anonInitPromise) return this.anonInitPromise;

    this.anonInitPromise = (async () => {
      const agent = await createAgent({
        identity: new AnonymousIdentity(),
        host: HOST,
      });
      if (IS_LOCAL) {
        await agent.fetchRootKey();
      }
      this.anonAgent = agent;
    })();

    return this.anonInitPromise;
  }

  /** Get or create an anonymous spot actor for a canister */
  private getAnonSpotActor(canisterId: string): SpotService {
    let actor = this.anonSpotActors.get(canisterId);
    if (!actor) {
      if (!this.anonAgent) throw new Error('Anon agent not initialized');
      actor = Actor.createActor<SpotService>(spotIDL as any, {
        agent: this.anonAgent,
        canisterId,
      });
      this.anonSpotActors.set(canisterId, actor);
    }
    return actor;
  }

  // ============================================
  // Derived State
  // ============================================

  inputToken = $derived.by((): NormalizedToken | null => {
    return this.side === 'buy' ? this.quoteToken : this.baseToken;
  });

  outputToken = $derived.by((): NormalizedToken | null => {
    return this.side === 'buy' ? this.baseToken : this.quoteToken;
  });

  inputDecimals = $derived.by((): number => {
    return this.inputToken?.decimals ?? 8;
  });

  outputDecimals = $derived.by((): number => {
    return this.outputToken?.decimals ?? 8;
  });

  isQuoteFresh = $derived.by((): boolean => {
    return this.quoteTimestamp > 0 && (Date.now() - this.quoteTimestamp) < QUOTE_TTL_MS;
  });

  needsProactiveRefresh = $derived.by((): boolean => {
    return this.quoteTimestamp > 0 && (Date.now() - this.quoteTimestamp) > QUOTE_REFRESH_MS;
  });

  currentPrice = $derived.by((): number => {
    return this.market?.spotPrice ?? 0;
  });

  // ============================================
  // Initialization
  // ============================================

  async initializeMarket(canisterId?: string): Promise<void> {
    this.isMarketLoading = true;
    this.marketError = null;

    try {
      // Initialize anonymous agent (fast, idempotent)
      await this.initAnon();

      let targetCanisterId: string | null = canisterId ?? null;

      if (!targetCanisterId) {
        targetCanisterId = await this.getDefaultMarketCanisterId();
      }

      if (!targetCanisterId) {
        throw new Error('No markets available');
      }

      // Resolve token principals from the market list (already fetched by indexer)
      const marketItem = this.marketList.find(
        m => m.canister_id.toString() === targetCanisterId
      );
      if (!marketItem) {
        throw new Error(`Market ${targetCanisterId} not found in market list`);
      }

      const anonActor = this.getAnonSpotActor(targetCanisterId);

      // Single canister query — only need orderbook depth (includes price)
      const depth = await anonActor.get_market_depth(20, 10);

      // Create SpotMarket instance — tokens from indexer, price from depth
      const market = new SpotMarket(targetCanisterId, '', '');
      market.tokens = [marketItem.base_token, marketItem.quote_token];
      market.lastTradeSqrtPriceX96 = depth.last_trade_sqrt_price_x96;
      market.lastTradeTick = market.lastTradeSqrtPriceX96 > 0n ? sqrtPriceX96ToTick(market.lastTradeSqrtPriceX96) : 0;
      market.liquidity = depth.pools.reduce((sum, p) => sum + p.liquidity, 0n);
      market.marketDepth = depth;

      // Register tokens in entityStore (needed for UI display)
      await Promise.all([
        ensureTokenRegistered(marketItem.base_token),
        ensureTokenRegistered(marketItem.quote_token),
      ]);

      this.market = market;

      // Transform orderbook directly from depth response (no separate refreshOrderbook call)
      this.orderbook = transformMarketDepthToLegacy(depth, market.baseTokenDecimals, market.quoteTokenDecimals);

      this.autoPopulateInput();
    } catch (error) {
      console.error('[QuoteExplorerState] Failed to initialize market:', error);
      this.marketError = error instanceof Error ? error.message : 'Failed to load market';
    } finally {
      this.isMarketLoading = false;
    }
  }

  private async getDefaultMarketCanisterId(): Promise<string | null> {
    if (DEFAULT_MARKET_CANISTER_ID) {
      return DEFAULT_MARKET_CANISTER_ID;
    }

    // Fetch markets list and look up PARTY/ICP pair in parallel
    const partyLedger = canisterIds.icrc_ledger;
    const icpLedger = canisterIds.icp_ledger;

    const [, pairResult] = await Promise.all([
      this.fetchMarkets(),
      (partyLedger && icpLedger)
        ? indexerRepository.getMarketByPair(partyLedger, icpLedger)
        : Promise.resolve(null),
    ]);

    if (pairResult && 'ok' in pairResult && pairResult.ok) {
      return pairResult.ok;
    }

    // Fall back to first market from list
    if (this.marketList.length > 0) {
      return this.marketList[0].canister_id.toString();
    }

    return null;
  }

  // ============================================
  // Market List Management
  // ============================================

  async fetchMarkets(): Promise<void> {
    try {
      const result = await indexerRepository.getMarkets(20n);
      if ('ok' in result) {
        this.marketList = result.ok.data;
      }
    } catch (error) {
      console.error('[QuoteExplorerState] Failed to fetch markets:', error);
    }
  }

  async switchMarket(canisterId: string): Promise<void> {
    // Clear current quote state
    this.quote = null;
    this.quoteTimestamp = 0;
    this.quoteError = null;
    this.inputAmount = '';

    await this.initializeMarket(canisterId);
  }

  // ============================================
  // Auto-populate
  // ============================================

  autoPopulateInput(): void {
    const inputToken = this.inputToken;
    if (!inputToken) return;

    const TARGET_USD = 100;
    const priceUsd = inputToken.priceUsd;

    if (priceUsd && priceUsd > 0n) {
      const priceNum = Number(priceUsd) / 1e12;
      const amount = TARGET_USD / priceNum;
      const decimals = Math.min(inputToken.decimals, 4);
      this.inputAmount = amount.toFixed(decimals);
    } else {
      this.inputAmount = '100';
    }

    this.scheduleQuoteCalculation();
  }

  // ============================================
  // Input Management
  // ============================================

  setInputAmount(value: string): void {
    this.inputAmount = value;
    this.scheduleQuoteCalculation();
  }

  setSide(newSide: SwapSide): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.side = newSide;
    this.quote = null;
    this.quoteTimestamp = 0;
    this.quoteError = null;
    this.isQuoting = false;

    // Re-auto-populate for the new input token and re-quote
    this.autoPopulateInput();
  }

  // ============================================
  // Quote Calculation
  // ============================================

  private scheduleQuoteCalculation(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.isQuoting = true;

    this.debounceTimer = setTimeout(() => {
      this.calculateQuote();
    }, DEBOUNCE_MS);
  }

  async calculateQuote(): Promise<void> {
    const market = this.market;
    const inputToken = this.inputToken;
    const inputAmount = this.inputAmount;

    if (!market || !inputToken) {
      this.quote = null;
      this.quoteTimestamp = 0;
      this.quoteError = null;
      this.isQuoting = false;
      return;
    }

    if (!inputAmount || inputAmount.trim() === '') {
      this.quote = null;
      this.quoteTimestamp = 0;
      this.quoteError = null;
      this.isQuoting = false;
      return;
    }

    let amountBigInt: bigint;
    try {
      amountBigInt = stringToBigInt(inputAmount, inputToken.decimals);
      if (amountBigInt <= 0n) {
        this.quote = null;
        this.quoteTimestamp = 0;
        this.quoteError = null;
        this.isQuoting = false;
        return;
      }
    } catch {
      this.quote = null;
      this.quoteTimestamp = 0;
      this.quoteError = null;
      this.isQuoting = false;
      return;
    }

    const thisGeneration = ++this.requestGeneration;

    this.isQuoting = true;
    this.quoteError = null;

    try {
      const sideVariant: Side = this.side === 'buy' ? { buy: null } : { sell: null };
      const limitTick = this.side === 'buy'
        ? market.lastTradeTick! + 10000
        : market.lastTradeTick! - 10000;

      // Use anon actor for quote (read-only query)
      const anonActor = this.getAnonSpotActor(market.canister_id);
      const result = await anonActor.quote_order(sideVariant, amountBigInt, limitTick, []);

      if (thisGeneration !== this.requestGeneration) return;

      if ('ok' in result) {
        this.quote = result.ok;
        this.quoteTimestamp = Date.now();
        this.quoteError = null;
      } else {
        const err = result.err;
        const msg = typeof err === 'object' && err !== null && 'message' in err
          ? (err as any).message
          : String(err);
        throw new Error(msg);
      }
    } catch (err) {
      if (thisGeneration !== this.requestGeneration) return;

      console.error('[QuoteExplorerState] Quote calculation failed:', err);
      this.quoteError = err instanceof Error ? err.message : 'Failed to get quote';
      this.quote = null;
      this.quoteTimestamp = 0;
    } finally {
      if (thisGeneration === this.requestGeneration) {
        this.isQuoting = false;
      }
    }
  }

  // ============================================
  // Orderbook Management
  // ============================================

  async refreshOrderbook(): Promise<void> {
    const market = this.market;
    if (!market) return;

    try {
      const anonActor = this.getAnonSpotActor(market.canister_id);
      const depth = await anonActor.get_market_depth(20, 10);
      this.orderbook = transformMarketDepthToLegacy(depth, market.baseTokenDecimals, market.quoteTokenDecimals);
    } catch (error) {
      console.error('[QuoteExplorerState] Failed to fetch orderbook:', error);
    }
  }

  // ============================================
  // Token Pair Helpers
  // ============================================

  /**
   * Get all tokens that have a live market against the given token.
   * Returns TokenDefinition[] suitable for TokenSelectionModal's restrictToTokens.
   */
  getCounterpartTokens(tokenCanisterId: string): TokenDefinition[] {
    const counterpartIds = new Set<string>();

    for (const m of this.marketList) {
      const base = m.base_token.toString();
      const quote = m.quote_token.toString();

      if (base === tokenCanisterId) counterpartIds.add(quote);
      if (quote === tokenCanisterId) counterpartIds.add(base);
    }

    const result: TokenDefinition[] = [];
    for (const id of counterpartIds) {
      const token = entityStore.getToken(id);
      if (token) {
        result.push({
          canisterId: token.canisterId,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logo: token.logo,
        });
      }
    }
    return result;
  }

  /**
   * Find a market where {base, quote} matches {tokenA, tokenB} in either order.
   */
  findMarketByTokens(tokenA: string, tokenB: string): MarketListItem | null {
    for (const m of this.marketList) {
      const base = m.base_token.toString();
      const quote = m.quote_token.toString();

      if ((base === tokenA && quote === tokenB) ||
          (base === tokenB && quote === tokenA)) {
        return m;
      }
    }
    return null;
  }

  /**
   * Switch to the market formed by the new token and the token on the other side.
   * Automatically determines buy/sell side based on which token is base vs quote.
   */
  async switchMarketByTokenPair(newTokenId: string, isInputSide: boolean): Promise<void> {
    const otherToken = isInputSide ? this.outputToken : this.inputToken;
    if (!otherToken) return;

    const market = this.findMarketByTokens(newTokenId, otherToken.canisterId);
    if (!market) return;

    const canisterId = market.canister_id.toString();
    const base = market.base_token.toString();

    // Clear current state
    this.quote = null;
    this.quoteTimestamp = 0;
    this.quoteError = null;
    this.inputAmount = '';

    await this.initializeMarket(canisterId);

    // Determine side: if input token is quote → buy (spending quote to get base)
    //                 if input token is base → sell (spending base to get quote)
    const inputTokenId = isInputSide ? newTokenId : this.inputToken?.canisterId;
    if (inputTokenId) {
      const newSide: SwapSide = inputTokenId === base ? 'sell' : 'buy';
      if (this.side !== newSide) {
        this.side = newSide;
      }
    }

    this.autoPopulateInput();
  }

  // ============================================
  // Swap Execution
  // ============================================

  async executeSlowSwap(): Promise<PassThroughTradeSuccess> {
    const market = this.market;
    const quote = this.quote;
    if (!market || !quote) throw new Error('No market or quote');

    const args: PassThroughTradeArgs = {
      pool_swaps: quote.pool_swaps,
      book_order: quote.book_order,
      recipient: [],
    };

    const result = await marketRepository.executePassThroughTrade(
      market.canister_id,
      args
    );

    if ('ok' in result) return result.ok;
    throw new Error(result.err.message);
  }

  // ============================================
  // Cleanup
  // ============================================

  reset(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.market = null;
    this.isMarketLoading = false;
    this.marketError = null;
    this.marketList = [];
    this.inputAmount = '';
    this.side = 'buy';
    this.quote = null;
    this.quoteTimestamp = 0;
    this.isQuoting = false;
    this.quoteError = null;
    this.orderbook = null;
    this.requestGeneration = 0;
  }
}

// ============================================
// Singleton Export
// ============================================

export const quoteExplorerState = new QuoteExplorerStateManager();

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).quoteExplorerState = quoteExplorerState;
}
