/**
 * Wallet Extension Detection
 *
 * Detects browser wallet extensions by checking for injected globals.
 * No dependencies required - just simple window property checks.
 *
 * Note: Some wallets (like Coinbase, OKX) set `isMetaMask: true` for compatibility,
 * so we check wallet-specific properties first.
 */

import type { WalletId } from './wallet-config';

// Extend Window interface for wallet globals
declare global {
	interface Window {
		// Ethereum wallets
		ethereum?: {
			isMetaMask?: boolean;
			isCoinbaseWallet?: boolean;
			isOkxWallet?: boolean;
			// Multiple wallets may inject here
			providers?: Array<{
				isMetaMask?: boolean;
				isCoinbaseWallet?: boolean;
				isOkxWallet?: boolean;
			}>;
		};
		coinbaseWalletExtension?: unknown;
		okxwallet?: unknown;

		// Solana wallets
		phantom?: {
			solana?: {
				isPhantom?: boolean;
			};
		};
		solflare?: {
			isSolflare?: boolean;
		};

		// IC wallets
		ic?: {
			plug?: unknown;
		};
	}
}

/**
 * Wallets that require browser extension detection.
 * Web-based wallets (II, NFID, Oisy, WalletConnect) don't need detection.
 */
export type DetectableWalletId = 'metamask' | 'coinbase' | 'okx' | 'phantom' | 'solflare' | 'plug';

/**
 * Detection checks for each wallet extension.
 * Order matters for Ethereum wallets since they share window.ethereum.
 */
const DETECTION_CHECKS: Record<DetectableWalletId, () => boolean> = {
	// Ethereum wallets - check specific flags first
	metamask: () => {
		if (typeof window === 'undefined') return false;
		// Check for MetaMask specifically, avoiding false positives from other wallets
		// that set isMetaMask for compatibility
		const eth = window.ethereum;
		if (!eth) return false;

		// If there are multiple providers, check for actual MetaMask
		if (eth.providers?.length) {
			return eth.providers.some((p) => p.isMetaMask && !p.isCoinbaseWallet && !p.isOkxWallet);
		}

		// Single provider - check it's MetaMask without other wallet flags
		return !!eth.isMetaMask && !eth.isCoinbaseWallet && !eth.isOkxWallet;
	},

	coinbase: () => {
		if (typeof window === 'undefined') return false;
		// Coinbase has its own global or sets isCoinbaseWallet
		return !!window.coinbaseWalletExtension || !!window.ethereum?.isCoinbaseWallet;
	},

	okx: () => {
		if (typeof window === 'undefined') return false;
		// OKX has its own global or sets isOkxWallet
		return !!window.okxwallet || !!window.ethereum?.isOkxWallet;
	},

	// Solana wallets - each has its own namespace
	phantom: () => {
		if (typeof window === 'undefined') return false;
		return !!window.phantom?.solana?.isPhantom;
	},

	solflare: () => {
		if (typeof window === 'undefined') return false;
		return !!window.solflare?.isSolflare;
	},

	// IC wallets
	plug: () => {
		if (typeof window === 'undefined') return false;
		return !!window.ic?.plug;
	}
};

/**
 * Check if a specific wallet extension is detected/installed.
 */
export function isWalletDetected(walletId: WalletId): boolean {
	const check = DETECTION_CHECKS[walletId as DetectableWalletId];
	if (!check) return false; // Web-based wallets return false
	try {
		return check();
	} catch {
		return false;
	}
}

/**
 * Get all detected wallet extension IDs.
 */
export function getDetectedWallets(): DetectableWalletId[] {
	return (Object.keys(DETECTION_CHECKS) as DetectableWalletId[]).filter((id) =>
		isWalletDetected(id)
	);
}

/**
 * Check if the wallet requires an extension to be installed.
 */
export function requiresExtension(walletId: WalletId): boolean {
	return walletId in DETECTION_CHECKS;
}
