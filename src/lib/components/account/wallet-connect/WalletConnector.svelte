<script lang="ts">
	/**
	 * WalletConnector - Multi-wallet connection UI
	 *
	 * Displays:
	 * - II providers row (II, Apple, Google, Microsoft) - always first
	 * - Featured wallets (MetaMask, etc.)
	 * - Expandable "Other wallets" section
	 * - Privacy notice at bottom
	 *
	 * Supports IC, Ethereum (SIWE), and Solana (SIWS) wallets.
	 */

	import { browser } from '$app/environment';
	import { user } from '$lib/domain/user/auth.svelte';
	import { accountDrawer } from '$lib/state/portal/account-drawer.state.svelte';
	import WalletConnectorOption from './WalletConnectorOption.svelte';
	import {
		getFeaturedWalletList,
		getOtherWalletList,
		type WalletInfo,
		type WalletId
	} from '$lib/domain/user/wallet-display';
	import { globalPreferences } from '$lib/repositories/storage/local-storage';

	interface Props {
		/** Called when a wallet is selected */
		onWalletSelect?: (wallet: WalletInfo) => void;
	}

	let { onWalletSelect }: Props = $props();

	// Detect dark mode (guarded for SSR)
	const theme = globalPreferences.getTheme();
	const isDark =
		browser &&
		(theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));

	// II provider icons - each routes to a specific II provider via ICRC-29
	// The walletId maps to the getIIProvider() helper for URL routing
	const iiProviders = [
		{ id: 'ii', walletId: 'ii' as const, icon: '/wallets/internet-identity.svg', label: 'Internet Identity' },
		{ id: 'apple', walletId: 'ii-apple' as const, icon: '/wallets/apple.png', label: 'Apple' },
		{ id: 'google', walletId: 'ii-google' as const, icon: '/wallets/google.svg', label: 'Google' },
		{ id: 'microsoft', walletId: 'ii-microsoft' as const, icon: '/wallets/microsoft.svg', label: 'Microsoft' }
	];

	// Reactive wallet lists from config (excluding II since it's handled separately)
	let featuredWallets = $derived(getFeaturedWalletList().filter((w) => w.id !== 'ii'));
	let otherWallets = $derived(getOtherWalletList());

	// Check if we have any "other" wallets to show
	let hasOtherWallets = $derived(otherWallets.length > 0);

	// State
	let showOtherWallets = $state(true);
	let connectingWalletId = $state<string | null>(null);
	let connectionError = $state<string | null>(null);

	// Close drawer on successful auth
	$effect(() => {
		if (user.isAuthenticated && connectingWalletId) {
			connectingWalletId = null;
			connectionError = null;
			accountDrawer.close();
		}
	});

	async function handleWalletClick(wallet: WalletInfo) {
		connectingWalletId = wallet.id;
		connectionError = null;
		onWalletSelect?.(wallet);

		try {
			await user.login(wallet.id as WalletId);
		} catch (error) {
			// Silently reset on user cancellation (popup closed)
			if (error instanceof Error && error.name === 'OisyUserCancelledError') {
				connectingWalletId = null;
				return;
			}
			console.error('Wallet connection failed:', error);
			connectionError = error instanceof Error ? error.message : 'Connection failed';
			connectingWalletId = null;
		}
	}

	async function handleIIProviderClick(walletId: WalletId) {
		connectingWalletId = walletId;
		connectionError = null;

		try {
			await user.login(walletId);
		} catch (error) {
			// Silently reset on user cancellation (popup closed)
			if (error instanceof Error && error.name === 'IIUserCancelledError') {
				connectingWalletId = null;
				return;
			}
			console.error('II connection failed:', error);
			connectionError = error instanceof Error ? error.message : 'Connection failed';
			connectingWalletId = null;
		}
	}

	function toggleOtherWallets() {
		showOtherWallets = !showOtherWallets;
	}
</script>

<div class="wallet-connector">
	<!-- Header -->
	<div class="connector-header">
		<h2 class="connector-title">Connect a wallet</h2>
	</div>

	<!-- Error Banner -->
	{#if connectionError}
		<div class="error-banner">
			{connectionError}
		</div>
	{/if}

	<!-- II Providers Row (always first) -->
	<div class="ii-providers-row">
		{#each iiProviders as provider (provider.id)}
			<button
				class="ii-provider-btn"
				class:connecting={connectingWalletId === provider.walletId}
				onclick={() => handleIIProviderClick(provider.walletId)}
				disabled={connectingWalletId !== null}
				title={provider.label}
			>
				{#if connectingWalletId === provider.walletId}
					<div class="spinner"></div>
				{:else}
					<img src={provider.icon} alt={provider.label} class="ii-provider-icon" />
				{/if}
			</button>
		{/each}
	</div>

	<!-- Featured Wallets -->
	{#if featuredWallets.length > 0}
		<div class="featured-wallets">
			{#each featuredWallets as wallet (wallet.id)}
				<div class="featured-option">
					<WalletConnectorOption
						{wallet}
						isConnecting={connectingWalletId === wallet.id}
						onClick={handleWalletClick}
					/>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Other Wallets Toggle -->
	{#if hasOtherWallets}
		<button class="other-wallets-toggle" onclick={toggleOtherWallets}>
			<div class="separator"></div>
			<div class="toggle-content">
				<span class="toggle-text">Other wallets</span>
				<svg
					class="chevron"
					class:expanded={showOtherWallets}
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</div>
			<div class="separator"></div>
		</button>

		<!-- Other Wallets (flat list) -->
		<div class="other-wallets" class:expanded={showOtherWallets}>
			<div class="wallets-list">
				{#each otherWallets as wallet (wallet.id)}
					<WalletConnectorOption
						{wallet}
						isConnecting={connectingWalletId === wallet.id}
						onClick={handleWalletClick}
					/>
					<div class="wallet-separator"></div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Privacy Notice -->
	<div class="privacy-notice">
		<p>
			By connecting a wallet, you agree to our
			<a href="/terms" class="link">Terms of Service</a>
			and
			<a href="/privacy" class="link">Privacy Policy</a>.
		</p>
	</div>
</div>

<style>
	.wallet-connector {
		display: flex;
		flex-direction: column;
		padding: 0 0 16px 0;
	}

	.connector-header {
		padding: 20px 16px 16px;
	}

	.connector-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	/* Error Banner */
	.error-banner {
		background: var(--destructive-muted, rgba(239, 68, 68, 0.1));
		color: var(--destructive, #ef4444);
		padding: 8px 16px;
		margin: 0 16px 16px;
		border-radius: 8px;
		font-size: 13px;
	}

	/* II Providers Row */
	.ii-providers-row {
		display: flex;
		justify-content: center;
		gap: 12px;
		padding: 0 16px 16px;
	}

	.ii-provider-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		background: var(--card);
		border: none;
		border-radius: 16px;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			transform 150ms ease;
	}

	.ii-provider-btn:hover:not(:disabled) {
		background: var(--hover-overlay);
		transform: scale(1.02);
	}

	.ii-provider-btn:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.ii-provider-icon {
		width: 32px;
		height: 32px;
		object-fit: contain;
		cursor: pointer;
	}

	.ii-providers-row .spinner {
		width: 24px;
		height: 24px;
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

	/* Featured Wallets */
	.featured-wallets {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 16px 16px;
	}

	.featured-option {
		background: var(--card);
		border-radius: 16px;
		overflow: hidden;
	}

	/* Other Wallets Toggle */
	.other-wallets-toggle {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 8px 16px;
		background: transparent;
		border: none;
		cursor: pointer;
		width: 100%;
	}

	.separator {
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.toggle-content {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 18px;
		white-space: nowrap;
	}

	.toggle-text {
		font-size: 13px;
		color: var(--muted-foreground);
	}

	.chevron {
		color: var(--muted-foreground);
		transition: transform 200ms ease;
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	/* Other Wallets Container */
	.other-wallets {
		overflow: hidden;
		max-height: 0;
		transition:
			max-height 300ms ease,
			opacity 300ms ease;
		opacity: 0;
	}

	.other-wallets.expanded {
		max-height: 800px;
		opacity: 1;
	}

	.wallets-list {
		border-radius: 16px;
		overflow: hidden;
		margin: 0 16px;
		background: var(--card);
	}

	.wallet-separator {
		height: 1px;
		background: var(--border);
	}

	.wallet-separator:last-child {
		display: none;
	}

	/* Privacy Notice */
	.privacy-notice {
		padding: 16px;
		margin-top: auto;
	}

	.privacy-notice p {
		font-size: 12px;
		color: var(--muted-foreground);
		text-align: center;
		margin: 0;
		line-height: 1.5;
	}

	.link {
		color: var(--accent);
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}
</style>
