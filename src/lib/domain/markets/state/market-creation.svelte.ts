/**
 * Market Creation State Management
 * Manages spot market creation flow
 */

import type { TokenMetadata } from '$lib/repositories/token.repository';

class MarketCreationState {
  // Token selection
  selectedToken = $state<TokenMetadata | null>(null);
  selectedQuoteToken = $state<TokenMetadata | null>(null);

  // Created market info
  marketCanisterId = $state<string>('');

  // Validation
  step1Valid = $derived.by(() => {
    return this.selectedToken !== null && this.selectedQuoteToken !== null;
  });

  // Reset state
  reset() {
    this.selectedToken = null;
    this.selectedQuoteToken = null;
    this.marketCanisterId = '';
  }
}

// Export singleton instance
export const marketCreation = new MarketCreationState();
