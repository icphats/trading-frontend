/**
 * Token Logo Service
 *
 * PURPOSE: Orchestrates logo fetching with deduplication, retry logic, and IndexedDB
 * caching. This is a COORDINATOR, not a data store.
 *
 * RELATIONSHIP TO entityStore:
 * - Does NOT store token/logo data (only operational state: fetchPromises, failedFetches)
 * - READS from entityStore.getToken() to check if logo exists
 * - PUSHES all fetched logos via entityStore.upsertToken()
 *
 * Architecture:
 * - Fetch from ICRC-1 ledger canister (icrc1_metadata)
 * - Cache via tokenRepository (encapsulates IndexedDB)
 * - Upsert to entityStore (reactive, components read from here)
 *
 * This service does NOT maintain its own cache - entityStore is the source of truth.
 */

import { tokenRepository } from '$lib/repositories/token.repository';
import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
import type { MarketListItem } from '$lib/actors/services/indexer.service';

// ============================================================================
// Types
// ============================================================================

/**
 * UI-ready market information with canonical field names
 */
export interface UIMarketInfo {
  tradingCanisterId: string;
  ledgerCanisterId: string;
  marketType: 'spot';
  name: string;
  symbol: string;
  logoSrc: string | null;
}

type RawMarket = MarketListItem;

// Retry configuration
const RETRY_DELAY_MS = 30_000; // 30 seconds before retry
const MAX_RETRIES = 3;

// ============================================================================
// Token Logo Service - Singleton
// ============================================================================

class TokenLogoService {
  /**
   * Track in-flight fetches to prevent duplicate requests
   */
  private fetchPromises = new Map<string, Promise<string | null>>();

  /**
   * Track failed fetches for retry logic
   * Map<canisterId, { attempts: number, lastAttempt: number }>
   */
  private failedFetches = new Map<string, { attempts: number; lastAttempt: number }>();

  /**
   * Hydration state
   */
  public isHydrated = $state(false);
  public isHydrating = $state(false);

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Hydrate entityStore with cached logos from IndexedDB
   *
   * Call this on app startup BEFORE rendering UI components.
   * Ensures cached logos are immediately available.
   */
  async hydrateFromIndexedDB(): Promise<void> {
    if (this.isHydrated || this.isHydrating) {
      return;
    }

    this.isHydrating = true;

    try {
      const cachedMetadata = await tokenRepository.getAllCachedTokens();

      // Upsert cached logos to entityStore
      for (const token of cachedMetadata) {
        if (token.logo && tokenRepository.isLogoFresh(token)) {
          entityStore.upsertToken({
            canisterId: token.canisterId,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            fee: token.fee,
            logo: token.logo,
          });
        }
      }

      this.isHydrated = true;
    } catch (error) {
      console.error('[TokenLogo] Failed to hydrate from IndexedDB:', error);
      // Don't throw - allow app to continue with network fetches
    } finally {
      this.isHydrating = false;
    }
  }

  /**
   * Get logo for a token (from entityStore, triggers fetch if missing)
   *
   * @param ledgerCanisterId - Token ledger canister ID
   * @returns Logo URL or null (check entityStore for reactive updates)
   */
  getLogo(ledgerCanisterId: string): string | null {
    const token = entityStore.getToken(ledgerCanisterId);

    if (token?.logo) {
      return token.logo;
    }

    // Trigger async fetch (will update entityStore reactively)
    this.fetchLogoAsync(ledgerCanisterId);
    return null;
  }

  /**
   * Prefetch all market logos in background
   *
   * Call after market discovery to cache logos for all tokens.
   * Logos are upserted to entityStore and cached in IndexedDB.
   *
   * @param markets - All markets from indexer
   */
  async prefetchAllLogos(markets: RawMarket[]): Promise<void> {

    const fetchPromises = markets.map(async (market) => {
      const ledgerCanisterId = market.base_token.toString();
      const tradingCanisterId = market.canister_id.toString();

      try {
        await this.fetchLogo(ledgerCanisterId, tradingCanisterId);
      } catch (error) {
        console.error(`[TokenLogo] Failed to prefetch logo for ${ledgerCanisterId}:`, error);
      }
    });

    await Promise.allSettled(fetchPromises);
  }

  /**
   * Force refresh logo for a token (bypasses cache)
   */
  async refreshLogo(ledgerCanisterId: string): Promise<string | null> {
    // Clear failure tracking
    this.failedFetches.delete(ledgerCanisterId);

    // Invalidate cache and refetch
    await tokenRepository.removeCachedToken(ledgerCanisterId);
    return this.fetchLogo(ledgerCanisterId);
  }

  /**
   * Clear all state (useful for testing)
   */
  clear(): void {
    this.fetchPromises.clear();
    this.failedFetches.clear();
    this.isHydrated = false;
  }

  // ==========================================================================
  // Private: Logo Fetching
  // ==========================================================================

  /**
   * Fetch logo asynchronously (non-blocking)
   * Deduplicated: prevents multiple fetches for same ledger canister
   */
  private fetchLogoAsync(ledgerCanisterId: string): void {
    // Check if we should skip due to recent failure
    const failure = this.failedFetches.get(ledgerCanisterId);
    if (failure) {
      const timeSinceLastAttempt = Date.now() - failure.lastAttempt;
      if (failure.attempts >= MAX_RETRIES || timeSinceLastAttempt < RETRY_DELAY_MS) {
        return; // Skip - too many retries or too soon
      }
    }

    if (!this.fetchPromises.has(ledgerCanisterId)) {
      const promise = this.fetchLogo(ledgerCanisterId)
        .finally(() => {
          this.fetchPromises.delete(ledgerCanisterId);
        });
      this.fetchPromises.set(ledgerCanisterId, promise);
    }
  }

  /**
   * Fetch logo with cache-first strategy
   *
   * Flow:
   * 1. Check IndexedDB cache via tokenRepository (7-day TTL)
   * 2. If fresh → upsert to entityStore, return
   * 3. If stale/missing → fetch from ICRC-1 ledger
   * 4. Cache via tokenRepository
   * 5. Upsert to entityStore
   *
   * @param ledgerCanisterId - Token ledger canister
   * @returns Logo data URL or null
   */
  private async fetchLogo(
    ledgerCanisterId: string,
    _tradingCanisterId?: string
  ): Promise<string | null> {
    try {
      // 1. Check IndexedDB cache via repository
      const cached = await tokenRepository.getCachedToken(ledgerCanisterId);

      if (cached?.logo && tokenRepository.isLogoFresh(cached)) {

        // Upsert to entityStore
        entityStore.upsertToken({
          canisterId: ledgerCanisterId,
          symbol: cached.symbol,
          name: cached.name,
          decimals: cached.decimals,
          fee: cached.fee,
          logo: cached.logo,
        });

        return cached.logo;
      }

      // 2. Cache miss or stale - fetch via repository (handles caching internally)
      const result = await tokenRepository.discoverToken(ledgerCanisterId, false);

      if ('err' in result) {
        throw new Error(result.err);
      }

      const tokenMetadata = result.ok;

      // 3. Upsert to entityStore
      entityStore.upsertToken({
        canisterId: ledgerCanisterId,
        symbol: tokenMetadata.symbol,
        name: tokenMetadata.name,
        decimals: tokenMetadata.decimals,
        fee: tokenMetadata.fee,
        logo: tokenMetadata.logo ?? null,
      });

      // Clear any failure tracking on success
      this.failedFetches.delete(ledgerCanisterId);

      if (!tokenMetadata.logo) {
        console.warn(`[TokenLogo] No logo in metadata: ${ledgerCanisterId}`);
        return null;
      }

      return tokenMetadata.logo;

    } catch (error) {
      console.error(`[TokenLogo] Failed to fetch: ${ledgerCanisterId}`, error);

      // Track failure for retry logic
      const existing = this.failedFetches.get(ledgerCanisterId);
      this.failedFetches.set(ledgerCanisterId, {
        attempts: (existing?.attempts ?? 0) + 1,
        lastAttempt: Date.now(),
      });

      return null;
    }
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const tokenLogoService = new TokenLogoService();
