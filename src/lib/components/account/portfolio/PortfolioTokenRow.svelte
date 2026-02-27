<script lang="ts">
	/**
	 * PortfolioTokenRow - Compact token row for sidebar
	 *
	 * Matches Uniswap's TokenBalanceItem layout:
	 * - Left: Logo + name + quantity (e.g., "0.5 ETH")
	 * - Right: USD value + change indicator
	 *
	 * Clicking opens the token detail view within the drawer
	 * for send/receive actions (Uniswap-style flow).
	 *
	 * Reference: interface/packages/uniswap/src/components/portfolio/TokenBalanceItem.tsx
	 */

	import type { PortfolioToken } from '$lib/domain/user/user-portfolio.svelte';
	import { formatUSD } from '$lib/utils/format.utils';
	import { tokenDetailState } from '$lib/components/account/menu';
	import Logo from '$lib/components/ui/Logo.svelte';
	import { tokenTicker } from '$lib/domain/orchestration';

	interface Props {
		token: PortfolioToken;
	}

	let { token }: Props = $props();

	function handleClick() {
		// Open token detail view within drawer
		tokenDetailState.select(token);
	}
</script>

<button class="token-row" onclick={handleClick} use:tokenTicker={token.canisterId}>
	<!-- Left: Logo + Token Info -->
	<div class="token-left">
		<!-- Token Logo -->
		<Logo src={token.logo ?? undefined} alt={token.displaySymbol} size="md" circle />

		<!-- Token Name + Quantity -->
		<div class="token-info">
			<span class="token-name">{token.displayName ?? token.displaySymbol ?? 'Unknown'}</span>
			<span class="token-quantity">
				{token.formattedBalance}
				{token.displaySymbol}
			</span>
		</div>
	</div>

	<!-- Right: USD Value -->
	<div class="token-right">
		{#if token.value > 0}
			<span class="token-value">{formatUSD(token.value, 2)}</span>
		{:else}
			<span class="token-value muted">-</span>
		{/if}
	</div>
</button>

<style>
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
		overflow: hidden;
	}

	.token-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.token-name {
		font-size: 0.9375rem;
		font-weight: 400;
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.token-quantity {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
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

	.token-value.muted {
		color: var(--muted-foreground);
	}
</style>
