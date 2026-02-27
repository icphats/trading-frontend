/**
 * AccountDrawer - Portal Infrastructure
 *
 * This module exports ONLY portal infrastructure:
 * - AccountDrawer component (thin wrapper around ResponsiveDrawer)
 * - accountDrawer state (open/close)
 *
 * Feature components (portfolio, settings, wallet connect) are in
 * lib/components/account/ per canonical architecture.
 */

// Portal infrastructure
export { default as AccountDrawer } from './AccountDrawer.svelte';

// Re-export state from canonical location for convenience
export { accountDrawer } from '$lib/state/portal/account-drawer.state.svelte';

// Re-export feature components for backward compatibility during migration
// TODO: Remove these re-exports once all consumers import from $lib/components/account
export {
	AccountContent,
	MainMenu,
	TokenDetailView,
	SettingsPanel,
	WalletConnector,
	menuState,
	tokenDetailState,
	MenuVariant,
	SlideOutMenu
} from '$lib/components/account';

// Legacy alias for DefaultMenu -> AccountContent
export { AccountContent as DefaultMenu } from '$lib/components/account';
