/**
 * Wallet Display Logic
 *
 * Enriches wallet configurations with runtime state (recent, detected)
 * and provides sorted lists for UI display.
 *
 * Per canonical architecture: Domain logic belongs in lib/domain/,
 * not in portal component folders.
 */

import {
	getFeaturedWallets,
	getOtherWallets,
	getEnabledWalletsByCategory,
	getWalletById as getWalletConfigById,
	type WalletConfig,
	type WalletId
} from '$lib/domain/user/wallet-config';
import { isWalletDetected } from '$lib/domain/user/wallet-detection';
import { globalPreferences } from '$lib/repositories/storage/local-storage';

// Re-export types for convenience
export type WalletInfo = WalletConfig;
export type { WalletId };

/**
 * Get the recent wallet ID from storage
 */
export function getRecentWalletId(): WalletId | null {
	return globalPreferences.getRecentWalletId() as WalletId | null;
}

/**
 * Enrich wallets with runtime flags (recent, detected) and sort appropriately.
 * Sort order: Recent first, then Detected, then others.
 */
function enrichWallets(wallets: WalletConfig[]): WalletInfo[] {
	const recentId = getRecentWalletId();

	return wallets
		.map((w) => ({
			...w,
			recent: w.id === recentId,
			detected: isWalletDetected(w.id)
		}))
		.sort((a, b) => {
			// Recent always first
			if (a.recent && !b.recent) return -1;
			if (!a.recent && b.recent) return 1;
			// Then detected
			if (a.detected && !b.detected) return -1;
			if (!a.detected && b.detected) return 1;
			return 0;
		});
}

/**
 * Main section wallets: Featured wallets + recent wallet promoted from "other" section.
 * If the recent wallet is from "other wallets", it appears first in this list.
 */
export function getFeaturedWalletList(): WalletInfo[] {
	const recentId = getRecentWalletId();
	const featured = enrichWallets(getFeaturedWallets());
	const other = getOtherWallets();

	// Check if recent wallet is from "other" section (not featured)
	const recentFromOther = recentId ? other.find((w) => w.id === recentId) : null;

	if (recentFromOther) {
		// Promote recent wallet to top of featured section
		const enrichedRecent = {
			...recentFromOther,
			recent: true,
			detected: isWalletDetected(recentFromOther.id)
		};
		return [enrichedRecent, ...featured];
	}

	return featured;
}

/**
 * Other wallets section, excluding any wallet that was promoted to featured.
 */
export function getOtherWalletList(): WalletInfo[] {
	const recentId = getRecentWalletId();
	const other = enrichWallets(getOtherWallets());

	// If recent wallet is from this section, exclude it (it's been promoted)
	if (recentId) {
		const isRecentFromOther = getOtherWallets().some((w) => w.id === recentId);
		if (isRecentFromOther) {
			return other.filter((w) => w.id !== recentId);
		}
	}

	return other;
}

/**
 * Get wallets grouped by category for sectioned display
 */
export function getWalletsByCategory(): {
	ic: WalletInfo[];
	ethereum: WalletInfo[];
	solana: WalletInfo[];
} {
	return {
		ic: enrichWallets(getEnabledWalletsByCategory('ic')),
		ethereum: enrichWallets(getEnabledWalletsByCategory('ethereum')),
		solana: enrichWallets(getEnabledWalletsByCategory('solana'))
	};
}

/**
 * Get a wallet by ID
 */
export function getWalletById(id: string): WalletInfo | undefined {
	return getWalletConfigById(id as WalletId);
}

// Legacy exports for backward compatibility
// These are now computed dynamically from config
export const FEATURED_WALLETS = getFeaturedWalletList();
export const ALL_WALLETS = getOtherWalletList();
