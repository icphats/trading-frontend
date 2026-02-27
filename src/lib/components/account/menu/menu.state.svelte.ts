/**
 * Account Menu Navigation State
 *
 * Handles menu routing within the account drawer content.
 * This is feature-specific UI state, not portal infrastructure.
 *
 * Per canonical architecture: Feature-specific state lives with feature components.
 */

import type { PortfolioToken } from '$lib/domain/user/user-portfolio.svelte';

// ============================================
// Menu Variants
// ============================================

export enum MenuVariant {
	MAIN = 'main',
	TOKEN_DETAIL = 'token_detail',
	SETTINGS = 'settings',
	LANGUAGE = 'language',
	CURRENCY = 'currency',
	THEME = 'theme'
}

// Menu depth for animation direction
const MENU_DEPTH: Record<MenuVariant, number> = {
	[MenuVariant.MAIN]: 0,
	[MenuVariant.TOKEN_DETAIL]: 1,
	[MenuVariant.SETTINGS]: 1,
	[MenuVariant.LANGUAGE]: 2,
	[MenuVariant.CURRENCY]: 2,
	[MenuVariant.THEME]: 2
};

// ============================================
// Selected Token State (for TOKEN_DETAIL view)
// ============================================

let selectedToken = $state<PortfolioToken | null>(null);

export const tokenDetailState = {
	get token() {
		return selectedToken;
	},
	select(token: PortfolioToken) {
		selectedToken = token;
		menuState.navigate(MenuVariant.TOKEN_DETAIL);
	},
	clear() {
		selectedToken = null;
	}
};

// ============================================
// Menu Navigation State
// ============================================

let currentMenu = $state<MenuVariant>(MenuVariant.MAIN);
let previousMenu = $state<MenuVariant | null>(null);

export const menuState = {
	get current() {
		return currentMenu;
	},
	get previous() {
		return previousMenu;
	},
	get animationDirection(): 'forward' | 'backward' {
		if (!previousMenu) return 'forward';
		const currentDepth = MENU_DEPTH[currentMenu];
		const previousDepth = MENU_DEPTH[previousMenu];
		return currentDepth > previousDepth ? 'forward' : 'backward';
	},
	navigate(variant: MenuVariant) {
		previousMenu = currentMenu;
		currentMenu = variant;
	},
	back() {
		// Go back based on depth
		if (currentMenu === MenuVariant.MAIN) return;

		// Clear token state when leaving TOKEN_DETAIL
		if (currentMenu === MenuVariant.TOKEN_DETAIL) {
			selectedToken = null;
		}

		const currentDepth = MENU_DEPTH[currentMenu];
		if (currentDepth === 2) {
			this.navigate(MenuVariant.SETTINGS);
		} else if (currentDepth === 1) {
			this.navigate(MenuVariant.MAIN);
		}
	},
	reset() {
		previousMenu = null;
		currentMenu = MenuVariant.MAIN;
		selectedToken = null;
	},
	// Convenience methods
	openSettings: () => menuState.navigate(MenuVariant.SETTINGS),
	openLanguage: () => menuState.navigate(MenuVariant.LANGUAGE),
	openCurrency: () => menuState.navigate(MenuVariant.CURRENCY),
	openTheme: () => menuState.navigate(MenuVariant.THEME),
	returnToMain: () => menuState.navigate(MenuVariant.MAIN)
};
