/**
 * Created Tokens State Management
 *
 * Tracks tokens created by the current user via the registry's creations endpoint.
 * Singleton state — load() fetches from registry, addToken() for optimistic updates.
 */

import { api } from '$lib/actors/api.svelte';
import { discoverTokens, discoverToken } from '$lib/domain/orchestration/token-discovery';
import type { FrozenCreationEntry } from 'declarations/registry/registry.did';
import type { NormalizedToken } from '$lib/types/entity.types';

class CreatedTokensState {
  tokens: NormalizedToken[] = $state([]);
  isLoading: boolean = $state(false);
  error: string = $state('');
  hasFetched: boolean = $state(false);

  isEmpty = $derived(this.hasFetched && this.tokens.length === 0);
  count = $derived(this.tokens.length);

  /**
   * Load tokens created by the current user from the registry.
   * Fetches creations, filters to completed ledger entries, then discovers metadata.
   */
  async load(): Promise<void> {
    if (!api.registry) return;

    this.isLoading = true;
    this.error = '';

    try {
      const entries: FrozenCreationEntry[] = await api.registry.get_creations();

      const canisterIds = entries
        .filter(
          (entry) =>
            'ledger' in entry.creation_type && 'completed' in entry.phase
        )
        .map((entry) => {
          const result = entry.result[0];
          if (result && 'ok' in result) return result.ok.toText();
          return '';
        })
        .filter((id) => id !== '');

      if (canisterIds.length > 0) {
        this.tokens = await discoverTokens(canisterIds);
      } else {
        this.tokens = [];
      }

      this.hasFetched = true;
    } catch (err) {
      console.error('[CreatedTokens] Failed to load:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load your tokens';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Optimistically prepend a freshly created token without re-fetching.
   */
  addToken(token: NormalizedToken): void {
    this.tokens = [token, ...this.tokens];
  }

  reset(): void {
    this.tokens = [];
    this.isLoading = false;
    this.error = '';
    this.hasFetched = false;
  }
}

export const createdTokens = new CreatedTokensState();
