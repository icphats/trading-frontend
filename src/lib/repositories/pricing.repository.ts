/**
 * Pricing Repository
 *
 * Data access layer for external price feeds.
 * Handles fetching from Coinbase API and other external sources.
 *
 * This repository does NOT hold reactive state - it just fetches data.
 * The domain layer (PricingCoordinator) manages reactive state and polling.
 */

import { MemoryCache } from './cache';
import { type Result } from './shared/result';
import { cacheCleanupManager } from './shared/cleanup';

// ============================================
// Configuration
// ============================================

const COINBASE_API = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';

// Map our symbols to Coinbase symbols
const SYMBOL_MAP: Record<string, string> = {
  'BTC': 'BTC',
  'ETH': 'ETH',
  'ICP': 'ICP',
  'USDT': 'USDT',
  'USDC': 'USDC',
};

// Static prices for stablecoins (E12 per 06-Precision.md: $1.00 = 1_000_000_000_000n)
const STATIC_PRICES: Record<string, bigint> = {
  'USDT': 1_000_000_000_000n,
  'USDC': 1_000_000_000_000n,
};

// ============================================
// Types
// ============================================

interface CoinbaseResponse {
  data: {
    currency: string;
    rates: Record<string, string>; // { BTC: "0.0000231", ... } - inverted rates
  };
}

export type PriceSource = 'spot' | 'coinbase' | 'static';

export interface PriceData {
  price: bigint;      // Price in E12 (12 decimals per 06-Precision.md, e.g., $43,250.50 = 43_250_500_000_000_000n)
  source: PriceSource;
  timestamp: number;
}

export interface PriceFetchResult {
  prices: Map<string, PriceData>;
  errors: string[];
}

// ============================================
// Pricing Repository Class
// ============================================

export class PricingRepository {
  private cache = new MemoryCache<PriceData>();

  // ============================================
  // Coinbase API
  // ============================================

  /**
   * Fetch prices from Coinbase API
   * Returns USD prices for supported tokens
   */
  async fetchCoinbasePrices(useCache = true): Promise<Result<PriceFetchResult>> {
    const cacheKey = 'coinbase_prices';
    const now = Date.now();

    // Check cache (30 second TTL for external prices)
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        // Return all cached prices
        const prices = new Map<string, PriceData>();
        for (const symbol of Object.keys(SYMBOL_MAP)) {
          const symbolCache = this.cache.get(`coinbase:${symbol}`);
          if (symbolCache) {
            prices.set(symbol, symbolCache);
          }
        }
        if (prices.size > 0) {
          return { ok: { prices, errors: [] } };
        }
      }
    }

    try {
      const res = await fetch(COINBASE_API);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const response = await res.json() as CoinbaseResponse;

      const rates = response.data.rates;
      const prices = new Map<string, PriceData>();
      const errors: string[] = [];

      for (const [symbol, coinbaseSymbol] of Object.entries(SYMBOL_MAP)) {
        const rateStr = rates[coinbaseSymbol];
        if (!rateStr) {
          errors.push(`No Coinbase rate for ${symbol}`);
          continue;
        }

        // Coinbase API returns inverted rates (1 USD = X crypto)
        // We need to invert to get USD price (1 crypto = Y USD)
        const rate = parseFloat(rateStr);
        if (rate === 0 || !isFinite(rate)) {
          errors.push(`Invalid Coinbase rate for ${symbol}: ${rateStr}`);
          continue;
        }

        const usdPrice = 1 / rate;
        // Store as E12 per 06-Precision.md
        const price = this.parsePriceToBigInt(usdPrice.toFixed(12), 12);

        const priceData: PriceData = {
          price,
          source: 'coinbase',
          timestamp: now,
        };

        prices.set(symbol, priceData);

        // Cache individual prices
        this.cache.set(`coinbase:${symbol}`, priceData, 30_000);
      }

      // Mark that we have cached data
      this.cache.set(cacheKey, { price: 0n, source: 'coinbase', timestamp: now }, 30_000);

      return { ok: { prices, errors } };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PricingRepository] Failed to fetch Coinbase prices:', errorMsg);
      return { err: errorMsg };
    }
  }

  // ============================================
  // Static Prices
  // ============================================

  /**
   * Get static prices for stablecoins
   * These don't need API calls
   */
  getStaticPrices(): Map<string, PriceData> {
    const prices = new Map<string, PriceData>();
    const now = Date.now();

    for (const [symbol, price] of Object.entries(STATIC_PRICES)) {
      prices.set(symbol, {
        price,
        source: 'static',
        timestamp: now,
      });
    }

    return prices;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get symbols supported by Coinbase
   */
  getSupportedSymbols(): string[] {
    return Object.keys(SYMBOL_MAP);
  }

  /**
   * Check if a symbol has a static price
   */
  hasStaticPrice(symbol: string): boolean {
    return symbol in STATIC_PRICES;
  }

  /**
   * Parse price string to bigint with specified decimals
   * Example: "43250.50" with 12 decimals → 43250500000000000n
   */
  private parsePriceToBigInt(priceStr: string, decimals: number): bigint {
    const [whole, fraction = ''] = priceStr.split('.');

    // Pad or truncate fraction to match decimals
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);

    // Combine whole and fraction
    const combined = whole + paddedFraction;

    return BigInt(combined);
  }

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Invalidate all cached prices
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Prune expired cache entries
   */
  pruneExpiredCaches(): void {
    this.cache.prune();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// ============================================
// Singleton Export
// ============================================

export const pricingRepository = new PricingRepository();

// Register with centralized cleanup manager
cacheCleanupManager.register(() => pricingRepository.pruneExpiredCaches());
