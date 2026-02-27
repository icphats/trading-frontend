/**
 * User Repository
 *
 * Data access layer for user-specific data
 * - Manages actor creation and caching for indexer
 * - Wraps canister calls with error handling
 * - Provides caching for user markets
 * - Transforms raw canister responses into domain types
 */

import { idlFactory as indexerIDL } from 'declarations/indexer/indexer.did.js';
import { MemoryCache, createCache, ActorCache } from './cache';
import { type Result } from './shared/result';
import { cacheCleanupManager } from './shared/cleanup';
import type { _SERVICE as IndexerService } from 'declarations/indexer/indexer.did';
import type { Principal } from '@dfinity/principal';

// Re-export Result for consumers
export type { Result } from './shared/result';

// ============================================
// User Repository Class
// ============================================

export class UserRepository {
  // Actor cache for indexer (unique to this repository)
  private indexerActors = new ActorCache<IndexerService>(indexerIDL);

  // Data caches
  private userMarketsCache: MemoryCache<Principal[]>;

  constructor() {
    // User data cache with 30s TTL (real-time data)
    this.userMarketsCache = createCache<Principal[]>('USER') as MemoryCache<Principal[]>;
  }

  // ============================================
  // Actor Management (Internal)
  // ============================================

  private getIndexerActor(canisterId: string): IndexerService {
    return this.indexerActors.get(canisterId);
  }

  // ============================================
  // User Market Queries
  // ============================================

  /**
   * Get all spot canisters where caller has any involvement
   * (balance, orders, triggers, or LP positions)
   * Uses caller identity from authenticated actor
   * Uses cache with 30s TTL
   */
  async getUserMarkets(
    indexerCanisterId: string,
    userPrincipal: Principal, // Used for cache key only
    useCache: boolean = true
  ): Promise<Result<Principal[]>> {
    const cacheKey = `${userPrincipal.toString()}:markets`;

    if (useCache) {
      const cached = this.userMarketsCache.get(cacheKey);
      if (cached) {
        return { ok: cached };
      }
    }

    try {
      const actor = this.getIndexerActor(indexerCanisterId);

      const result = await actor.get_user_markets();

      this.userMarketsCache.set(cacheKey, result, 30_000);
      return { ok: result };
    } catch (error) {
      console.error(`[UserRepository] Failed to fetch user markets:`, error);
      return { err: error instanceof Error ? error.message : 'Failed to fetch user markets' };
    }
  }


  // ============================================
  // Cache Management
  // ============================================

  /**
   * Invalidate all caches for a specific user
   */
  invalidateUser(userPrincipal: Principal): void {
    const prefix = `${userPrincipal.toString()}:`;
    this.userMarketsCache.invalidatePrefix(prefix);
  }

  /**
   * Clear all in-memory caches
   */
  clearAllCaches(): void {
    this.userMarketsCache.clear();
  }

  /**
   * Clear actor cache (call on identity change)
   * Critical: cached actors hold references to the old agent
   */
  clearActorCache(): void {
    this.indexerActors.clear();
  }

  /**
   * Run periodic cleanup of expired cache entries
   */
  pruneExpiredCaches(): void {
    this.userMarketsCache.prune();
  }
}

// ============================================
// Singleton Export
// ============================================

export const userRepository = new UserRepository();

// Register with centralized cleanup manager
cacheCleanupManager.register(() => userRepository.pruneExpiredCaches());
