<script lang="ts">
	/**
	 * WalletConnectorOption - Individual wallet option in the connection modal
	 *
	 * Displays:
	 * - Wallet icon
	 * - Wallet name
	 * - Optional badges (Detected, Recent)
	 * - Loading state during connection
	 *
	 * Reference: interface/apps/web/src/components/WalletModal/WalletConnectorOption.tsx
	 */

	import type { WalletInfo } from '$lib/domain/user/wallet-display';

	interface Props {
		wallet: WalletInfo;
		/** Whether connection is in progress for this wallet */
		isConnecting?: boolean;
		/** Click handler - called when wallet is selected */
		onClick?: (wallet: WalletInfo) => void;
	}

	let { wallet, isConnecting = false, onClick }: Props = $props();

	function handleClick() {
		if (!isConnecting) {
			onClick?.(wallet);
		}
	}
</script>

<button class="wallet-option" class:connecting={isConnecting} onclick={handleClick} disabled={isConnecting}>
	<div class="wallet-info">
		<img src={wallet.icon} alt={wallet.name} class="wallet-icon" />
		<div class="wallet-text">
			<span class="wallet-name">{wallet.name}</span>
			{#if wallet.description}
				<span class="wallet-description">{wallet.description}</span>
			{/if}
		</div>
	</div>

	<div class="wallet-status">
		{#if isConnecting}
			<div class="spinner"></div>
		{:else if wallet.recent}
			<span class="badge recent">Recent</span>
		{:else if wallet.detected}
			<span class="badge detected">Detected</span>
		{/if}
	</div>
</button>

<style>
	.wallet-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 18px 16px;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color 150ms ease;
	}

	.wallet-option:hover:not(:disabled) {
		background: var(--hover-overlay);
	}

	.wallet-option:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.wallet-info {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.wallet-icon {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		object-fit: contain;
	}

	.wallet-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
	}

	.wallet-name {
		font-size: 16px;
		font-weight: 500;
		color: var(--foreground);
	}

	.wallet-description {
		font-size: 12px;
		color: var(--muted-foreground);
	}

	.wallet-status {
		display: flex;
		align-items: center;
	}

	.badge {
		font-size: 11px;
		font-weight: 500;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.badge.recent {
		background: color-mix(in oklch, var(--primary) 15%, transparent);
		border: 1px solid color-mix(in oklch, var(--primary) 30%, transparent);
		color: var(--muted-foreground);
	}

	.badge.detected {
		background: var(--success-muted, rgba(34, 197, 94, 0.1));
		color: var(--success, #22c55e);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
