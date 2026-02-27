<script lang="ts">
	/**
	 * MainMenu - Primary view of account content
	 *
	 * Layout matches Uniswap AuthenticatedHeader + MiniPortfolio:
	 * - Top row: Avatar left, icon buttons (settings, logout) right
	 * - Address display below (copyable)
	 * - Portfolio token list below addresses
	 *
	 * Reference:
	 * - interface/apps/web/src/components/AccountDrawer/AuthenticatedHeader.tsx
	 * - interface/apps/web/src/components/AccountDrawer/MiniPortfolio/MiniPortfolio.tsx
	 */

	import { user } from '$lib/domain/user/auth.svelte';
	import { menuState, MenuVariant } from '$lib/components/account/menu';
	import { accountDrawer } from '$lib/state/portal/account-drawer.state.svelte';
	import { shortenId } from '$lib/components/ui/CopyableId.svelte';
	import { PortfolioTokenList } from '$lib/components/account/portfolio';

	function handleLogout() {
		accountDrawer.close();
		user.logout();
	}

	let isCopied = $state(false);

	async function copyPrincipal() {
		if (!user.principalText) return;
		try {
			await navigator.clipboard.writeText(user.principalText);
			isCopied = true;
			setTimeout(() => { isCopied = false; }, 1500);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

</script>

<div class="main-menu">
	<!-- Top Row: Identity + Action Buttons -->
	<div class="header-row">
		<!-- Principal -->
		{#if user.principalText}
			<button class="principal-display" class:copied={isCopied} onclick={copyPrincipal} title={isCopied ? 'Copied!' : user.principalText}>
				<span class="principal-text">{shortenId(user.principalText)}</span>
				{#if isCopied}
					<svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				{:else}
					<svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
						<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
					</svg>
				{/if}
			</button>
		{/if}

		<!-- Icon Buttons (Uniswap style) -->
		<div class="header-actions">
			<!-- Settings Button -->
			<button
				class="icon-button"
				onclick={() => menuState.navigate(MenuVariant.SETTINGS)}
				aria-label="Settings"
			>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
					></path>
					<circle cx="12" cy="12" r="3"></circle>
				</svg>
			</button>

			<!-- Logout/Power Button -->
			<button class="icon-button" onclick={handleLogout} aria-label="Disconnect">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
					<line x1="12" y1="2" x2="12" y2="12"></line>
				</svg>
			</button>
		</div>
	</div>

	<!-- Portfolio Token List -->
	<div class="portfolio-section">
		<PortfolioTokenList />
	</div>
</div>

<style>
	.main-menu {
		display: flex;
		flex-direction: column;
		padding: 1.25rem 1rem;
		gap: 0.5rem;
		/* Content flows naturally - drawer handles scrolling */
	}

	/* Header Row: Avatar left, buttons right */
	.header-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		flex-shrink: 0;
	}

	.principal-display {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: opacity 150ms ease;
	}

	.principal-display:hover {
		opacity: 0.7;
	}

	.principal-text {
		font-family: 'Basel', sans-serif;
		font-size: 19px;
		line-height: 24px;
		font-weight: 485;
		color: var(--foreground);
	}

	.copy-icon {
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.principal-display.copied .copy-icon {
		color: var(--color-connected);
	}

	/* Icon buttons group (Uniswap style) */
	.header-actions {
		display: flex;
		flex-direction: row;
		gap: 4px;
	}

	.icon-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		color: var(--muted-foreground);
		transition:
			background-color 150ms ease,
			color 150ms ease;
	}

	.icon-button:hover {
		background-color: var(--muted);
		color: var(--foreground);
	}

	/* Portfolio Section */
	.portfolio-section {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		/* Content flows naturally - drawer handles scrolling */
	}
</style>
