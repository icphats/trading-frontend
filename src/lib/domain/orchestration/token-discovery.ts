/**
 * Token & Market Discovery Service
 *
 * Orchestrates discovery by coordinating between:
 * - tokenRepository / indexerRepository (data fetching + caching)
 * - entityStore (runtime state)
 *
 * Components should use this service instead of accessing repositories directly.
 */

import { tokenRepository } from '$lib/repositories/token.repository';
import { indexerRepository } from '$lib/repositories/indexer.repository';
import { entityStore, type NormalizedToken } from './entity-store.svelte';
import { TOKEN_DEFINITIONS } from '$lib/constants/token.constants';
import type { MarketListItem, TokenListItem, VolumeCursor } from '$lib/actors/services/indexer.service';
import { bpsToPercent } from '$lib/domain/markets/utils/math';

// ============================================
// Platform Token Seeding
// ============================================

/**
 * Seed entityStore with hardcoded platform tokens (ICP, USDT, USDC, etc.)
 *
 * Call this EARLY in app initialization to ensure quote tokens and
 * other platform tokens are immediately available for UI components.
 *
 * This is idempotent - safe to call multiple times. Existing data
 * (e.g., prices from indexer) will NOT be overwritten.
 */
export function seedPlatformTokens(): void {
  const upserts = TOKEN_DEFINITIONS.map(def => ({
    canisterId: def.canisterId,
    symbol: def.symbol,
    name: def.name,
    decimals: def.decimals,
    logo: def.logo ?? null,
    fee: def.initialFee ?? 0n,
    isQuoteToken: def.isQuoteToken ?? false,
    priceUsd: def.initialPrice ?? 0n,
    source: 'hardcoded' as const,
  }));

  entityStore.upsertTokens(upserts);
}

// ============================================
// Token Discovery
// ============================================

/**
 * Discover a token by canister ID and register it in the entity store
 *
 * Flow:
 * 1. Check entityStore first (already discovered)
 * 2. Call tokenRepository.discoverToken() (handles cache + network)
 * 3. Upsert to entityStore
 * 4. Return normalized token
 *
 * @param canisterId - The ledger canister ID to discover
 * @returns NormalizedToken if successful, null if failed
 */
export async function discoverToken(canisterId: string): Promise<NormalizedToken | null> {
  // 1. Check if already in entityStore
  const existing = entityStore.getToken(canisterId);
  if (existing) {
    return existing;
  }

  // 2. Discover via repository (handles L1/L2 cache + network fetch)
  const result = await tokenRepository.discoverToken(canisterId);

  if ('err' in result) {
    console.error(`[TokenDiscovery] Failed to discover token ${canisterId}:`, result.err);
    return null;
  }

  const discovered = result.ok;

  // 3. Upsert to entityStore
  entityStore.upsertToken({
    canisterId: discovered.canisterId,
    symbol: discovered.symbol,
    name: discovered.name,
    decimals: discovered.decimals,
    fee: discovered.fee,
    logo: discovered.logo ?? null,
    source: discovered.source === 'hardcoded' ? 'hardcoded' : 'discovered',
  });

  // 4. Return the normalized token
  return entityStore.getToken(canisterId) ?? null;
}

/**
 * Batch discover multiple tokens
 * Useful for pre-loading tokens for a list
 *
 * @param canisterIds - Array of ledger canister IDs
 * @returns Array of successfully discovered tokens
 */
export async function discoverTokens(canisterIds: string[]): Promise<NormalizedToken[]> {
  const results = await Promise.all(
    canisterIds.map(id => discoverToken(id))
  );

  return results.filter((t): t is NormalizedToken => t !== null);
}

// ============================================
// Market Discovery (for search/browse)
// ============================================

/**
 * Get markets for search/browse UI
 * Returns raw market list items from indexer (includes price/volume data)
 * Also upserts to entityStore to keep global state fresh
 *
 * @param limit - Max number of markets to return
 * @param cursor - Optional pagination cursor
 * @returns Array of MarketListItem or empty array on error
 */
export async function getMarketsForSearch(
  limit: bigint = 100n,
  cursor?: VolumeCursor
): Promise<MarketListItem[]> {
  const result = await indexerRepository.getMarkets(limit, cursor);

  if ('err' in result) {
    console.error('[Discovery] Failed to load markets:', result.err);
    return [];
  }

  const items = result.ok.data;

  // Upsert to entityStore to keep global state fresh
  // This ensures any component reading from entityStore has up-to-date market data
  // Note: Backend uses E12 for prices, E6 for volume
  if (items.length > 0) {
    entityStore.upsertMarkets(
      items.map(item => ({
        canisterId: item.canister_id.toString(),
        symbol: item.symbol,
        baseToken: item.base_token.toString(),
        quoteToken: item.quote_token.toString(),
        lastTradePrice: item.last_price_usd_e12,
        volume24h: item.volume_24h_usd_e6,
        priceChange24h: bpsToPercent(item.price_change_24h_bps),
        source: 'indexer' as const,
      }))
    );

    // Also update token prices from market data (markets have fresher price data)
    for (const item of items) {
      const tokenCanisterId = item.base_token.toString();
      if (entityStore.hasToken(tokenCanisterId)) {
        entityStore.updateTokenPrice(tokenCanisterId, item.last_price_usd_e12, 'indexer');
      }
    }

  }

  return items;
}

/**
 * Get popular tokens for selection UI
 * Returns raw token list items from indexer (includes volume/price data)
 * Also upserts to entityStore to keep global state fresh
 *
 * @param limit - Max number of tokens to return
 * @param cursor - Optional pagination cursor
 * @returns Array of TokenListItem sorted by 24h volume, or empty array on error
 */
export async function getPopularTokens(
  limit: bigint = 50n,
  cursor?: VolumeCursor
): Promise<TokenListItem[]> {
  const result = await indexerRepository.getTokens(limit, cursor);

  if ('err' in result) {
    console.error('[Discovery] Failed to load popular tokens:', result.err);
    return [];
  }

  const items = result.ok.data;

  // Upsert to entityStore to keep global state fresh
  // Note: Backend uses E12 for prices, E6 for USD accumulators
  if (items.length > 0) {
    entityStore.upsertTokens(
      items.map(item => ({
        canisterId: item.token_ledger.toString(),
        symbol: item.symbol,
        name: item.name,
        decimals: item.decimals,
        priceUsd: item.current_price_usd_e12,
        priceChange24h: bpsToPercent(item.price_change_24h_bps),
        priceSource: 'indexer' as const,
        volume24h: item.volume_24h_usd_e6,
        volume7d: item.volume_7d_usd_e6,
        volume30d: item.volume_30d_usd_e6,
        tvl: item.tvl_usd_e6,
        source: 'indexer' as const,
      }))
    );

  }

  // Sort by 24h volume descending
  return [...items].sort(
    (a, b) => Number(b.volume_24h_usd_e6 - a.volume_24h_usd_e6)
  );
}
