/**
 * Market Selection State
 *
 * Reactive state management for active market selection.
 * Uses Svelte 5 $state rune for reactivity.
 *
 * Phase 2e: Updated with QuoteToken support
 *
 * This file MUST be .svelte.ts to use $state rune.
 */

import { marketRegistry } from './market-registry.svelte';
import type { MarketMetadata } from '../market.types';
import { DEFAULT_QUOTE_TOKEN } from '../quote-token.types';
import type { QuoteToken } from '../quote-token.types';
import { pollingCoordinator } from '$lib/domain/orchestration/polling-coordinator.svelte';

// Re-export QuoteToken for convenience
export type { QuoteToken };
export { DEFAULT_QUOTE_TOKEN };

/**
 * Active market selection state
 * Singleton for tracking which market is currently active
 *
 * Uses $state for reactivity with components
 */
class MarketSelectionState {
  // Reactive state using Svelte 5 $state rune
  activeMarketId = $state<string | null>(null);
  activeQuoteToken = $state<QuoteToken>(DEFAULT_QUOTE_TOKEN);

  // Pending navigation - set before goto(), consumed by trade page
  // Allows skipping indexer lookup when navigating within the app
  pendingCanisterId: string | null = null;

  /**
   * Get the currently active market ID
   */
  getActiveId(): string | null {
    return this.activeMarketId;
  }

  /**
   * Get the currently active quote token
   */
  getActiveQuoteToken(): QuoteToken {
    return this.activeQuoteToken;
  }

  /**
   * Get the currently active market instance
   */
  getActiveMarket() {
    if (!this.activeMarketId) return null;
    return marketRegistry.getMarket(this.activeMarketId);
  }

  /**
   * Select a market by ID with optional quote token
   * Automatically hydrates if not already loaded
   */
  async selectMarket(
    canisterId: string,
    quoteToken: QuoteToken = DEFAULT_QUOTE_TOKEN,
    metadata?: Partial<MarketMetadata>
  ): Promise<void> {
    // Clear active market in coordinator before switching
    if (this.activeMarketId && this.activeMarketId !== canisterId) {
      pollingCoordinator.clearActiveMarket();
    }

    // Check if market exists
    if (!marketRegistry.hasMarket(canisterId)) {
      // Hydrate the market
      await marketRegistry.hydrateMarket(canisterId, 'spot', metadata);
    }

    // Set as active (triggers reactivity)
    this.activeMarketId = canisterId;
    this.activeQuoteToken = quoteToken;

    // Register with coordinator for fast-tier polling (500ms version-gated)
    const market = marketRegistry.getMarket(canisterId);
    if (market) {
      pollingCoordinator.setActiveMarket(canisterId, market);
    }
  }

  /**
   * Change the quote token for the active market
   * Refreshes market data for the new quote token
   */
  async setQuoteToken(quoteToken: QuoteToken): Promise<void> {
    this.activeQuoteToken = quoteToken;
    // Quote token is now fixed at canister creation time - no need to update the market
  }

  /**
   * Deselect the current market
   * Stops polling
   */
  deselectMarket(): void {
    if (this.activeMarketId) {
      pollingCoordinator.clearActiveMarket();
      this.activeMarketId = null;
    }
  }

  /**
   * Check if there's an active market
   */
  hasActiveMarket(): boolean {
    return this.activeMarketId !== null;
  }

  /**
   * Check if a specific market is active
   */
  isMarketActive(canisterId: string): boolean {
    return this.activeMarketId === canisterId;
  }

  /**
   * Set pending canister ID for navigation
   * Call this before goto() to skip indexer lookup on the target page
   */
  setPendingNavigation(canisterId: string): void {
    this.pendingCanisterId = canisterId;
  }

  /**
   * Consume and clear pending canister ID
   * Returns the pending ID if set, null otherwise
   */
  consumePendingNavigation(): string | null {
    const pending = this.pendingCanisterId;
    this.pendingCanisterId = null;
    return pending;
  }
}

// Export singleton instance
export const marketSelection = new MarketSelectionState();

// Development helper
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).marketSelection = marketSelection;
}
