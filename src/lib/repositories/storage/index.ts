/**
 * Storage Layer
 *
 * Abstracts persistence details from domain layer.
 *
 * ## Storage Types
 *
 * - **localStorage** (local-storage.ts): Simple key-value preferences
 *   - Global: theme, chart style, slippage
 *   - User-scoped: recent markets, pinned tokens, holdings list
 *
 * - **IndexedDB** (user-preferences.ts): Complex/large user data
 *   - Favorite tokens (can grow large)
 *   - Hidden tokens
 *   - Custom discovered tokens
 *
 * ## Usage
 *
 * ```typescript
 * // Global preferences (not user-scoped)
 * import { globalPreferences } from '$lib/repositories/storage';
 * const theme = globalPreferences.getTheme();
 *
 * // User-scoped simple preferences
 * import { userScopedPreferences } from '$lib/repositories/storage';
 * const recentMarkets = userScopedPreferences.getRecentMarkets(principal);
 *
 * // User token preferences (IndexedDB)
 * import { userTokenPreferences } from '$lib/repositories/storage';
 * await userTokenPreferences.addFavorite(principal, canisterId);
 * ```
 */

// localStorage abstractions
export {
  globalPreferences,
  userScopedPreferences,
  type Theme,
  type ChartStyle,
  type OrderBookStyle,
  type GlobalPreferences,
  type UserScopedPreferences,
} from './local-storage';

// User preferences (localStorage)
export {
  userTokenPreferences,
  type UserTokenPreferences,
  type RecentItem,
  type RecentItemType,
} from './user-preferences';
