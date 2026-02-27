/**
 * Pricing Service
 *
 * Fetches Coinbase prices for externally-traded tokens (ICP, ETH, BTC, SOL)
 * and seeds stablecoin prices (USDT, USDC = $1.00).
 *
 * DEX token prices are handled by PollingCoordinator's medium tier via
 * visibility-driven polling (use:tokenTicker on visible rows).
 *
 * RELATIONSHIP TO entityStore:
 * - Does NOT store token data (only operational state: timers, status flags)
 * - DERIVES icpUsdPrice from entityStore.getTokenBySymbol('ICP')
 * - PUSHES all price updates via entityStore.updateTokenPrice()
 *
 * Uses entityStore as the SINGLE SOURCE OF TRUTH for all price data.
 */

import { pricingRepository, type PriceSource, type PriceData } from '$lib/repositories/pricing.repository';
import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';

// ============================================
// Configuration
// ============================================

const POLL_INTERVAL_MS = 30_000; // 30 seconds

// ============================================
// Pricing Service
// ============================================

class PricingCoordinator {
  private coinbasePollTimer: ReturnType<typeof setInterval> | null = null;

  // Reactive state (UI status only - prices live in entityStore)
  isActive = $state(false);
  lastCoinbaseUpdate = $state<Date | null>(null);
  lastError = $state<string | null>(null);

  /**
   * Reactive ICP/USD price (E12 bigint per 06-Precision.md)
   * Derived from entityStore - the single source of truth
   */
  icpUsdPrice = $derived.by(() => {
    const icpToken = entityStore.getTokenBySymbol('ICP');
    return icpToken?.priceUsd ?? null;
  });

  /**
   * Start automatic price updates
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    // Immediate first fetch
    this.updateAllPrices();

    // Set up Coinbase polling (30 seconds) - external token prices (ICP, ETH, BTC)
    this.coinbasePollTimer = setInterval(() => {
      this.updateCoinbasePrices();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop automatic updates
   */
  stop(): void {
    if (!this.isActive) return;

    if (this.coinbasePollTimer) {
      clearInterval(this.coinbasePollTimer);
      this.coinbasePollTimer = null;
    }

    this.isActive = false;
  }

  /**
   * Update all prices (called on start)
   */
  async updateAllPrices(): Promise<void> {
    await Promise.allSettled([
      this.updateStaticPrices(),
      this.updateCoinbasePrices(),
    ]);
  }

  /**
   * Fetch prices from Coinbase API
   *
   * Provides USD prices for externally-traded tokens (ICP, ETH, BTC, etc.)
   * These tokens may or may not have DEX markets - Coinbase is authoritative for USD.
   */
  async updateCoinbasePrices(): Promise<void> {
    const result = await pricingRepository.fetchCoinbasePrices();

    if ('err' in result) {
      this.lastError = result.err;
      return;
    }

    const { prices, errors } = result.ok;

    // Log any individual symbol errors
    for (const error of errors) {
      console.warn('[PricingCoordinator]', error);
    }

    // Update entityStore directly (it handles priority internally)
    for (const [symbol, priceData] of prices) {
      const token = entityStore.getTokenBySymbol(symbol);
      if (token) {
        entityStore.updateTokenPrice(token.canisterId, priceData.price, 'oracle');
      }
    }

    this.lastCoinbaseUpdate = new Date();
    this.lastError = null;
  }

  /**
   * Update static prices for stablecoins (lowest priority fallback)
   */
  async updateStaticPrices(): Promise<void> {
    const staticPrices = pricingRepository.getStaticPrices();

    for (const [symbol, priceData] of staticPrices) {
      const token = entityStore.getTokenBySymbol(symbol);
      if (token) {
        entityStore.updateTokenPrice(token.canisterId, priceData.price, 'oracle');
      }
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const pricingService = new PricingCoordinator();

// Re-export types for consumers
export type { PriceSource, PriceData };
