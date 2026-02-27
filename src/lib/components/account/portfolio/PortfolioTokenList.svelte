<script lang="ts">
	/**
	 * PortfolioTokenList - Token list for account sidebar
	 *
	 * Matches Uniswap's MiniPortfolio TokensTab:
	 * - Scrollable list of token balances
	 * - Loading skeleton state
	 * - Empty state when no tokens
	 * - Search filtering
	 *
	 * Reference: interface/apps/web/src/components/AccountDrawer/MiniPortfolio/Tokens/TokensTab.tsx
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/domain/user/auth.svelte';
	import { userPortfolio, userPreferences } from '$lib/domain/user';
	import { formatUSD } from '$lib/utils/format.utils';
	import { SearchInput } from '$lib/components/ui';
	import Logo from '$lib/components/ui/Logo.svelte';
	import PortfolioTokenRow from './PortfolioTokenRow.svelte';
	import { createSearchState } from '$lib/domain/search';
	import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
	import { normalizeTokenSymbol } from '$lib/domain/markets';
	import { bpsToPercent } from '$lib/domain/markets/utils/math';

	// Search state
	let searchQuery = $state('');

	// Backend search for token discovery
	const backendSearch = createSearchState({ filter: { tokens: null } });

	$effect(() => {
		backendSearch.query = searchQuery;
	});

	const isSearching = $derived(searchQuery.trim().length > 0);

	// Reactive bindings to portfolio state
	const allTokens = $derived(userPortfolio.allTokens);
	const isLoading = $derived(userPortfolio.isLoading || userPortfolio.isDiscovering);

	// Apply user preferences (filter hidden + small balances)
	const visibleTokens = $derived.by(() => {
		let result = allTokens;

		// Filter out hidden tokens
		const hiddenSet = new Set(userPreferences.hiddenTokens);
		result = result.filter((t) => !hiddenSet.has(t.canisterId));

		// Filter out small balances if enabled
		if (userPreferences.hiddenSmallBalances) {
			const threshold = userPreferences.smallBalanceThreshold;
			result = result.filter((t) => t.value >= threshold);
		}

		return result;
	});

	// Filter by search query
	const filteredTokens = $derived.by(() => {
		if (!searchQuery) return visibleTokens;
		const query = searchQuery.toLowerCase();
		return visibleTokens.filter(
			(token) =>
				token.symbol.toLowerCase().includes(query) ||
				token.displaySymbol.toLowerCase().includes(query) ||
				token.name.toLowerCase().includes(query) ||
				token.displayName.toLowerCase().includes(query) ||
				token.canisterId.toLowerCase().includes(query)
		);
	});

	// Dedup: user's token IDs
	const userTokenIds = $derived(new Set(allTokens.map((t) => t.canisterId)));

	// Backend search results minus tokens user already holds
	const discoverableTokens = $derived.by(() => {
		if (!isSearching) return [];
		return backendSearch.tokens.filter((t) => !userTokenIds.has(t.token_ledger.toString()));
	});

	function handleDiscoverableTokenClick(canisterId: string) {
		const token = entityStore.getToken(canisterId);
		const symbol = token ? normalizeTokenSymbol(token.displaySymbol) : canisterId;
		goto(`/explore/tokens/${symbol}`);
	}

	// Total portfolio value (always shows total, not filtered)
	const totalValue = $derived(visibleTokens.reduce((sum, t) => sum + t.value, 0));

	// Initialize portfolio data on mount
	onMount(async () => {
		if (!userPreferences.isInitialized) {
			userPreferences.initialize();
		}
		if (!userPortfolio.isInitialized) {
			await userPortfolio.initialize();
		}
		if (user.principal) {
			await userPortfolio.discoverHoldings(user.principal as any);
		}
	});
</script>

<div class="portfolio-tokens">
	<!-- Total Balance Header -->
	<div class="balance-header">
		{#if isLoading}
			<div class="skeleton-value"></div>
		{:else}
			<span class="total-value">{formatUSD(totalValue, 2)}</span>
		{/if}
	</div>

	<!-- Search Bar -->
	<div class="search-wrapper">
		<SearchInput bind:value={searchQuery} placeholder="Search tokens..." size="sm" variant="inline" />
	</div>

	<!-- Token List (fills remaining space) -->
	<div class="token-list-container">
		{#if isLoading}
			<!-- Skeleton loading rows -->
			{#each Array(4) as _}
				<div class="skeleton-row">
					<div class="skeleton-logo"></div>
					<div class="skeleton-info">
						<div class="skeleton-name"></div>
						<div class="skeleton-quantity"></div>
					</div>
					<div class="skeleton-amount"></div>
				</div>
			{/each}
		{:else if filteredTokens.length === 0}
			<!-- Empty state -->
			<div class="empty-state">
				{#if searchQuery}
					<span class="empty-text">No matches found</span>
					<span class="empty-hint">Try a different search term</span>
				{:else}
					<span class="empty-text">No tokens yet</span>
					<span class="empty-hint">Your token balances will appear here</span>
				{/if}
			</div>
		{:else}
			<!-- Token rows -->
			{#each filteredTokens as token (token.canisterId)}
				<PortfolioTokenRow {token} />
			{/each}
		{/if}

		<!-- All Tokens Section (backend discovery, only when searching) -->
		{#if isSearching && discoverableTokens.length > 0}
			<div class="section-header">All tokens</div>
			{#each discoverableTokens as token (token.token_ledger.toString())}
				{@const canisterId = token.token_ledger.toString()}
				{@const storeToken = entityStore.getToken(canisterId)}
				{@const price = Number(token.current_price_usd_e12) / 1e12}
				{@const change = bpsToPercent(token.price_change_24h_bps)}
				<button class="token-row" onclick={() => handleDiscoverableTokenClick(canisterId)}>
					<div class="token-left">
						<Logo src={storeToken?.logo ?? undefined} alt={storeToken?.displaySymbol ?? token.symbol} size="md" circle />
						<div class="token-info">
							<span class="token-name">{storeToken?.displaySymbol ?? token.symbol}</span>
							<span class="token-quantity">{storeToken?.displayName ?? token.name}</span>
						</div>
					</div>
					<div class="token-right">
						{#if price > 0}
							<span class="token-value">{formatUSD(price, 2)}</span>
						{/if}
						{#if change !== 0}
							<span class="token-change" class:positive={change > 0} class:negative={change < 0}>
								{change > 0 ? '+' : ''}{change.toFixed(2)}%
							</span>
						{/if}
					</div>
				</button>
			{/each}
		{:else if isSearching && backendSearch.isLoading && filteredTokens.length === 0}
			<div class="section-header">All tokens</div>
			<div class="empty-state">
				<span class="empty-text">Searching...</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.portfolio-tokens {
		display: flex;
		flex-direction: column;
		gap: 12px;
		/* Content flows naturally - drawer handles scrolling */
	}

	.balance-header {
		padding: 4px 0;
		flex-shrink: 0;
	}

	.total-value {
		font-size: 1.75rem;
		font-weight: 500;
		color: var(--foreground);
		line-height: 1.2;
	}

	.search-wrapper {
		flex-shrink: 0;
	}

	.token-list-container {
		display: flex;
		flex-direction: column;
		gap: 0;
		/* Let parent handle scrolling - don't add overflow here */
		margin: 0 -8px;
		padding: 0 8px;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		text-align: center;
		gap: 4px;
	}

	.empty-text {
		font-size: 0.9375rem;
		color: var(--foreground);
	}

	.empty-hint {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}

	/* Section header */
	.section-header {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--muted-foreground);
		padding: 12px 8px 4px;
	}

	/* Discoverable token rows */
	.token-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px;
		margin: 0 -8px;
		background: transparent;
		border: none;
		border-radius: 16px;
		cursor: pointer;
		transition: background-color 150ms ease;
		width: calc(100% + 16px);
		text-align: left;
	}

	.token-row:hover {
		background-color: var(--muted);
	}

	.token-left {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}

	.token-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.token-name {
		font-size: 0.9375rem;
		font-weight: 400;
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.token-quantity {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.token-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		flex-shrink: 0;
	}

	.token-value {
		font-size: 0.9375rem;
		font-weight: 400;
		color: var(--foreground);
	}

	.token-change {
		font-size: 0.75rem;
	}

	.token-change.positive {
		color: var(--green);
	}

	.token-change.negative {
		color: var(--red);
	}

	/* Skeleton Loading */
	.skeleton-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px;
	}

	.skeleton-logo {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--muted);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
	}

	.skeleton-name {
		width: 80px;
		height: 14px;
		border-radius: 4px;
		background: var(--muted);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-quantity {
		width: 60px;
		height: 12px;
		border-radius: 4px;
		background: var(--muted);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-amount {
		width: 50px;
		height: 14px;
		border-radius: 4px;
		background: var(--muted);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-value {
		width: 120px;
		height: 28px;
		border-radius: 6px;
		background: var(--muted);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
