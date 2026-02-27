<script lang="ts">
	/**
	 * AccountContent - Content router for account drawer
	 *
	 * Routes between views based on menuState:
	 * - If not authenticated -> WalletConnector (connect wallet options)
	 * - MAIN -> MainMenu (authenticated user view)
	 * - SETTINGS -> SettingsPanel
	 * - TOKEN_DETAIL -> TokenDetailView
	 *
	 * Reference: interface/apps/web/src/components/AccountDrawer/DefaultMenu.tsx
	 */

	import { menuState, MenuVariant } from '$lib/components/account/menu';
	import { accountDrawer } from '$lib/state/portal/account-drawer.state.svelte';
	import { user } from '$lib/domain/user/auth.svelte';
	import MainMenu from './MainMenu.svelte';
	import { SettingsPanel } from '$lib/components/account/settings';
	import TokenDetailView from './TokenDetailView.svelte';
	import { WalletConnector } from '$lib/components/account/wallet-connect';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	// Check if user is connected
	const isConnected = $derived(user.isAuthenticated);

	// Reset menu when drawer closes
	$effect(() => {
		if (!accountDrawer.isOpen && menuState.current !== MenuVariant.MAIN) {
			// Small delay to let close animation finish
			const timer = setTimeout(() => {
				menuState.reset();
			}, 250);
			return () => clearTimeout(timer);
		}
	});

	// Animation params based on direction
	const getTransitionParams = (direction: 'forward' | 'backward') => {
		return {
			x: direction === 'forward' ? 50 : -50,
			duration: 200,
			easing: cubicOut
		};
	};
</script>

<div class="menu-container">
	{#if !isConnected}
		<!-- Not connected: Show wallet connection options -->
		<div class="menu-content">
			<WalletConnector />
		</div>
	{:else}
		<!-- Connected: Show menu based on current state -->
		{#key menuState.current}
			<div
				class="menu-content"
				in:fly={getTransitionParams(menuState.animationDirection)}
				out:fly={{
					...getTransitionParams(menuState.animationDirection),
					x: menuState.animationDirection === 'forward' ? -50 : 50
				}}
			>
				{#if menuState.current === MenuVariant.MAIN}
					<MainMenu />
				{:else if menuState.current === MenuVariant.TOKEN_DETAIL}
					<TokenDetailView />
				{:else if menuState.current === MenuVariant.SETTINGS}
					<SettingsPanel />
				{/if}
			</div>
		{/key}
	{/if}
</div>

<style>
	.menu-container {
		position: relative;
		width: 100%;
		/* Content flows naturally - drawer handles scrolling */
	}

	.menu-content {
		width: 100%;
		/* Content flows naturally - drawer handles scrolling */
	}
</style>
