<script lang="ts">
	/**
	 * AccountDrawer - Portal infrastructure wrapper
	 *
	 * This is a THIN WRAPPER that provides portal infrastructure only:
	 * - ResponsiveDrawer container (handles z-index, focus trap, animations)
	 * - Open/close state from lib/state/portal/
	 *
	 * All feature content (portfolio, settings, wallet connect) lives in
	 * lib/components/account/ per canonical architecture.
	 *
	 * Reference: interface/apps/web/src/components/AccountDrawer/index.tsx
	 */

	import { ResponsiveDrawer } from '$lib/components/portal/drawers/shared';
	import { accountDrawer } from '$lib/state/portal/account-drawer.state.svelte';
	import { AccountContent, menuState } from '$lib/components/account';

	// Reset menu state when drawer closes
	function handleClose() {
		accountDrawer.close();
		// Small delay to let close animation finish before resetting
		setTimeout(() => {
			menuState.reset();
		}, 250);
	}
</script>

<ResponsiveDrawer open={accountDrawer.isOpen} onClose={handleClose}>
	<AccountContent />
</ResponsiveDrawer>
