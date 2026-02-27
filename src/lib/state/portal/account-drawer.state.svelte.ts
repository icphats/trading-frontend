/**
 * Account Drawer Portal State
 *
 * This file contains ONLY portal infrastructure state (open/close).
 * Menu navigation and feature-specific state lives in components/account/.
 *
 * Per canonical architecture: lib/state/portal/ handles portal infrastructure.
 */

let isOpen = $state(false);

/**
 * Account drawer open/close state - portal infrastructure
 */
export const accountDrawer = {
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
