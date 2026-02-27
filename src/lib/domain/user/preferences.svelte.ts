/**
 * User Preferences State
 *
 * Reactive domain state for user preferences.
 * Wraps storage layer with $state reactivity for Svelte components.
 *
 * ## Data Sources
 * - Global preferences (theme, etc): localStorage
 * - User-scoped simple prefs (recent markets): localStorage
 * - Token preferences (favorites, hidden): IndexedDB
 *
 * ## Usage
 * ```svelte
 * <script>
 *   import { userPreferences } from '$lib/domain/user';
 *
 *   // Read reactive state
 *   const theme = $derived(userPreferences.theme);
 *   const favorites = $derived(userPreferences.favoriteTokens);
 *
 *   // Actions
 *   function toggleTheme() {
 *     userPreferences.setTheme(theme === 'dark' ? 'light' : 'dark');
 *   }
 * </script>
 * ```
 */

import {
  globalPreferences,
  userScopedPreferences,
  userTokenPreferences,
  type Theme,
  type ChartStyle,
  type OrderBookStyle,
  type UserTokenPreferences,
  type RecentItem,
  type RecentItemType,
} from '$lib/repositories/storage';
import { user } from './auth.svelte';

// ============================================
// Re-export types
// ============================================

export type { Theme, ChartStyle, OrderBookStyle, RecentItem, RecentItemType };

// ============================================
// User Preferences State Class
// ============================================

class UserPreferencesState {
  // ============================================
  // Global Preferences (not user-scoped)
  // ============================================

  theme = $state<Theme>('dark');
  chartStyle = $state<ChartStyle>('candles');
  orderBookStyle = $state<OrderBookStyle>('grouped');
  soundEnabled = $state(false);
  notificationsEnabled = $state(true);
  compactMode = $state(false);
  showUsdValues = $state(true);
  defaultSlippage = $state(50); // basis points

  // ============================================
  // User-Scoped Preferences (localStorage)
  // ============================================

  recentMarkets = $state<string[]>([]);
  pinnedTokens = $state<string[]>([]);
  hiddenSmallBalances = $state(false);
  smallBalanceThreshold = $state(1);
  skipOrderConfirmation = $state(false);

  // ============================================
  // Token Preferences (IndexedDB)
  // ============================================

  favoriteTokens = $state<string[]>([]);
  hiddenTokens = $state<string[]>([]);
  customTokens = $state<string[]>([]);

  // ============================================
  // Market Preferences (localStorage)
  // ============================================

  favoriteMarkets = $state<string[]>([]); // Format: "canisterId:quoteToken"

  // ============================================
  // Recent Items (localStorage)
  // ============================================

  recentItems = $state<RecentItem[]>([]); // Last 5 accessed tokens/markets

  // ============================================
  // Loading State
  // ============================================

  isLoading = $state(false);
  isInitialized = $state(false);
  private lastPrincipal: string | null = null;

  // ============================================
  // Derived State
  // ============================================

  /**
   * Whether user is connected (has principal)
   */
  isConnected = $derived(!!user.principal);

  /**
   * Current principal text (for keying user-scoped data)
   */
  principalText = $derived(user.principalText);

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize preferences state
   * Loads from storage layers
   */
  initialize(): void {
    if (this.isLoading) return;

    this.isLoading = true;

    try {
      // Load global preferences (always available)
      this.loadGlobalPreferences();

      // Load user-scoped preferences (if connected)
      const principal = user.principalText;
      if (principal) {
        this.loadUserPreferences(principal);
        this.lastPrincipal = principal;
      }

      this.isInitialized = true;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Sync preferences when user changes (login/logout)
   */
  syncForUser(): void {
    const principal = user.principalText;

    // No change
    if (principal === this.lastPrincipal) return;

    // User logged out
    if (!principal) {
      this.clearUserPreferences();
      this.lastPrincipal = null;
      return;
    }

    // User changed or logged in
    this.loadUserPreferences(principal);
    this.lastPrincipal = principal;
  }

  // ============================================
  // Global Preferences Actions
  // ============================================

  setTheme(theme: Theme): void {
    this.theme = theme;
    globalPreferences.setTheme(theme);
  }

  setChartStyle(style: ChartStyle): void {
    this.chartStyle = style;
    globalPreferences.setChartStyle(style);
  }

  setOrderBookStyle(style: OrderBookStyle): void {
    this.orderBookStyle = style;
    globalPreferences.setOrderBookStyle(style);
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    globalPreferences.setSoundEnabled(enabled);
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.notificationsEnabled = enabled;
    globalPreferences.setNotificationsEnabled(enabled);
  }

  setCompactMode(enabled: boolean): void {
    this.compactMode = enabled;
    globalPreferences.setCompactMode(enabled);
  }

  setShowUsdValues(show: boolean): void {
    this.showUsdValues = show;
    globalPreferences.setShowUsdValues(show);
  }

  setDefaultSlippage(bps: number): void {
    this.defaultSlippage = bps;
    globalPreferences.setDefaultSlippage(bps);
  }

  // ============================================
  // User-Scoped Preferences Actions
  // ============================================

  addRecentMarket(marketId: string): void {
    const principal = user.principalText;
    if (!principal) return;

    // Update local state
    this.recentMarkets = [marketId, ...this.recentMarkets.filter((id) => id !== marketId)].slice(
      0,
      10
    );

    // Persist
    userScopedPreferences.addRecentMarket(principal, marketId);
  }

  clearRecentMarkets(): void {
    const principal = user.principalText;
    if (!principal) return;

    this.recentMarkets = [];
    userScopedPreferences.clearRecentMarkets(principal);
  }

  togglePinnedToken(tokenId: string): boolean {
    const principal = user.principalText;
    if (!principal) return false;

    const isPinned = this.pinnedTokens.includes(tokenId);
    this.pinnedTokens = isPinned
      ? this.pinnedTokens.filter((id) => id !== tokenId)
      : [...this.pinnedTokens, tokenId];

    userScopedPreferences.togglePinnedToken(principal, tokenId);
    return !isPinned;
  }

  setHiddenSmallBalances(hidden: boolean): void {
    const principal = user.principalText;
    if (!principal) return;

    this.hiddenSmallBalances = hidden;
    userScopedPreferences.setHiddenSmallBalances(principal, hidden);
  }

  setSmallBalanceThreshold(threshold: number): void {
    const principal = user.principalText;
    if (!principal) return;

    this.smallBalanceThreshold = threshold;
    userScopedPreferences.setSmallBalanceThreshold(principal, threshold);
  }

  setSkipOrderConfirmation(skip: boolean): void {
    const principal = user.principalText;
    if (!principal) return;

    this.skipOrderConfirmation = skip;
    userScopedPreferences.setSkipOrderConfirmation(principal, skip);
  }

  // ============================================
  // Token Preferences Actions (localStorage)
  // ============================================

  addFavorite(canisterId: string, isCustom: boolean = false): void {
    const principal = user.principalText;
    if (!principal) return;

    // Update local state
    if (!this.favoriteTokens.includes(canisterId)) {
      this.favoriteTokens = [...this.favoriteTokens, canisterId];
    }
    if (isCustom && !this.customTokens.includes(canisterId)) {
      this.customTokens = [...this.customTokens, canisterId];
    }

    // Persist
    userTokenPreferences.addFavorite(principal, canisterId, isCustom);
  }

  removeFavorite(canisterId: string): void {
    const principal = user.principalText;
    if (!principal) return;

    this.favoriteTokens = this.favoriteTokens.filter((id) => id !== canisterId);
    this.customTokens = this.customTokens.filter((id) => id !== canisterId);

    userTokenPreferences.removeFavorite(principal, canisterId);
  }

  toggleFavorite(canisterId: string, isCustom: boolean = false): boolean {
    const principal = user.principalText;
    if (!principal) return false;

    const isFavorite = this.favoriteTokens.includes(canisterId);

    if (isFavorite) {
      this.favoriteTokens = this.favoriteTokens.filter((id) => id !== canisterId);
      this.customTokens = this.customTokens.filter((id) => id !== canisterId);
    } else {
      this.favoriteTokens = [...this.favoriteTokens, canisterId];
      if (isCustom) {
        this.customTokens = [...this.customTokens, canisterId];
      }
    }

    userTokenPreferences.toggleFavorite(principal, canisterId, isCustom);
    return !isFavorite;
  }

  isFavorite(canisterId: string): boolean {
    return this.favoriteTokens.includes(canisterId);
  }

  isCustomToken(canisterId: string): boolean {
    return this.customTokens.includes(canisterId);
  }

  hideToken(canisterId: string): void {
    const principal = user.principalText;
    if (!principal) return;

    if (!this.hiddenTokens.includes(canisterId)) {
      this.hiddenTokens = [...this.hiddenTokens, canisterId];
    }

    userTokenPreferences.hideToken(principal, canisterId);
  }

  unhideToken(canisterId: string): void {
    const principal = user.principalText;
    if (!principal) return;

    this.hiddenTokens = this.hiddenTokens.filter((id) => id !== canisterId);
    userTokenPreferences.unhideToken(principal, canisterId);
  }

  toggleHidden(canisterId: string): boolean {
    const principal = user.principalText;
    if (!principal) return false;

    const isHidden = this.hiddenTokens.includes(canisterId);

    if (isHidden) {
      this.hiddenTokens = this.hiddenTokens.filter((id) => id !== canisterId);
    } else {
      this.hiddenTokens = [...this.hiddenTokens, canisterId];
    }

    userTokenPreferences.toggleHidden(principal, canisterId);
    return !isHidden;
  }

  isHidden(canisterId: string): boolean {
    return this.hiddenTokens.includes(canisterId);
  }

  // ============================================
  // Market Preferences Actions (localStorage)
  // ============================================

  /**
   * Create market ID from canister ID and quote token
   */
  makeMarketId(canisterId: string, quoteToken: string): string {
    return userTokenPreferences.makeMarketId(canisterId, quoteToken);
  }

  /**
   * Parse market ID into components
   */
  parseMarketId(marketId: string): { canisterId: string; quoteToken: string } | null {
    return userTokenPreferences.parseMarketId(marketId);
  }

  addFavoriteMarket(canisterId: string, quoteToken: string): void {
    const principal = user.principalText;
    if (!principal) return;

    const marketId = this.makeMarketId(canisterId, quoteToken);
    if (!this.favoriteMarkets.includes(marketId)) {
      this.favoriteMarkets = [...this.favoriteMarkets, marketId];
    }

    userTokenPreferences.addFavoriteMarket(principal, canisterId, quoteToken);
  }

  removeFavoriteMarket(canisterId: string, quoteToken: string): void {
    const principal = user.principalText;
    if (!principal) return;

    const marketId = this.makeMarketId(canisterId, quoteToken);
    this.favoriteMarkets = this.favoriteMarkets.filter((id) => id !== marketId);

    userTokenPreferences.removeFavoriteMarket(principal, canisterId, quoteToken);
  }

  toggleFavoriteMarket(canisterId: string, quoteToken: string): boolean {
    const principal = user.principalText;
    if (!principal) return false;

    const marketId = this.makeMarketId(canisterId, quoteToken);
    const isFavorite = this.favoriteMarkets.includes(marketId);

    if (isFavorite) {
      this.favoriteMarkets = this.favoriteMarkets.filter((id) => id !== marketId);
    } else {
      this.favoriteMarkets = [...this.favoriteMarkets, marketId];
    }

    userTokenPreferences.toggleFavoriteMarket(principal, canisterId, quoteToken);
    return !isFavorite;
  }

  isFavoriteMarket(canisterId: string, quoteToken: string): boolean {
    return userTokenPreferences.isFavoriteMarket(this.favoriteMarkets, canisterId, quoteToken);
  }

  // ============================================
  // Recent Items Actions (localStorage)
  // Used for the unified "Recent" section in search
  // ============================================

  /**
   * Track a token access (for search recents)
   */
  trackRecentToken(canisterId: string): void {
    const principal = user.principalText;
    if (!principal) return;

    // Update local state - remove existing, add to front, limit to 5
    const filtered = this.recentItems.filter(
      (item) => !(item.type === 'token' && item.id === canisterId)
    );
    const newItem: RecentItem = { type: 'token', id: canisterId, timestamp: Date.now() };
    this.recentItems = [newItem, ...filtered].slice(0, 5);

    // Persist
    userTokenPreferences.addRecentToken(principal, canisterId);
  }

  /**
   * Track a market access (for search recents)
   */
  trackRecentMarket(canisterId: string, quoteToken: string): void {
    const principal = user.principalText;
    if (!principal) return;

    const marketId = this.makeMarketId(canisterId, quoteToken);

    // Update local state - remove existing, add to front, limit to 5
    const filtered = this.recentItems.filter(
      (item) => !(item.type === 'market' && item.id === marketId)
    );
    const newItem: RecentItem = { type: 'market', id: marketId, timestamp: Date.now() };
    this.recentItems = [newItem, ...filtered].slice(0, 5);

    // Persist
    userTokenPreferences.addRecentMarket(principal, canisterId, quoteToken);
  }

  /**
   * Clear all recent items (search recents)
   */
  clearRecentItems(): void {
    const principal = user.principalText;
    if (!principal) return;

    this.recentItems = [];
    userTokenPreferences.clearRecents(principal);
  }

  // ============================================
  // Internal Helpers
  // ============================================

  private loadGlobalPreferences(): void {
    const prefs = globalPreferences.getAll();
    this.theme = prefs.theme;
    this.chartStyle = prefs.chartStyle;
    this.orderBookStyle = prefs.orderBookStyle;
    this.soundEnabled = prefs.soundEnabled;
    this.notificationsEnabled = prefs.notificationsEnabled;
    this.compactMode = prefs.compactMode;
    this.showUsdValues = prefs.showUsdValues;
    this.defaultSlippage = prefs.defaultSlippage;
  }

  private loadUserPreferences(principal: string): void {
    // Load localStorage preferences (user-scoped simple prefs)
    const scoped = userScopedPreferences.getAll(principal);
    this.recentMarkets = scoped.recentMarkets;
    this.pinnedTokens = scoped.pinnedTokens;
    this.hiddenSmallBalances = scoped.hiddenSmallBalances;
    this.smallBalanceThreshold = scoped.smallBalanceThreshold;
    this.skipOrderConfirmation = scoped.skipOrderConfirmation;

    // Load localStorage preferences (token/market favorites + recents)
    const tokenPrefs = userTokenPreferences.load(principal);
    this.favoriteTokens = tokenPrefs.favoriteTokens;
    this.hiddenTokens = tokenPrefs.hiddenTokens;
    this.customTokens = tokenPrefs.customTokens;
    this.favoriteMarkets = tokenPrefs.favoriteMarkets;
    this.recentItems = tokenPrefs.recentItems;
  }

  private clearUserPreferences(): void {
    this.recentMarkets = [];
    this.pinnedTokens = [];
    this.hiddenSmallBalances = false;
    this.smallBalanceThreshold = 1;
    this.skipOrderConfirmation = false;
    this.favoriteTokens = [];
    this.hiddenTokens = [];
    this.customTokens = [];
    this.favoriteMarkets = [];
    this.recentItems = [];
  }

  // ============================================
  // Reset
  // ============================================

  /**
   * Reset all preferences to defaults
   */
  resetAll(): void {
    // Reset global
    globalPreferences.reset();
    this.loadGlobalPreferences();

    // Reset user-scoped
    const principal = user.principalText;
    if (principal) {
      userScopedPreferences.reset(principal);
      userTokenPreferences.clear(principal);
      this.loadUserPreferences(principal);
    }

  }

  // ============================================
  // Debug
  // ============================================

  getDebugState() {
    return {
      global: {
        theme: this.theme,
        chartStyle: this.chartStyle,
        orderBookStyle: this.orderBookStyle,
        soundEnabled: this.soundEnabled,
        notificationsEnabled: this.notificationsEnabled,
        compactMode: this.compactMode,
        showUsdValues: this.showUsdValues,
        defaultSlippage: this.defaultSlippage,
      },
      userScoped: {
        recentMarkets: this.recentMarkets,
        pinnedTokens: this.pinnedTokens,
        hiddenSmallBalances: this.hiddenSmallBalances,
        smallBalanceThreshold: this.smallBalanceThreshold,
      },
      tokenPrefs: {
        favoriteTokens: this.favoriteTokens,
        hiddenTokens: this.hiddenTokens,
        customTokens: this.customTokens,
        favoriteMarkets: this.favoriteMarkets,
        recentItems: this.recentItems,
      },
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const userPreferences = new UserPreferencesState();

// Development helper
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).userPreferences = userPreferences;
}
