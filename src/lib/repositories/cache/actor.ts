/**
 * Actor Cache
 *
 * Generic actor cache for IC canister actors
 * - Provides singleton actors per canister ID
 * - Supports both multi-instance (Map) and single-instance patterns
 * - Centralizes actor creation logic
 */

import { createActor } from '$lib/actors/create-actor';
import type { IDL } from '@dfinity/candid';

// ============================================
// Actor Cache Class
// ============================================

/**
 * Generic actor cache that creates and caches actors by canister ID
 *
 * @example
 * ```ts
 * const spotActors = new ActorCache<SpotService>(spotIDL);
 * const actor = spotActors.get('canister-id-123');
 * ```
 */
export class ActorCache<T> {
  private cache = new Map<string, T>();
  private idlFactory: IDL.InterfaceFactory;

  constructor(idlFactory: IDL.InterfaceFactory) {
    this.idlFactory = idlFactory;
  }

  /**
   * Get or create an actor for the given canister ID
   */
  get(canisterId: string): T {
    if (!this.cache.has(canisterId)) {
      const actor = createActor<T>(this.idlFactory, canisterId);
      this.cache.set(canisterId, actor);
    }
    return this.cache.get(canisterId)!;
  }

  /**
   * Check if an actor exists in cache
   */
  has(canisterId: string): boolean {
    return this.cache.has(canisterId);
  }

  /**
   * Remove an actor from cache (e.g., after identity change)
   */
  invalidate(canisterId: string): void {
    this.cache.delete(canisterId);
  }

  /**
   * Clear all cached actors (e.g., on logout)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached actors
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached canister IDs
   */
  getCanisterIds(): string[] {
    return Array.from(this.cache.keys());
  }
}

// ============================================
// Singleton Actor Cache
// ============================================

/**
 * Singleton actor cache for canisters where only one instance is needed
 * (e.g., indexer canister)
 *
 * @example
 * ```ts
 * const indexerActor = new SingletonActorCache<IndexerService>(indexerIDL);
 * const actor = indexerActor.get('indexer-canister-id');
 * ```
 */
export class SingletonActorCache<T> {
  private actor: T | null = null;
  private canisterId: string | null = null;
  private idlFactory: IDL.InterfaceFactory;

  constructor(idlFactory: IDL.InterfaceFactory) {
    this.idlFactory = idlFactory;
  }

  /**
   * Get or create the singleton actor
   * If called with a different canister ID, recreates the actor
   */
  get(canisterId: string): T {
    if (!this.actor || this.canisterId !== canisterId) {
      this.actor = createActor<T>(this.idlFactory, canisterId);
      this.canisterId = canisterId;
    }
    return this.actor;
  }

  /**
   * Check if an actor exists
   */
  has(): boolean {
    return this.actor !== null;
  }

  /**
   * Get the current canister ID
   */
  getCanisterId(): string | null {
    return this.canisterId;
  }

  /**
   * Clear the cached actor
   */
  clear(): void {
    this.actor = null;
    this.canisterId = null;
  }
}

// ============================================
// Shared Actor Registry
// ============================================

/**
 * Global actor registry for sharing actors across repositories
 * This prevents duplicate actor instances for the same canister
 */
class ActorRegistry {
  private caches = new Map<string, ActorCache<unknown>>();

  /**
   * Get or create an ActorCache for a specific actor type
   * Uses the IDL factory as the key to ensure type safety
   */
  getCache<T>(key: string, idlFactory: IDL.InterfaceFactory): ActorCache<T> {
    if (!this.caches.has(key)) {
      this.caches.set(key, new ActorCache<T>(idlFactory));
    }
    return this.caches.get(key) as ActorCache<T>;
  }

  /**
   * Clear all actor caches (e.g., on identity change)
   */
  clearAll(): void {
    this.caches.forEach(cache => cache.clear());
  }

  /**
   * Get statistics about cached actors
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.caches.forEach((cache, key) => {
      stats[key] = cache.size;
    });
    return stats;
  }
}

// Singleton registry instance
export const actorRegistry = new ActorRegistry();
