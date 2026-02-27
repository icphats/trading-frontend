/**
 * Market Operations Service
 *
 * Orchestrates market creation and pool operations.
 * Components should use this service instead of accessing actors directly.
 */

import { api } from '$lib/actors/api.svelte';
import type { SpotMarketMetadata } from '$lib/actors/services/registry.service';
import type { PoolState, PoolOverview } from '$lib/actors/services/spot.service';
import { marketRepository } from '$lib/repositories/market.repository';
import type { Principal } from '@dfinity/principal';

// Re-export types for consumers
export type { SpotMarketMetadata, PoolState, PoolOverview };

// ============================================
// Market Creation
// ============================================

export interface CreateMarketParams {
  base: Principal;
  quote: Principal;
}

export type CreateMarketResult =
  | { ok: SpotMarketMetadata }
  | { err: string };

/**
 * Create a new spot market for a token pair
 */
export async function createMarket(params: CreateMarketParams): Promise<CreateMarketResult> {
  if (!api.registry) {
    return { err: 'Registry not available' };
  }

  try {
    const result = await api.registry.create_spot_market(params);
    if ('err' in result) {
      return { err: result.err.message };
    }
    return result;
  } catch (err) {
    console.error('[MarketOperations] Failed to create market:', err);
    return { err: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Check if registry is available for market creation
 */
export function isRegistryAvailable(): boolean {
  return api.registry !== null;
}

// ============================================
// Pool Operations
// ============================================

/**
 * Fetch pool state for a specific fee tier
 */
export async function fetchPoolState(
  spotCanisterId: string,
  feePips: number
): Promise<PoolState | null> {
  const result = await marketRepository.fetchPoolState(spotCanisterId, feePips);
  if ('err' in result) {
    console.error('[MarketOperations] Failed to fetch pool state:', result.err);
    return null;
  }
  return result.ok;
}

/**
 * Fetch all pool overviews for a spot market
 */
export async function fetchPoolsOverview(spotCanisterId: string): Promise<PoolOverview[]> {
  const result = await marketRepository.fetchPoolsOverview(spotCanisterId);
  if ('err' in result) {
    console.error('[MarketOperations] Failed to fetch pool overviews:', result.err);
    return [];
  }
  return result.ok;
}
