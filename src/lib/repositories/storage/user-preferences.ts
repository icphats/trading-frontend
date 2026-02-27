/**
 * User Token Preferences (localStorage)
 *
 * Stores user-specific token/market preferences:
 * - Favorite tokens
 * - Hidden tokens
 * - Custom tokens (user-discovered via canister ID)
 * - Favorite markets
 * - Recent items (last 5 accessed tokens/markets)
 *
 * Uses localStorage for reliable persistence.
 * Data is small (arrays of canister ID strings) - well within 5MB limit.
 */

// ============================================
// Types
// ============================================

export type RecentItemType = 'token' | 'market';

export interface RecentItem {
  type: RecentItemType;
  id: string; // canister ID for tokens, "canisterId:quoteToken" for markets
  timestamp: number;
}

export interface UserTokenPreferences {
  favoriteTokens: string[]; // canister IDs
  hiddenTokens: string[]; // canister IDs
  customTokens: string[]; // tokens added via canister ID (subset of favorites)
  favoriteMarkets: string[]; // market IDs in format "canisterId:quoteToken"
  recentItems: RecentItem[]; // last 5 accessed items, newest first
}

// ============================================
// Helpers
// ============================================

const STORAGE_KEY_PREFIX = 'token_prefs:';

const makeKey = (principal: string) => `${STORAGE_KEY_PREFIX}${principal}`;

const MAX_RECENT_ITEMS = 5;

const DEFAULT_PREFERENCES: UserTokenPreferences = {
  favoriteTokens: [],
  hiddenTokens: [],
  customTokens: [],
  favoriteMarkets: [],
  recentItems: [],
};

// ============================================
// User Token Preferences Repository
// ============================================

export const userTokenPreferences = {
  /**
   * Load preferences for a principal
   */
  load(principal: string): UserTokenPreferences {
    try {
      const stored = localStorage.getItem(makeKey(principal));
      if (!stored) return { ...DEFAULT_PREFERENCES };

      const parsed = JSON.parse(stored);
      // Merge with defaults to handle missing fields
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
      };
    } catch (error) {
      console.error('[UserTokenPreferences] Failed to load:', error);
      return { ...DEFAULT_PREFERENCES };
    }
  },

  /**
   * Save preferences for a principal
   */
  save(principal: string, prefs: UserTokenPreferences): void {
    try {
      const data: UserTokenPreferences = {
        favoriteTokens: [...prefs.favoriteTokens],
        hiddenTokens: [...prefs.hiddenTokens],
        customTokens: [...prefs.customTokens],
        favoriteMarkets: [...(prefs.favoriteMarkets ?? [])],
        recentItems: [...(prefs.recentItems ?? [])],
      };
      localStorage.setItem(makeKey(principal), JSON.stringify(data));
    } catch (error) {
      console.error('[UserTokenPreferences] Failed to save:', error);
    }
  },

  /**
   * Add a token to favorites
   */
  addFavorite(principal: string, canisterId: string, isCustom: boolean = false): void {
    const prefs = this.load(principal);

    if (!prefs.favoriteTokens.includes(canisterId)) {
      prefs.favoriteTokens = [...prefs.favoriteTokens, canisterId];
    }

    if (isCustom && !prefs.customTokens.includes(canisterId)) {
      prefs.customTokens = [...prefs.customTokens, canisterId];
    }

    this.save(principal, prefs);
  },

  /**
   * Remove a token from favorites
   */
  removeFavorite(principal: string, canisterId: string): void {
    const prefs = this.load(principal);

    prefs.favoriteTokens = prefs.favoriteTokens.filter((id) => id !== canisterId);
    prefs.customTokens = prefs.customTokens.filter((id) => id !== canisterId);

    this.save(principal, prefs);
  },

  /**
   * Toggle favorite status
   * Returns new favorite state
   */
  toggleFavorite(principal: string, canisterId: string, isCustom: boolean = false): boolean {
    const prefs = this.load(principal);
    const isFavorite = prefs.favoriteTokens.includes(canisterId);

    if (isFavorite) {
      prefs.favoriteTokens = prefs.favoriteTokens.filter((id) => id !== canisterId);
      prefs.customTokens = prefs.customTokens.filter((id) => id !== canisterId);
    } else {
      prefs.favoriteTokens = [...prefs.favoriteTokens, canisterId];
      if (isCustom) {
        prefs.customTokens = [...prefs.customTokens, canisterId];
      }
    }

    this.save(principal, prefs);
    return !isFavorite;
  },

  /**
   * Hide a token from display
   */
  hideToken(principal: string, canisterId: string): void {
    const prefs = this.load(principal);

    if (!prefs.hiddenTokens.includes(canisterId)) {
      prefs.hiddenTokens = [...prefs.hiddenTokens, canisterId];
    }

    this.save(principal, prefs);
  },

  /**
   * Unhide a token
   */
  unhideToken(principal: string, canisterId: string): void {
    const prefs = this.load(principal);
    prefs.hiddenTokens = prefs.hiddenTokens.filter((id) => id !== canisterId);
    this.save(principal, prefs);
  },

  /**
   * Toggle hidden status
   * Returns new hidden state
   */
  toggleHidden(principal: string, canisterId: string): boolean {
    const prefs = this.load(principal);
    const isHidden = prefs.hiddenTokens.includes(canisterId);

    if (isHidden) {
      prefs.hiddenTokens = prefs.hiddenTokens.filter((id) => id !== canisterId);
    } else {
      prefs.hiddenTokens = [...prefs.hiddenTokens, canisterId];
    }

    this.save(principal, prefs);
    return !isHidden;
  },

  /**
   * Clear all preferences for a principal
   */
  clear(principal: string): void {
    try {
      localStorage.removeItem(makeKey(principal));
    } catch (error) {
      console.error('[UserTokenPreferences] Failed to clear:', error);
    }
  },

  // ============================================
  // Market Favorites
  // ============================================

  /**
   * Create market ID from canister ID and quote token
   * Format: "canisterId:quoteToken" (e.g., "abc123-...:icp")
   */
  makeMarketId(canisterId: string, quoteToken: string): string {
    return `${canisterId}:${quoteToken.toLowerCase()}`;
  },

  /**
   * Parse market ID into components
   */
  parseMarketId(marketId: string): { canisterId: string; quoteToken: string } | null {
    const parts = marketId.split(':');
    if (parts.length !== 2) return null;
    return { canisterId: parts[0], quoteToken: parts[1] };
  },

  /**
   * Add a market to favorites
   */
  addFavoriteMarket(principal: string, canisterId: string, quoteToken: string): void {
    const prefs = this.load(principal);
    const marketId = this.makeMarketId(canisterId, quoteToken);

    if (!prefs.favoriteMarkets.includes(marketId)) {
      prefs.favoriteMarkets = [...prefs.favoriteMarkets, marketId];
    }

    this.save(principal, prefs);
  },

  /**
   * Remove a market from favorites
   */
  removeFavoriteMarket(principal: string, canisterId: string, quoteToken: string): void {
    const prefs = this.load(principal);
    const marketId = this.makeMarketId(canisterId, quoteToken);

    prefs.favoriteMarkets = prefs.favoriteMarkets.filter((id) => id !== marketId);
    this.save(principal, prefs);
  },

  /**
   * Toggle market favorite status
   * Returns new favorite state
   */
  toggleFavoriteMarket(principal: string, canisterId: string, quoteToken: string): boolean {
    const prefs = this.load(principal);
    const marketId = this.makeMarketId(canisterId, quoteToken);
    const isFavorite = prefs.favoriteMarkets.includes(marketId);

    if (isFavorite) {
      prefs.favoriteMarkets = prefs.favoriteMarkets.filter((id) => id !== marketId);
    } else {
      prefs.favoriteMarkets = [...prefs.favoriteMarkets, marketId];
    }

    this.save(principal, prefs);
    return !isFavorite;
  },

  /**
   * Check if a market is favorited
   */
  isFavoriteMarket(favoriteMarkets: string[], canisterId: string, quoteToken: string): boolean {
    const marketId = `${canisterId}:${quoteToken.toLowerCase()}`;
    return favoriteMarkets.includes(marketId);
  },

  // ============================================
  // Recent Items
  // ============================================

  /**
   * Add an item to recent history
   * - Removes duplicates (same type + id)
   * - Maintains max 5 items, newest first
   */
  addRecent(principal: string, type: RecentItemType, id: string): void {
    const prefs = this.load(principal);

    // Remove existing entry for this item (if any)
    const filtered = prefs.recentItems.filter(
      (item) => !(item.type === type && item.id === id)
    );

    // Add new entry at the front
    const newItem: RecentItem = {
      type,
      id,
      timestamp: Date.now(),
    };

    // Keep only the most recent MAX_RECENT_ITEMS
    prefs.recentItems = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);

    this.save(principal, prefs);
  },

  /**
   * Add a token to recent history
   */
  addRecentToken(principal: string, canisterId: string): void {
    this.addRecent(principal, 'token', canisterId);
  },

  /**
   * Add a market to recent history
   */
  addRecentMarket(principal: string, canisterId: string, quoteToken: string): void {
    const marketId = this.makeMarketId(canisterId, quoteToken);
    this.addRecent(principal, 'market', marketId);
  },

  /**
   * Get recent items
   */
  getRecents(principal: string): RecentItem[] {
    const prefs = this.load(principal);
    return prefs.recentItems;
  },

  /**
   * Clear all recent items
   */
  clearRecents(principal: string): void {
    const prefs = this.load(principal);
    prefs.recentItems = [];
    this.save(principal, prefs);
  },
};
