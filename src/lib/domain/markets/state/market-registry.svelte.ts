/**
 * Market Registry
 *
 * Central registry for all Spot market instances.
 * Provides unified access to markets and lifecycle management.
 *
 * Phase 3 of Migration Plan - Domain Layer
 *
 * Key Features:
 * - Singleton pattern for global market state
 * - Reactive market maps using Svelte 5 runes
 * - Lazy loading: markets created on-demand
 * - Unified polling control
 * - Type-safe market access
 */

import { SpotMarket } from './spot-market.svelte';
import type {
  MarketExtraMetadata,
  MarketMetadata,
  MarketFilter,
  MarketSortOptions
} from '../market.types';
import { onIdentityChange } from '$lib/domain/user/identity-events';
import { user } from '$lib/domain/user/auth.svelte';
import { pollingCoordinator } from '$lib/domain/orchestration/polling-coordinator.svelte';

// Define MarketInstance as SpotMarket only
export type MarketInstance = SpotMarket;

// ============================================
// Market Registry Class
// ============================================

export class MarketRegistry {
  // ============================================
  // Reactive State
  // ============================================

  /**
   * Spot market instances (canister_id → SpotMarket)
   */
  private spotMarkets = $state(new Map<string, SpotMarket>());

  /**
   * Extra metadata not on SpotMarket (canister_id → extra metadata)
   * Full MarketMetadata is derived by combining with SpotMarket fields
   */
  private extraMetadataMap = $state(new Map<string, MarketExtraMetadata>());


  // ============================================
  // Identity Change Handling
  // ============================================

  constructor() {
    // Subscribe to identity changes for reactive user data updates
    // This handles login, logout, and identity switch events
    this.subscribeToIdentityChanges();
  }

  /**
   * Subscribe to identity changes to update user principals across all polling markets
   * Handles: login, logout, identity switch
   */
  private subscribeToIdentityChanges(): void {
    onIdentityChange(() => {
      this.handleIdentityChange();
    });
  }

  /**
   * Handle identity change (login/logout/switch)
   * - Clear old user data immediately (prevents stale data from previous user)
   * - Update principal on coordinator (handles all polling tiers)
   */
  private handleIdentityChange(): void {
    // 1. Clear all user data from markets (prevents showing previous user's data)
    this.clearAllUserData();

    // 2. Update coordinator with new principal (handles fast + slow tier)
    pollingCoordinator.setUserPrincipal(user.principal as any);
  }

  // ============================================
  // Derived State
  // ============================================

  /**
   * All markets
   * Returns array of all market instances
   */
  allMarkets = $derived.by(() => {
    return Array.from(this.spotMarkets.values()) as MarketInstance[];
  });

  /**
   * All spot markets as array
   */
  spotMarketsArray = $derived.by(() => {
    return Array.from(this.spotMarkets.values());
  });

  /**
   * Market count
   */
  marketCounts = $derived.by(() => {
    return {
      spot: this.spotMarkets.size,
      total: this.spotMarkets.size
    };
  });


  // ============================================
  // Market Creation & Hydration
  // ============================================

  /**
   * Hydrate a market (create if doesn't exist)
   * This is the main entry point for loading market data
   *
   * Uses L2 cache for instant UI:
   * 1. Create market instance
   * 2. Restore from localStorage cache (instant UI)
   * 3. Hydrate fresh data from canister (background)
   *
   * @param canisterId - Canister ID of the market
   * @param type - Market type (only 'spot' supported)
   * @param metadata - Optional metadata (name, symbol, etc.)
   * @returns The hydrated market instance
   */
  async hydrateMarket(
    canisterId: string,
    type: 'spot' = 'spot',
    metadata?: Partial<MarketMetadata>
  ): Promise<MarketInstance> {
    // Check if market already exists
    const existing = this.getMarket(canisterId);
    if (existing) {
      // Re-hydrate existing market (background)
      existing.hydrateAll().catch(err => {
        console.warn(`[MarketRegistry] Failed to re-hydrate ${canisterId}:`, err);
      });
      return existing;
    }

    // Create new market instance
    const market = this.createMarket(canisterId, metadata);

    // Store in registry FIRST (allows UI to render immediately with any cached data)
    this.spotMarkets.set(canisterId, market);

    // Store only extra metadata (name/symbol come from SpotMarket - single source of truth)
    this.extraMetadataMap.set(canisterId, {
      description: metadata?.description,
      logoUrl: metadata?.logoUrl,
      tags: metadata?.tags,
      isActive: metadata?.isActive ?? true,
      createdAt: metadata?.createdAt ?? BigInt(Date.now())
    });

    // Try to restore from L2 cache for instant UI
    const cacheRestored = market.restoreFromCache();
    if (cacheRestored) {
      // Hydrate in background - don't await
      market.hydrateAll().catch(err => {
        console.warn(`[MarketRegistry] Failed to hydrate ${canisterId}:`, err);
      });
    } else {
      // No cache - must await hydration before returning
      await market.hydrateAll();
    }

    return market;
  }

  /**
   * Create a market instance without hydration
   * Internal method for lazy instantiation
   */
  private createMarket(
    canisterId: string,
    metadata?: Partial<MarketMetadata>
  ): SpotMarket {
    const name = metadata?.name ?? '';
    const symbol = metadata?.symbol ?? '';
    return new SpotMarket(canisterId, name, symbol);
  }

  // ============================================
  // Market Access
  // ============================================

  /**
   * Get a market by canister ID
   * Returns undefined if market doesn't exist
   */
  getMarket(canisterId: string): MarketInstance | undefined {
    return this.spotMarkets.get(canisterId);
  }

  /**
   * Get a spot market by canister ID
   * Returns undefined if market doesn't exist
   */
  getSpotMarket(canisterId: string): SpotMarket | undefined {
    return this.spotMarkets.get(canisterId);
  }

  /**
   * Get market metadata (derived from SpotMarket + extra metadata)
   * SpotMarket is the source of truth for canisterId, type, name, symbol
   */
  getMetadata(canisterId: string): MarketMetadata | undefined {
    const market = this.spotMarkets.get(canisterId);
    const extra = this.extraMetadataMap.get(canisterId);

    if (!market) return undefined;

    // Derive full metadata: SpotMarket fields + extra metadata
    return {
      canisterId: market.canister_id,
      type: 'spot',
      name: market.token_name,
      symbol: market.token_symbol,
      ...extra,
      // Ensure isActive has a default if extra is missing
      isActive: extra?.isActive ?? true,
    };
  }

  /**
   * Check if market exists in registry
   */
  hasMarket(canisterId: string): boolean {
    return this.spotMarkets.has(canisterId);
  }


  // ============================================
  // Market Filtering & Sorting
  // ============================================

  /**
   * Filter markets by criteria
   */
  filterMarkets(filter: MarketFilter): MarketInstance[] {
    return this.allMarkets.filter((market) => {
      // Filter by active status
      if (filter.isActive !== undefined) {
        const metadata = this.extraMetadataMap.get(market.canister_id);
        if (metadata && metadata.isActive !== filter.isActive) {
          return false;
        }
      }

      // Filter by tags
      if (filter.tags && filter.tags.length > 0) {
        const metadata = this.extraMetadataMap.get(market.canister_id);
        if (!metadata || !metadata.tags) {
          return false;
        }
        // Check if market has any of the specified tags
        const hasTag = filter.tags.some((tag) => metadata.tags!.includes(tag));
        if (!hasTag) {
          return false;
        }
      }

      // Filter by search term
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        const metadata = this.extraMetadataMap.get(market.canister_id);
        const matchesName = market.token_name.toLowerCase().includes(term);
        const matchesSymbol = market.token_symbol.toLowerCase().includes(term);
        const matchesDescription =
          metadata?.description?.toLowerCase().includes(term) ?? false;

        if (!matchesName && !matchesSymbol && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort markets by criteria
   */
  sortMarkets(markets: MarketInstance[], options: MarketSortOptions): MarketInstance[] {
    const sorted = [...markets].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (options.by) {
        case 'name':
          aValue = a.token_name;
          bValue = b.token_name;
          break;
        case 'volume':
          aValue = (a as SpotMarket).volume24hUsd;
          bValue = (b as SpotMarket).volume24hUsd;
          break;
        case 'price':
          aValue = (a as SpotMarket).spotPrice;
          bValue = (b as SpotMarket).spotPrice;
          break;
        case 'change24h':
          aValue = (a as SpotMarket).priceChange24h;
          bValue = (b as SpotMarket).priceChange24h;
          break;
        case 'createdAt':
          const aMetadata = this.extraMetadataMap.get(a.canister_id);
          const bMetadata = this.extraMetadataMap.get(b.canister_id);
          aValue = aMetadata?.createdAt ?? 0n;
          bValue = bMetadata?.createdAt ?? 0n;
          break;
        default:
          return 0;
      }

      // Handle bigint comparison
      if (typeof aValue === 'bigint' && typeof bValue === 'bigint') {
        const diff = aValue - bValue;
        return options.direction === 'asc' ? Number(diff) : -Number(diff);
      }

      // Handle string/number comparison
      if (aValue < bValue) return options.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return options.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  // ============================================
  // Market Removal
  // ============================================

  /**
   * Remove a market from registry
   * Stops polling and removes from maps
   */
  removeMarket(canisterId: string): void {
    this.spotMarkets.delete(canisterId);
    this.extraMetadataMap.delete(canisterId);
  }

  /**
   * Clear all markets from registry
   * Stops all polling and clears all maps
   */
  clearAll(): void {
    this.spotMarkets.clear();
    this.extraMetadataMap.clear();
  }

  /**
   * Clear user-specific data from all registered markets
   * Called on identity change (logout/login/switch)
   * Preserves market instances and public data (tick, orderbook, etc.)
   */
  clearAllUserData(): void {
    for (const market of this.spotMarkets.values()) {
      market.clearUserData();
    }
  }

  // ============================================
  // Batch Operations
  // ============================================

  /**
   * Hydrate multiple markets in parallel
   */
  async hydrateMarkets(
    markets: Array<{ canisterId: string; metadata?: Partial<MarketMetadata> }>
  ): Promise<SpotMarket[]> {
    const promises = markets.map((m) => this.hydrateMarket(m.canisterId, 'spot', m.metadata));
    return Promise.all(promises);
  }

  /**
   * Get or create a market
   * Returns existing market if it exists, otherwise creates and hydrates a new one
   */
  async getOrCreateMarket(
    canisterId: string,
    metadata?: Partial<MarketMetadata>
  ): Promise<MarketInstance> {
    const existing = this.getMarket(canisterId);
    if (existing) {
      return existing;
    }

    return this.hydrateMarket(canisterId, 'spot', metadata);
  }

  // ============================================
  // Debugging & Stats
  // ============================================

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      counts: this.marketCounts,
      markets: {
        spot: this.spotMarketsArray.map((m) => ({
          id: m.canister_id,
          name: m.token_name,
          symbol: m.token_symbol
        }))
      }
    };
  }

  /**
   * Log registry state to console (for debugging)
   */
  logState(): void {
    console.table(this.getStats());
  }
}

// ============================================
// Singleton Export
// ============================================

/**
 * Global market registry instance
 * Use this to access all markets across the application
 */
export const marketRegistry = new MarketRegistry();

// Development helper: expose to window for debugging
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).marketRegistry = marketRegistry;
}
