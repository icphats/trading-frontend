/**
 * LocalStorage Abstraction
 *
 * Type-safe localStorage wrapper for simple user preferences.
 * For complex data structures, use IndexedDB via user-preferences.ts
 *
 * Key Patterns:
 * - Global preferences: `pref:${key}`
 * - User-scoped preferences: `user:${principal}:${key}`
 */

// ============================================
// Types
// ============================================

export type Theme = 'light' | 'dark' | 'system';
export type ChartStyle = 'candles' | 'line' | 'area';
export type OrderBookStyle = 'grouped' | 'detailed';

export interface GlobalPreferences {
  theme: Theme;
  chartStyle: ChartStyle;
  orderBookStyle: OrderBookStyle;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  compactMode: boolean;
  showUsdValues: boolean;
  defaultSlippage: number; // basis points
  recentWalletId: string | null; // Last used wallet for login
}

export interface UserScopedPreferences {
  recentMarkets: string[]; // Last 10 visited market IDs
  pinnedTokens: string[]; // Pinned to top of portfolio
  hiddenSmallBalances: boolean; // Hide tokens < $1
  smallBalanceThreshold: number; // USD threshold
  skipOrderConfirmation: boolean; // Skip confirmation modal for orders
}

// ============================================
// Default Values
// ============================================

const DEFAULT_GLOBAL: GlobalPreferences = {
  theme: 'dark',
  chartStyle: 'candles',
  orderBookStyle: 'grouped',
  soundEnabled: false,
  notificationsEnabled: true,
  compactMode: false,
  showUsdValues: true,
  defaultSlippage: 50, // 0.5%
  recentWalletId: null,
};

const DEFAULT_USER_SCOPED: UserScopedPreferences = {
  recentMarkets: [],
  pinnedTokens: [],
  hiddenSmallBalances: false,
  smallBalanceThreshold: 1,
  skipOrderConfirmation: false,
};

// ============================================
// Storage Keys
// ============================================

const KEYS = {
  // Global (not user-scoped)
  theme: 'pref:theme',
  chartStyle: 'pref:chartStyle',
  orderBookStyle: 'pref:orderBookStyle',
  soundEnabled: 'pref:soundEnabled',
  notificationsEnabled: 'pref:notificationsEnabled',
  compactMode: 'pref:compactMode',
  showUsdValues: 'pref:showUsdValues',
  defaultSlippage: 'pref:defaultSlippage',
  recentWalletId: 'pref:recentWalletId',

  // User-scoped (keyed by principal)
  recentMarkets: (principal: string) => `user:${principal}:recentMarkets`,
  pinnedTokens: (principal: string) => `user:${principal}:pinnedTokens`,
  hiddenSmallBalances: (principal: string) => `user:${principal}:hiddenSmallBalances`,
  smallBalanceThreshold: (principal: string) => `user:${principal}:smallBalanceThreshold`,
  skipOrderConfirmation: (principal: string) => `user:${principal}:skipOrderConfirmation`,

  // Legacy keys (for migration)
  holdings: (principal: string) => `user:${principal}:holdings`,
  legacyHoldings: 'user_token_holdings', // Old non-scoped key
} as const;

// ============================================
// Internal Helpers
// ============================================

function isAvailable(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function getItem<T>(key: string, defaultValue: T): T {
  if (!isAvailable()) return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (!isAvailable()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[localStorage] Failed to save:', key, error);
  }
}

function removeItem(key: string): void {
  if (!isAvailable()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

// ============================================
// Global Preferences API
// ============================================

export const globalPreferences = {
  // Theme
  getTheme: (): Theme => getItem(KEYS.theme, DEFAULT_GLOBAL.theme),
  setTheme: (theme: Theme) => setItem(KEYS.theme, theme),

  // Chart Style
  getChartStyle: (): ChartStyle => getItem(KEYS.chartStyle, DEFAULT_GLOBAL.chartStyle),
  setChartStyle: (style: ChartStyle) => setItem(KEYS.chartStyle, style),

  // Order Book Style
  getOrderBookStyle: (): OrderBookStyle =>
    getItem(KEYS.orderBookStyle, DEFAULT_GLOBAL.orderBookStyle),
  setOrderBookStyle: (style: OrderBookStyle) => setItem(KEYS.orderBookStyle, style),

  // Sound
  getSoundEnabled: (): boolean => getItem(KEYS.soundEnabled, DEFAULT_GLOBAL.soundEnabled),
  setSoundEnabled: (enabled: boolean) => setItem(KEYS.soundEnabled, enabled),

  // Notifications
  getNotificationsEnabled: (): boolean =>
    getItem(KEYS.notificationsEnabled, DEFAULT_GLOBAL.notificationsEnabled),
  setNotificationsEnabled: (enabled: boolean) => setItem(KEYS.notificationsEnabled, enabled),

  // Compact Mode
  getCompactMode: (): boolean => getItem(KEYS.compactMode, DEFAULT_GLOBAL.compactMode),
  setCompactMode: (enabled: boolean) => setItem(KEYS.compactMode, enabled),

  // USD Values
  getShowUsdValues: (): boolean => getItem(KEYS.showUsdValues, DEFAULT_GLOBAL.showUsdValues),
  setShowUsdValues: (show: boolean) => setItem(KEYS.showUsdValues, show),

  // Slippage
  getDefaultSlippage: (): number => getItem(KEYS.defaultSlippage, DEFAULT_GLOBAL.defaultSlippage),
  setDefaultSlippage: (bps: number) => setItem(KEYS.defaultSlippage, bps),

  // Recent Wallet (for login)
  getRecentWalletId: (): string | null => getItem(KEYS.recentWalletId, DEFAULT_GLOBAL.recentWalletId),
  setRecentWalletId: (walletId: string | null) => setItem(KEYS.recentWalletId, walletId),

  // Bulk get/set
  getAll: (): GlobalPreferences => ({
    theme: globalPreferences.getTheme(),
    chartStyle: globalPreferences.getChartStyle(),
    orderBookStyle: globalPreferences.getOrderBookStyle(),
    soundEnabled: globalPreferences.getSoundEnabled(),
    notificationsEnabled: globalPreferences.getNotificationsEnabled(),
    compactMode: globalPreferences.getCompactMode(),
    showUsdValues: globalPreferences.getShowUsdValues(),
    defaultSlippage: globalPreferences.getDefaultSlippage(),
    recentWalletId: globalPreferences.getRecentWalletId(),
  }),

  setAll: (prefs: Partial<GlobalPreferences>) => {
    if (prefs.theme !== undefined) globalPreferences.setTheme(prefs.theme);
    if (prefs.chartStyle !== undefined) globalPreferences.setChartStyle(prefs.chartStyle);
    if (prefs.orderBookStyle !== undefined) globalPreferences.setOrderBookStyle(prefs.orderBookStyle);
    if (prefs.soundEnabled !== undefined) globalPreferences.setSoundEnabled(prefs.soundEnabled);
    if (prefs.notificationsEnabled !== undefined)
      globalPreferences.setNotificationsEnabled(prefs.notificationsEnabled);
    if (prefs.compactMode !== undefined) globalPreferences.setCompactMode(prefs.compactMode);
    if (prefs.showUsdValues !== undefined) globalPreferences.setShowUsdValues(prefs.showUsdValues);
    if (prefs.defaultSlippage !== undefined)
      globalPreferences.setDefaultSlippage(prefs.defaultSlippage);
    if (prefs.recentWalletId !== undefined)
      globalPreferences.setRecentWalletId(prefs.recentWalletId);
  },

  reset: () => {
    globalPreferences.setAll(DEFAULT_GLOBAL);
  },
};

// ============================================
// User-Scoped Preferences API
// ============================================

export const userScopedPreferences = {
  // Recent Markets
  getRecentMarkets: (principal: string): string[] =>
    getItem(KEYS.recentMarkets(principal), DEFAULT_USER_SCOPED.recentMarkets),

  addRecentMarket: (principal: string, marketId: string) => {
    const current = userScopedPreferences.getRecentMarkets(principal);
    const filtered = current.filter((id) => id !== marketId);
    const updated = [marketId, ...filtered].slice(0, 10); // Keep last 10
    setItem(KEYS.recentMarkets(principal), updated);
  },

  clearRecentMarkets: (principal: string) => {
    setItem(KEYS.recentMarkets(principal), []);
  },

  // Pinned Tokens
  getPinnedTokens: (principal: string): string[] =>
    getItem(KEYS.pinnedTokens(principal), DEFAULT_USER_SCOPED.pinnedTokens),

  setPinnedTokens: (principal: string, tokenIds: string[]) => {
    setItem(KEYS.pinnedTokens(principal), tokenIds);
  },

  togglePinnedToken: (principal: string, tokenId: string) => {
    const current = userScopedPreferences.getPinnedTokens(principal);
    const isPinned = current.includes(tokenId);
    const updated = isPinned ? current.filter((id) => id !== tokenId) : [...current, tokenId];
    setItem(KEYS.pinnedTokens(principal), updated);
    return !isPinned;
  },

  // Small Balance Hiding
  getHiddenSmallBalances: (principal: string): boolean =>
    getItem(KEYS.hiddenSmallBalances(principal), DEFAULT_USER_SCOPED.hiddenSmallBalances),

  setHiddenSmallBalances: (principal: string, hidden: boolean) => {
    setItem(KEYS.hiddenSmallBalances(principal), hidden);
  },

  getSmallBalanceThreshold: (principal: string): number =>
    getItem(KEYS.smallBalanceThreshold(principal), DEFAULT_USER_SCOPED.smallBalanceThreshold),

  setSmallBalanceThreshold: (principal: string, threshold: number) => {
    setItem(KEYS.smallBalanceThreshold(principal), threshold);
  },

  // Skip Order Confirmation
  getSkipOrderConfirmation: (principal: string): boolean =>
    getItem(KEYS.skipOrderConfirmation(principal), DEFAULT_USER_SCOPED.skipOrderConfirmation),

  setSkipOrderConfirmation: (principal: string, skip: boolean) => {
    setItem(KEYS.skipOrderConfirmation(principal), skip);
  },

  // Holdings (token list user is tracking)
  getHoldings: (principal: string): string[] => {
    // Try new key first, fall back to legacy
    const newKey = KEYS.holdings(principal);
    const stored = getItem<string[] | null>(newKey, null);
    if (stored !== null) return stored;

    // Migration: check legacy key
    const legacy = getItem<string[]>(KEYS.legacyHoldings, []);
    if (legacy.length > 0) {
      // Migrate to new key
      setItem(newKey, legacy);
      removeItem(KEYS.legacyHoldings);
      return legacy;
    }

    return [];
  },

  setHoldings: (principal: string, tokenIds: string[]) => {
    setItem(KEYS.holdings(principal), tokenIds);
  },

  addHolding: (principal: string, tokenId: string) => {
    const current = userScopedPreferences.getHoldings(principal);
    if (!current.includes(tokenId)) {
      setItem(KEYS.holdings(principal), [...current, tokenId]);
    }
  },

  removeHolding: (principal: string, tokenId: string) => {
    const current = userScopedPreferences.getHoldings(principal);
    setItem(
      KEYS.holdings(principal),
      current.filter((id) => id !== tokenId)
    );
  },

  // Bulk get/set
  getAll: (principal: string): UserScopedPreferences => ({
    recentMarkets: userScopedPreferences.getRecentMarkets(principal),
    pinnedTokens: userScopedPreferences.getPinnedTokens(principal),
    hiddenSmallBalances: userScopedPreferences.getHiddenSmallBalances(principal),
    smallBalanceThreshold: userScopedPreferences.getSmallBalanceThreshold(principal),
    skipOrderConfirmation: userScopedPreferences.getSkipOrderConfirmation(principal),
  }),

  reset: (principal: string) => {
    setItem(KEYS.recentMarkets(principal), DEFAULT_USER_SCOPED.recentMarkets);
    setItem(KEYS.pinnedTokens(principal), DEFAULT_USER_SCOPED.pinnedTokens);
    setItem(KEYS.hiddenSmallBalances(principal), DEFAULT_USER_SCOPED.hiddenSmallBalances);
    setItem(KEYS.smallBalanceThreshold(principal), DEFAULT_USER_SCOPED.smallBalanceThreshold);
    setItem(KEYS.skipOrderConfirmation(principal), DEFAULT_USER_SCOPED.skipOrderConfirmation);
  },

  // Clear all data for a principal
  clearAll: (principal: string) => {
    removeItem(KEYS.recentMarkets(principal));
    removeItem(KEYS.pinnedTokens(principal));
    removeItem(KEYS.hiddenSmallBalances(principal));
    removeItem(KEYS.smallBalanceThreshold(principal));
    removeItem(KEYS.skipOrderConfirmation(principal));
    removeItem(KEYS.holdings(principal));
  },
};
