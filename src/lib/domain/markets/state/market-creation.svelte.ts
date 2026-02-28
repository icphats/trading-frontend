/**
 * Market Creation State Management
 * Manages spot market creation flow
 */

import type { TokenMetadata } from '$lib/repositories/token.repository';
import { indexerRepository } from '$lib/repositories/indexer.repository';

class MarketCreationState {
  // Token selection
  selectedToken = $state<TokenMetadata | null>(null);
  selectedQuoteToken = $state<TokenMetadata | null>(null);

  // Created market info
  marketCanisterId = $state<string>('');

  // Market existence check
  marketExists = $state<boolean>(false);
  checkingMarketExists = $state<boolean>(false);

  // Derived validations
  isSameToken = $derived.by(() => {
    if (!this.selectedToken || !this.selectedQuoteToken) return false;
    return this.selectedToken.canisterId === this.selectedQuoteToken.canisterId;
  });

  step1Valid = $derived.by(() => {
    return (
      this.selectedToken !== null &&
      this.selectedQuoteToken !== null &&
      !this.isSameToken &&
      !this.marketExists &&
      !this.checkingMarketExists
    );
  });

  step1Error = $derived.by((): string | null => {
    if (this.isSameToken) return 'Base and quote token cannot be the same.';
    if (this.marketExists) return 'A market for this token pair already exists.';
    return null;
  });

  /** Check if market already exists for the current pair */
  async checkMarketExists() {
    if (!this.selectedToken || !this.selectedQuoteToken || this.isSameToken) {
      this.marketExists = false;
      return;
    }

    this.checkingMarketExists = true;
    try {
      const result = await indexerRepository.getMarketByPair(
        this.selectedToken.canisterId,
        this.selectedQuoteToken.canisterId,
        false // skip cache for fresh check
      );
      this.marketExists = 'ok' in result && result.ok !== null;
    } catch {
      // If the check fails, don't block — let the backend handle it
      this.marketExists = false;
    } finally {
      this.checkingMarketExists = false;
    }
  }

  // Reset state
  reset() {
    this.selectedToken = null;
    this.selectedQuoteToken = null;
    this.marketCanisterId = '';
    this.marketExists = false;
    this.checkingMarketExists = false;
  }
}

// Export singleton instance
export const marketCreation = new MarketCreationState();
