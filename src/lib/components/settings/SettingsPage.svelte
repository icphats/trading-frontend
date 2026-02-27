<script lang="ts">
  /**
   * Comprehensive Settings Page
   *
   * Central location for all user preferences:
   * - Display settings (theme, chart style, etc.)
   * - Portfolio display (hide small balances)
   * - Token preferences (favorites, hidden)
   * - Market preferences (favorites)
   * - Data management (recent markets, reset)
   *
   * Serves as reference implementation for shared components.
   */

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userPreferences } from '$lib/domain/user';
  import { user } from '$lib/domain/user/auth.svelte';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { normalizeTokenSymbol } from '$lib/domain/markets';
  import { UnifiedListRow, SectionHeader, EmptyState } from '$lib/components/ui';
  import type { NormalizedToken } from '$lib/types/entity.types';
  import type { QuoteTokenSymbol } from '$lib/domain/markets';

  // Initialize preferences on mount
  onMount(() => {
    userPreferences.initialize();
  });

  // ============================================
  // Derived Data
  // ============================================

  // Token favorites with metadata
  let favoriteTokensWithData = $derived.by(() => {
    return userPreferences.favoriteTokens
      .map(id => entityStore.getToken(id))
      .filter((t): t is NormalizedToken => t !== undefined);
  });

  // Hidden tokens with metadata
  let hiddenTokensWithData = $derived.by(() => {
    return userPreferences.hiddenTokens
      .map(id => entityStore.getToken(id))
      .filter((t): t is NormalizedToken => t !== undefined);
  });

  // Market favorites with metadata
  interface MarketFavoriteData {
    marketId: string;
    canisterId: string;
    quoteToken: QuoteTokenSymbol;
    baseToken: NormalizedToken | undefined;
    quoteTokenData: NormalizedToken | undefined;
  }

  const QUOTE_TOKEN_LEDGERS: Record<string, string> = {
    icp: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
    usdc: 'xevnm-gaaaa-aaaar-qafnq-cai',
    usdt: 'cngnf-vqaaa-aaaar-qag4q-cai',
  };

  let favoriteMarketsWithData = $derived.by((): MarketFavoriteData[] => {
    const results: MarketFavoriteData[] = [];

    for (const marketId of userPreferences.favoriteMarkets) {
      const parsed = userPreferences.parseMarketId(marketId);
      if (!parsed) continue;

      const baseToken = entityStore.getToken(parsed.canisterId);
      const quoteTokenData = entityStore.getToken(QUOTE_TOKEN_LEDGERS[parsed.quoteToken]);

      results.push({
        marketId,
        canisterId: parsed.canisterId,
        quoteToken: parsed.quoteToken as QuoteTokenSymbol,
        baseToken,
        quoteTokenData,
      });
    }

    return results;
  });

  // ============================================
  // Section Expansion State
  // ============================================

  let expandedSections = $state<Set<string>>(new Set(['display', 'portfolio']));

  function toggleSection(section: string) {
    if (expandedSections.has(section)) {
      expandedSections.delete(section);
    } else {
      expandedSections.add(section);
    }
    expandedSections = new Set(expandedSections);
  }

  // ============================================
  // Handlers
  // ============================================

  function handleSmallBalanceThreshold(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(value) && value >= 0) {
      userPreferences.setSmallBalanceThreshold(value);
    }
  }

  function handleClearRecentMarkets() {
    userPreferences.clearRecentMarkets();
  }

  function handleRemoveTokenFavorite(canisterId: string) {
    userPreferences.removeFavorite(canisterId);
  }

  function handleUnhideToken(canisterId: string) {
    userPreferences.unhideToken(canisterId);
  }

  function handleRemoveMarketFavorite(canisterId: string, quoteToken: string) {
    userPreferences.removeFavoriteMarket(canisterId, quoteToken);
  }

  function handleViewTokenAnalytics(canisterId: string) {
    const token = entityStore.getToken(canisterId);
    const symbol = token ? normalizeTokenSymbol(token.displaySymbol) : canisterId;
    goto(`/explore/tokens/${symbol}`);
  }

  function handleViewMarket(baseSymbol: string, quoteSymbol: string) {
    goto(`/trade/${baseSymbol.toLowerCase()}/${quoteSymbol.toLowerCase()}`);
  }

  async function handleCopyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function handleResetAll() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      userPreferences.resetAll();
    }
  }
</script>

<svelte:head>
  <title>Settings</title>
</svelte:head>

<div class="settings-page">
  <div class="settings-container">
    <!-- Header -->
    <header class="settings-header">
      <h1>Settings</h1>
      <p class="subtitle">Manage your preferences and data</p>
    </header>

    {#if !user.isAuthenticated}
      <div class="auth-required">
        <EmptyState
          variant="empty"
          message="Connect your wallet"
          hint="Sign in to manage your settings and preferences"
        />
      </div>
    {:else}
      <div class="settings-grid">
        <!-- ============================================
             Display Settings
             ============================================ -->
        <section class="settings-section">
          <button
            class="section-header-btn"
            onclick={() => toggleSection('display')}
            aria-expanded={expandedSections.has('display')}
          >
            <div class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Display Settings</span>
            </div>
            <svg
              class="chevron"
              class:rotated={expandedSections.has('display')}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {#if expandedSections.has('display')}
            <div class="section-content">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Theme</span>
                  <span class="setting-description">Choose your preferred color scheme</span>
                </div>
                <select
                  class="setting-select"
                  value={userPreferences.theme}
                  onchange={(e) => userPreferences.setTheme((e.target as HTMLSelectElement).value as any)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Chart Style</span>
                  <span class="setting-description">Default chart visualization</span>
                </div>
                <select
                  class="setting-select"
                  value={userPreferences.chartStyle}
                  onchange={(e) => userPreferences.setChartStyle((e.target as HTMLSelectElement).value as any)}
                >
                  <option value="candles">Candlesticks</option>
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                </select>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Show USD Values</span>
                  <span class="setting-description">Display values in USD</span>
                </div>
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={userPreferences.showUsdValues}
                    onchange={() => userPreferences.setShowUsdValues(!userPreferences.showUsdValues)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Sound Effects</span>
                  <span class="setting-description">Play sounds for notifications</span>
                </div>
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={userPreferences.soundEnabled}
                    onchange={() => userPreferences.setSoundEnabled(!userPreferences.soundEnabled)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          {/if}
        </section>

        <!-- ============================================
             Portfolio Display
             ============================================ -->
        <section class="settings-section">
          <button
            class="section-header-btn"
            onclick={() => toggleSection('portfolio')}
            aria-expanded={expandedSections.has('portfolio')}
          >
            <div class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              <span>Portfolio Display</span>
            </div>
            <svg
              class="chevron"
              class:rotated={expandedSections.has('portfolio')}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {#if expandedSections.has('portfolio')}
            <div class="section-content">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Hide Small Balances</span>
                  <span class="setting-description">Hide tokens below threshold</span>
                </div>
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={userPreferences.hiddenSmallBalances}
                    onchange={() => userPreferences.setHiddenSmallBalances(!userPreferences.hiddenSmallBalances)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              {#if userPreferences.hiddenSmallBalances}
                <div class="setting-row">
                  <div class="setting-info">
                    <span class="setting-label">Threshold</span>
                    <span class="setting-description">Hide tokens worth less than</span>
                  </div>
                  <div class="threshold-input">
                    <span class="currency">$</span>
                    <input
                      type="number"
                      value={userPreferences.smallBalanceThreshold}
                      onchange={handleSmallBalanceThreshold}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </section>

        <!-- ============================================
             Token Favorites
             ============================================ -->
        <section class="settings-section">
          <button
            class="section-header-btn"
            onclick={() => toggleSection('tokenFavorites')}
            aria-expanded={expandedSections.has('tokenFavorites')}
          >
            <div class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Favorite Tokens</span>
            </div>
            <div class="section-meta">
              <span class="count-badge">{userPreferences.favoriteTokens.length}</span>
              <svg
                class="chevron"
                class:rotated={expandedSections.has('tokenFavorites')}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {#if expandedSections.has('tokenFavorites')}
            <div class="section-content list-section">
              {#if favoriteTokensWithData.length === 0}
                <EmptyState
                  variant="empty"
                  message="No favorite tokens"
                  hint="Star tokens to add them here"
                />
              {:else}
                {#each favoriteTokensWithData as token (token.canisterId)}
                  <UnifiedListRow
                    type="token"
                    id={token.canisterId}
                    logo={token.logo}
                    primaryLabel={token.symbol}
                    secondaryLabel={token.name}
                    isFavorite={true}
                    onFavorite={() => handleRemoveTokenFavorite(token.canisterId)}
                    size="sm"
                  />
                {/each}
              {/if}
            </div>
          {/if}
        </section>

        <!-- ============================================
             Hidden Tokens
             ============================================ -->
        <section class="settings-section">
          <button
            class="section-header-btn"
            onclick={() => toggleSection('hiddenTokens')}
            aria-expanded={expandedSections.has('hiddenTokens')}
          >
            <div class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <span>Hidden Tokens</span>
            </div>
            <div class="section-meta">
              <span class="count-badge">{userPreferences.hiddenTokens.length}</span>
              <svg
                class="chevron"
                class:rotated={expandedSections.has('hiddenTokens')}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {#if expandedSections.has('hiddenTokens')}
            <div class="section-content list-section">
              {#if hiddenTokensWithData.length === 0}
                <EmptyState
                  variant="empty"
                  message="No hidden tokens"
                  hint="Hide tokens from your portfolio to manage them here"
                />
              {:else}
                {#each hiddenTokensWithData as token (token.canisterId)}
                  <UnifiedListRow
                    type="token"
                    id={token.canisterId}
                    logo={token.logo}
                    primaryLabel={token.symbol}
                    secondaryLabel={token.name}
                    size="sm"
                  />
                {/each}
              {/if}
            </div>
          {/if}
        </section>

        <!-- ============================================
             Market Favorites
             ============================================ -->
        <section class="settings-section">
          <button
            class="section-header-btn"
            onclick={() => toggleSection('marketFavorites')}
            aria-expanded={expandedSections.has('marketFavorites')}
          >
            <div class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Favorite Markets</span>
            </div>
            <div class="section-meta">
              <span class="count-badge">{userPreferences.favoriteMarkets.length}</span>
              <svg
                class="chevron"
                class:rotated={expandedSections.has('marketFavorites')}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {#if expandedSections.has('marketFavorites')}
            <div class="section-content list-section">
              {#if favoriteMarketsWithData.length === 0}
                <EmptyState
                  variant="empty"
                  message="No favorite markets"
                  hint="Star trading pairs to add them here"
                />
              {:else}
                {#each favoriteMarketsWithData as market (market.marketId)}
                  <UnifiedListRow
                    type="market"
                    id={market.marketId}
                    pairLogos={{
                      token0: market.baseToken?.logo ?? undefined,
                      token1: market.quoteTokenData?.logo ?? undefined,
                    }}
                    pairSymbols={{
                      token0: market.baseToken?.symbol ?? '???',
                      token1: market.quoteToken.toUpperCase(),
                    }}
                    primaryLabel="{market.baseToken?.symbol ?? '???'}/{market.quoteToken.toUpperCase()}"
                    secondaryLabel={market.baseToken?.name}
                    isFavorite={true}
                    onFavorite={() => handleRemoveMarketFavorite(market.canisterId, market.quoteToken)}
                    onClick={() => handleViewMarket(market.baseToken?.symbol ?? '', market.quoteToken.toUpperCase())}
                    size="sm"
                  />
                {/each}
              {/if}
            </div>
          {/if}
        </section>

        <!-- ============================================
             Data Management
             ============================================ -->
        <section class="settings-section">
          <button
            class="section-header-btn"
            onclick={() => toggleSection('data')}
            aria-expanded={expandedSections.has('data')}
          >
            <div class="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span>Data Management</span>
            </div>
            <svg
              class="chevron"
              class:rotated={expandedSections.has('data')}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {#if expandedSections.has('data')}
            <div class="section-content">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">Recent Markets</span>
                  <span class="setting-description">Clear your recently viewed markets</span>
                </div>
                <button class="secondary-button" onclick={handleClearRecentMarkets}>
                  Clear ({userPreferences.recentMarkets.length})
                </button>
              </div>

              <div class="setting-row danger-zone">
                <div class="setting-info">
                  <span class="setting-label">Reset All Settings</span>
                  <span class="setting-description">Restore all preferences to defaults</span>
                </div>
                <button class="danger-button" onclick={handleResetAll}>
                  Reset All
                </button>
              </div>
            </div>
          {/if}
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-page {
    min-height: 100vh;
    padding: 24px;
    background: var(--background);
  }

  .settings-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .settings-header {
    margin-bottom: 32px;
  }

  .settings-header h1 {
    font-size: 28px;
    font-weight: var(--font-weight-medium, 535);
    color: var(--foreground);
    margin: 0 0 8px;
  }

  .subtitle {
    font-size: 15px;
    color: var(--muted-foreground);
    margin: 0;
  }

  .auth-required {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 48px 24px;
  }

  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Section */
  .settings-section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .section-header-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 16px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background-color 150ms ease;
  }

  .section-header-btn:hover {
    background: var(--hover-overlay);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--foreground);
  }

  .section-title svg {
    color: var(--muted-foreground);
  }

  .section-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .count-badge {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted-foreground);
    background: var(--muted);
    padding: 4px 8px;
    border-radius: 6px;
  }

  .chevron {
    color: var(--muted-foreground);
    transition: transform 200ms ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .section-content {
    border-top: 1px solid var(--border);
    padding: 8px 0;
  }

  .list-section {
    padding: 0;
    max-height: 400px;
    overflow-y: auto;
  }

  /* Setting Row */
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    gap: 16px;
  }

  .setting-row:not(:last-child) {
    border-bottom: 1px solid oklch(from var(--border) l c h / 0.3);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .setting-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  .setting-description {
    font-size: 12px;
    color: var(--muted-foreground);
  }

  /* Toggle */
  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--muted);
    border-radius: 12px;
    transition: background 200ms ease;
  }

  .toggle-slider::before {
    position: absolute;
    content: '';
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: transform 200ms ease;
  }

  .toggle input:checked + .toggle-slider {
    background: var(--primary);
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }

  /* Select */
  .setting-select {
    padding: 8px 12px;
    font-size: 13px;
    font-family: var(--font-sans);
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--foreground);
    cursor: pointer;
    transition: border-color 150ms ease;
  }

  .setting-select:hover {
    border-color: oklch(from var(--border) l c h / 0.7);
  }

  .setting-select:focus {
    outline: none;
    border-color: var(--primary);
  }

  /* Threshold Input */
  .threshold-input {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0 12px;
    transition: border-color 150ms ease;
  }

  .threshold-input:hover,
  .threshold-input:focus-within {
    border-color: oklch(from var(--border) l c h / 0.7);
  }

  .threshold-input .currency {
    color: var(--muted-foreground);
    font-size: 14px;
  }

  .threshold-input input {
    width: 80px;
    padding: 8px 0;
    font-size: 14px;
    font-family: var(--font-sans);
    background: transparent;
    border: none;
    color: var(--foreground);
  }

  .threshold-input input:focus {
    outline: none;
  }

  /* Buttons */
  .secondary-button {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--foreground);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .secondary-button:hover {
    background: var(--hover-overlay);
    border-color: oklch(from var(--border) l c h / 0.7);
  }

  .danger-zone {
    background: oklch(from var(--color-bearish, #ef4444) l c h / 0.05);
  }

  .danger-button {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    background: transparent;
    border: 1px solid var(--color-bearish, #ef4444);
    border-radius: var(--radius-md);
    color: var(--color-bearish, #ef4444);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .danger-button:hover {
    background: oklch(from var(--color-bearish, #ef4444) l c h / 0.1);
  }

  /* Scrollbar */
  .list-section::-webkit-scrollbar {
    width: 4px;
  }

  .list-section::-webkit-scrollbar-track {
    background: transparent;
  }

  .list-section::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }

  .list-section::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .settings-page {
      padding: 16px;
    }

    .settings-header h1 {
      font-size: 24px;
    }

    .section-header-btn {
      padding: 14px 16px;
    }

    .setting-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
    }
  }
</style>
