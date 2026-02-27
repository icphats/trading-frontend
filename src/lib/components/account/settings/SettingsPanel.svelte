<script lang="ts">
	/**
	 * SettingsPanel - Comprehensive settings submenu
	 *
	 * Contains:
	 * - Theme toggle (Auto/Light/Dark)
	 * - Default Slippage
	 * - Portfolio Display (small balances)
	 * - Token Preferences (favorites, hidden, recents)
	 */

	import { app, type ThemeMode } from '$lib/state/app.state.svelte';
	import { userPreferences } from '$lib/domain/user';
	import { user } from '$lib/domain/user/auth.svelte';
	import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
	import Logo from '$lib/components/ui/Logo.svelte';
	import { SlideOutMenu } from '$lib/components/account/menu';
	import type { NormalizedToken } from '$lib/types/entity.types';

	// Derived token lists with metadata
	let favoriteTokensWithData = $derived.by(() => {
		return userPreferences.favoriteTokens
			.map((id) => entityStore.getToken(id))
			.filter((t): t is NormalizedToken => t !== undefined);
	});

	let hiddenTokensWithData = $derived.by(() => {
		return userPreferences.hiddenTokens
			.map((id) => entityStore.getToken(id))
			.filter((t): t is NormalizedToken => t !== undefined);
	});

	// Section expansion state
	let favoritesExpanded = $state(false);
	let hiddenExpanded = $state(false);

	// Handlers
	function handleThemeChange(mode: ThemeMode) {
		app.setThemeMode(mode);
	}

	function handleSlippageChange(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		if (!isNaN(value) && value >= 0) {
			// Convert percentage to basis points
			userPreferences.setDefaultSlippage(Math.round(value * 100));
		}
	}

	function handleSmallBalanceThreshold(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		if (!isNaN(value) && value >= 0) {
			userPreferences.setSmallBalanceThreshold(value);
		}
	}

	function handleClearRecentMarkets() {
		userPreferences.clearRecentMarkets();
	}

	function handleRemoveFavorite(canisterId: string) {
		userPreferences.removeFavorite(canisterId);
	}

	function handleUnhideToken(canisterId: string) {
		userPreferences.unhideToken(canisterId);
	}
</script>

<SlideOutMenu title="Settings">
	<div class="settings-content">
		<!-- Appearance Section -->
		<div class="settings-section">
			<h3 class="section-title">Appearance</h3>
			<div class="settings-row">
				<span class="settings-label">Theme</span>
				<div class="theme-toggle">
					<button
						class="theme-option"
						class:active={app.themeMode === 'system'}
						onclick={() => handleThemeChange('system')}
						title="System"
					>
						Auto
					</button>
					<button
						class="theme-option"
						class:active={app.themeMode === 'light'}
						onclick={() => handleThemeChange('light')}
						title="Light"
						aria-label="Light theme"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="12" cy="12" r="5"></circle>
							<line x1="12" y1="1" x2="12" y2="3"></line>
							<line x1="12" y1="21" x2="12" y2="23"></line>
							<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
							<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
							<line x1="1" y1="12" x2="3" y2="12"></line>
							<line x1="21" y1="12" x2="23" y2="12"></line>
							<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
							<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
						</svg>
					</button>
					<button
						class="theme-option"
						class:active={app.themeMode === 'dark'}
						onclick={() => handleThemeChange('dark')}
						title="Dark"
						aria-label="Dark theme"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Trading Section -->
		<div class="settings-section">
			<h3 class="section-title">Trading</h3>
			<div class="settings-row">
				<div class="settings-label-group">
					<span class="settings-label">Default Slippage</span>
					<span class="settings-description">Maximum price movement for market orders</span>
				</div>
				<div class="slippage-input">
					<input
						type="number"
						value={(userPreferences.defaultSlippage / 100).toFixed(1)}
						onchange={handleSlippageChange}
						min="0.1"
						step="0.1"
					/>
					<span class="suffix">%</span>
				</div>
			</div>

			{#if user.isAuthenticated}
				<div class="settings-row">
					<div class="settings-label-group">
						<span class="settings-label">Skip Order Confirmation</span>
						<span class="settings-description">Execute orders without confirmation dialog</span>
					</div>
					<label class="toggle">
						<input
							type="checkbox"
							checked={userPreferences.skipOrderConfirmation}
							onchange={() =>
								userPreferences.setSkipOrderConfirmation(!userPreferences.skipOrderConfirmation)}
						/>
						<span class="toggle-slider"></span>
					</label>
				</div>
			{/if}
		</div>

		<!-- Portfolio Section (only when authenticated) -->
		{#if user.isAuthenticated}
			<div class="settings-section">
				<h3 class="section-title">Portfolio</h3>

				<!-- Hide Small Balances -->
				<div class="settings-row">
					<div class="settings-label-group">
						<span class="settings-label">Hide Small Balances</span>
						<span class="settings-description">Hide tokens below threshold</span>
					</div>
					<label class="toggle">
						<input
							type="checkbox"
							checked={userPreferences.hiddenSmallBalances}
							onchange={() =>
								userPreferences.setHiddenSmallBalances(!userPreferences.hiddenSmallBalances)}
						/>
						<span class="toggle-slider"></span>
					</label>
				</div>

				<!-- Small Balance Threshold -->
				{#if userPreferences.hiddenSmallBalances}
					<div class="settings-row">
						<div class="settings-label-group">
							<span class="settings-label">Threshold</span>
							<span class="settings-description">USD value to hide below</span>
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

				<!-- Favorite Tokens -->
				<div class="expandable-section">
					<button
						class="expandable-header"
						onclick={() => (favoritesExpanded = !favoritesExpanded)}
						aria-expanded={favoritesExpanded}
					>
						<div class="settings-label-group">
							<span class="settings-label">Favorite Tokens</span>
							<span class="settings-description">{userPreferences.favoriteTokens.length} tokens</span
							>
						</div>
						<svg
							class="chevron"
							class:rotated={favoritesExpanded}
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

					{#if favoritesExpanded}
						<div class="token-list">
							{#if favoriteTokensWithData.length === 0}
								<div class="empty-list">No favorite tokens</div>
							{:else}
								{#each favoriteTokensWithData as token (token.canisterId)}
									<div class="token-row">
										<div class="token-info">
											<Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="xs" circle />
											<span class="token-symbol">{token.displaySymbol}</span>
										</div>
										<button
											class="remove-btn"
											onclick={() => handleRemoveFavorite(token.canisterId)}
											title="Remove from favorites"
											aria-label="Remove from favorites"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<line x1="18" y1="6" x2="6" y2="18" />
												<line x1="6" y1="6" x2="18" y2="18" />
											</svg>
										</button>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				<!-- Hidden Tokens -->
				<div class="expandable-section">
					<button
						class="expandable-header"
						onclick={() => (hiddenExpanded = !hiddenExpanded)}
						aria-expanded={hiddenExpanded}
					>
						<div class="settings-label-group">
							<span class="settings-label">Hidden Tokens</span>
							<span class="settings-description">{userPreferences.hiddenTokens.length} tokens</span>
						</div>
						<svg
							class="chevron"
							class:rotated={hiddenExpanded}
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

					{#if hiddenExpanded}
						<div class="token-list">
							{#if hiddenTokensWithData.length === 0}
								<div class="empty-list">No hidden tokens</div>
							{:else}
								{#each hiddenTokensWithData as token (token.canisterId)}
									<div class="token-row">
										<div class="token-info">
											<Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="xs" circle />
											<span class="token-symbol">{token.displaySymbol}</span>
										</div>
										<button
											class="unhide-btn"
											onclick={() => handleUnhideToken(token.canisterId)}
											title="Unhide token"
											aria-label="Unhide token"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
												<circle cx="12" cy="12" r="3" />
											</svg>
										</button>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				<!-- Clear Recent Markets -->
				{#if userPreferences.recentMarkets.length > 0}
					<div class="settings-row">
						<div class="settings-label-group">
							<span class="settings-label">Recent Markets</span>
							<span class="settings-description">{userPreferences.recentMarkets.length} markets</span
							>
						</div>
						<button class="clear-btn" onclick={handleClearRecentMarkets}> Clear </button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</SlideOutMenu>

<style>
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
		margin: 0;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
	}

	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;
		gap: 1rem;
	}

	.settings-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
	}

	.settings-label-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.settings-description {
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	/* Theme Toggle */
	.theme-toggle {
		display: flex;
		align-items: center;
		background: var(--muted);
		border-radius: 20px;
		padding: 4px;
		gap: 0;
	}

	.theme-option {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		padding: 0 12px;
		background: transparent;
		border: none;
		border-radius: 16px;
		cursor: pointer;
		transition: all 0.15s ease;
		color: var(--muted-foreground);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.theme-option:hover:not(.active) {
		color: var(--foreground);
	}

	.theme-option.active {
		background: var(--background);
		color: var(--foreground);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.theme-option svg {
		width: 18px;
		height: 18px;
	}

	/* Slippage Input */
	.slippage-input {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--muted);
		border-radius: 8px;
		padding: 0 10px;
	}

	.slippage-input input {
		width: 70px;
		padding: 6px 0;
		font-size: 0.875rem;
		font-family: var(--font-numeric);
		background: transparent;
		border: none;
		color: var(--foreground);
		text-align: right;
	}

	.slippage-input input:focus {
		outline: none;
	}

	.slippage-input .suffix {
		color: var(--muted-foreground);
		font-size: 0.875rem;
	}

	/* Toggle Switch */
	.toggle {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 22px;
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
		border-radius: 11px;
		transition: background 0.2s;
	}

	.toggle-slider::before {
		position: absolute;
		content: '';
		height: 16px;
		width: 16px;
		left: 3px;
		bottom: 3px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}

	.toggle input:checked + .toggle-slider {
		background: var(--primary);
	}

	.toggle input:checked + .toggle-slider::before {
		transform: translateX(18px);
	}

	/* Threshold Input */
	.threshold-input {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--muted);
		border-radius: 8px;
		padding: 0 10px;
	}

	.threshold-input .currency {
		color: var(--muted-foreground);
		font-size: 0.875rem;
	}

	.threshold-input input {
		width: 60px;
		padding: 6px 0;
		font-size: 0.875rem;
		font-family: var(--font-numeric);
		background: transparent;
		border: none;
		color: var(--foreground);
	}

	.threshold-input input:focus {
		outline: none;
	}

	/* Expandable Sections */
	.expandable-section {
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
	}

	.expandable-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.5rem 0;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.expandable-header:hover {
		opacity: 0.8;
	}

	.chevron {
		color: var(--muted-foreground);
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	/* Token List */
	.token-list {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.token-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
	}

	.token-row:not(:last-child) {
		border-bottom: 1px solid var(--border);
	}

	.token-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.token-symbol {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
	}

	.remove-btn,
	.unhide-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--muted-foreground);
		cursor: pointer;
		transition: all 0.15s;
	}

	.remove-btn:hover {
		background: oklch(from var(--destructive) l c h / 0.1);
		border-color: var(--destructive);
		color: var(--destructive);
	}

	.unhide-btn:hover {
		background: var(--muted);
		color: var(--foreground);
	}

	.empty-list {
		padding: 1rem;
		text-align: center;
		color: var(--muted-foreground);
		font-size: 0.8125rem;
	}

	/* Clear Button */
	.clear-btn {
		padding: 6px 12px;
		font-size: 0.8125rem;
		font-weight: 500;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--muted-foreground);
		cursor: pointer;
		transition: all 0.15s;
	}

	.clear-btn:hover {
		background: var(--muted);
		color: var(--foreground);
	}
</style>
