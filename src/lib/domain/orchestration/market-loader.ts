/**
 * Market Loader Service
 *
 * Service to load markets using the "Discoverable via Indexer, Hydrated via Canister" pattern
 * - Discovery: Uses indexer for lightweight market previews
 * - Hydration: Fetches full data from individual market canisters
 *
 * Phase 4 of Migration Plan - Component Migration
 */

import { marketRegistry } from '../markets/state/market-registry.svelte';
import { entityStore } from './entity-store.svelte';
import { indexerRepository } from '$lib/repositories/indexer.repository';
import type { MarketMetadata } from '../markets/market.types';
import { api } from '$lib/actors/api.svelte';
import { canisterIds } from '$lib/constants/app.constants';

// ============================================
// Market Discovery & Loading
// ============================================

/**
 * Load all markets using indexer for discovery
 * Implements "Discoverable via Indexer, Hydrated via Canister" pattern
 * Should be called once on app initialization
 */
export async function discoverAndLoadMarkets(): Promise<{
  spot: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  const loadedSpot: string[] = [];

  try {
    // Check if indexer is available
    if (!canisterIds.indexer) {
      throw new Error('Indexer canister ID not configured');
    }

    // Verify indexer actor is initialized
    if (!api.indexer) {
      throw new Error('Indexer actor not initialized');
    }

    // ✅ STEP 1: Discover markets via indexer (lightweight previews)
    const result = await indexerRepository.getMarkets(1000n);

    if ('err' in result) {
      throw new Error(result.err);
    }

    const { data: markets } = result.ok;

    // ✅ STEP 1.5: Seed entityStore with lightweight market previews (instant)
    // This gives components baseToken/quoteToken immediately without waiting for full hydration
    entityStore.upsertMarkets(
      markets.map((m) => ({
        canisterId: m.canister_id.toString(),
        symbol: m.symbol,
        baseToken: m.base_token.toString(),
        quoteToken: m.quote_token.toString(),
        lastTradePrice: m.last_price_usd_e12,
        volume24h: m.volume_24h_usd_e6,
        priceChange24h: Number(m.price_change_24h_bps) / 100,
      }))
    );

    // ✅ STEP 2: Hydrate markets from individual canisters (full data) — in parallel
    const hydrationResults = await Promise.allSettled(
      markets.map(async (preview) => {
        const canisterId = preview.canister_id.toString();
        const marketSymbol = preview.symbol;

        const metadata: Partial<MarketMetadata> = {
          name: marketSymbol,
          symbol: marketSymbol,
          isActive: true,
          createdAt: BigInt(Date.now())
        };

        await marketRegistry.hydrateMarket(canisterId, 'spot', metadata);
        return canisterId;
      })
    );

    for (const result of hydrationResults) {
      if (result.status === 'fulfilled') {
        loadedSpot.push(result.value);
      } else {
        const error = `Failed to hydrate spot market: ${result.reason}`;
        console.error(error);
        errors.push(error);
      }
    }

    return { spot: loadedSpot, errors };
  } catch (err) {
    const error = `Fatal error loading markets: ${err}`;
    console.error(error);
    errors.push(error);
    return { spot: loadedSpot, errors };
  }
}

/**
 * Load a single spot market by ID
 * Useful for deep linking to specific markets
 */
export async function loadMarket(
  canisterId: string,
  metadata?: Partial<MarketMetadata>
): Promise<void> {
  try {
    await marketRegistry.hydrateMarket(canisterId, 'spot', metadata);
  } catch (err) {
    console.error(`Failed to load spot market ${canisterId}:`, err);
    throw err;
  }
}

// Development helper
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).discoverMarkets = discoverAndLoadMarkets;
}
