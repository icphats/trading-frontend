/**
 * Cashier Drawer Portal State
 *
 * Portal infrastructure state (open/close) for the cashier/wallet drawer.
 */

let isOpen = $state(false);

export const cashierDrawer = {
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
