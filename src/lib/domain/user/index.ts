/**
 * User Domain Public API
 *
 * Exports user-specific state management for tokens and portfolios.
 */

// Register identity change cleanup (side-effect import)
// Must be imported before other modules to ensure cleanup runs on identity change
import './identity-cleanup';

// Auth state (identity, principal, agent)
export { user, User } from './auth.svelte';

// User preferences (theme, favorites, hidden tokens, etc.)
export { userPreferences } from './preferences.svelte';
export type { Theme, ChartStyle, OrderBookStyle } from './preferences.svelte';

// User portfolio (token holdings + spot market positions/orders/triggers)
export { userPortfolio } from './user-portfolio.svelte';
export type { PortfolioToken, PortfolioBalance, PortfolioPool } from './user-portfolio.svelte';
