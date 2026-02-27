/**
 * Identity Change Cleanup
 *
 * Centralized handler for clearing user-scoped state on identity change.
 * Called by auth.svelte.ts via the identity-events system.
 *
 * This module registers a callback that runs when:
 * - User logs out
 * - User logs in (as different user)
 * - User switches identity
 *
 * The callback clears all in-memory user state while preserving:
 * - localStorage data (correctly scoped by principal)
 * - Public market data (tick, orderbook, etc.)
 */

import { onIdentityChange } from './identity-events';
import { userPortfolio } from './user-portfolio.svelte';
import { userPreferences } from './preferences.svelte';
import { marketRegistry } from '$lib/domain/markets/state/market-registry.svelte';

/**
 * Clear all user-scoped domain state.
 * Called on login/logout/identity switch.
 */
function clearAllUserState(): void {
  // Clear portfolio balances, holdings, and spot market data from memory
  // Also clears entityStore user data (single source of truth)
  // (localStorage is user-scoped, will load correct data on next initialize)
  userPortfolio.reset();

  // Sync preferences for new user
  // (loads from correct localStorage keys based on new principal)
  userPreferences.syncForUser();

  // Clear user orders/triggers from all markets (SpotMarket instances)
  marketRegistry.clearAllUserData();
}

// Register with identity events system
onIdentityChange(clearAllUserState);
