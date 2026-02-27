<script lang="ts">
	/**
	 * TrollboxDrawer - Portal infrastructure wrapper for chat
	 *
	 * Thin wrapper that provides portal infrastructure only:
	 * - ResponsiveDrawer container (handles z-index, focus trap, animations)
	 * - Open/close state from lib/state/portal/
	 *
	 * Follows the same pattern as AccountDrawer.
	 */

	import { ResponsiveDrawer } from '$lib/components/portal/drawers/shared';
	import { trollboxDrawer } from '$lib/state/portal/trollbox-drawer.state.svelte';
	import TrollboxContent from '$lib/components/dev/TrollboxContent.svelte';
</script>

<ResponsiveDrawer open={trollboxDrawer.isOpen} onClose={() => trollboxDrawer.close()}>
	<TrollboxContent />
</ResponsiveDrawer>
