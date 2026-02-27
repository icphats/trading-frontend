/**
 * Trollbox Drawer Portal State
 *
 * Portal infrastructure state (open/close) for the trollbox chat drawer.
 * Follows the same pattern as account-drawer.state.svelte.ts.
 */

let isOpen = $state(false);

export const trollboxDrawer = {
	get isOpen() {
		return isOpen;
	},
	open() {
		isOpen = true;
	},
	close() {
		isOpen = false;
	},
	toggle() {
		isOpen = !isOpen;
	}
};
