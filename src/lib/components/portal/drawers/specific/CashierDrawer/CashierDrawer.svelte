<script lang="ts">
	/**
	 * CashierDrawer - Portal infrastructure wrapper
	 *
	 * Thin wrapper that provides portal infrastructure only:
	 * - ResponsiveDrawer container (handles z-index, focus trap, animations)
	 * - Open/close state from lib/state/portal/
	 *
	 * All cashier content (token list, deposit/withdraw) lives inline
	 * as CashierContent below.
	 */

	import { ResponsiveDrawer } from '$lib/components/portal/drawers/shared';
	import { cashierDrawer } from '$lib/state/portal/cashier-drawer.state.svelte';
	import CashierContent from './CashierContent.svelte';

	function handleClose() {
		cashierDrawer.close();
	}
</script>

<ResponsiveDrawer open={cashierDrawer.isOpen} onClose={handleClose}>
	<CashierContent onClose={handleClose} />
</ResponsiveDrawer>
