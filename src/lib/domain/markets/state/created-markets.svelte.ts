/**
 * Created Markets State Management
 *
 * Tracks spot markets created by the current user via the registry's creations endpoint.
 * Singleton state — load() fetches from registry, filters to completed spot_market entries.
 */

import { api } from '$lib/actors/api.svelte';
import type { FrozenCreationEntry } from 'declarations/registry/registry.did';

export interface CreatedMarketEntry {
  id: bigint;
  symbol: string;
  canisterId: string;
  startedAt: bigint;
  updatedAt: bigint;
}

class CreatedMarketsState {
  markets: CreatedMarketEntry[] = $state([]);
  isLoading: boolean = $state(false);
  error: string = $state('');
  hasFetched: boolean = $state(false);

  isEmpty = $derived(this.hasFetched && this.markets.length === 0);
  count = $derived(this.markets.length);

  /**
   * Load markets created by the current user from the registry.
   * Fetches creations and filters to completed spot market entries.
   */
  async load(): Promise<void> {
    if (!api.registry) return;

    this.isLoading = true;
    this.error = '';

    try {
      const entries: FrozenCreationEntry[] = await api.registry.get_creations();

      this.markets = entries
        .filter(
          (entry) =>
            'spot_market' in entry.creation_type && 'completed' in entry.phase
        )
        .map((entry) => {
          let canisterId = '';
          const result = entry.result[0];
          if (result && 'ok' in result) {
            canisterId = result.ok.toText();
          }

          return {
            id: entry.id,
            symbol: entry.symbol,
            canisterId,
            startedAt: entry.started_at,
            updatedAt: entry.updated_at,
          };
        });

      this.hasFetched = true;
    } catch (err) {
      console.error('[CreatedMarkets] Failed to load:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load your markets';
    } finally {
      this.isLoading = false;
    }
  }

  reset(): void {
    this.markets = [];
    this.isLoading = false;
    this.error = '';
    this.hasFetched = false;
  }
}

export const createdMarkets = new CreatedMarketsState();
