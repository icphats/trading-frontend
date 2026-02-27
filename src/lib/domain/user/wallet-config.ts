/**
 * Wallet Configuration
 *
 * Central configuration for enabling/disabling wallets.
 * Change these flags to control which wallets appear in the UI.
 */

export type WalletId =
	// IC Native
	| 'ii'
	| 'ii-apple'
	| 'ii-google'
	| 'ii-microsoft'
	| 'nfid'
	| 'plug'
	| 'oisy'
	// Ethereum (SIWE)
	| 'metamask'
	| 'walletconnect'
	| 'coinbase'
	| 'okx'
	// Solana (SIWS)
	| 'phantom'
	| 'solflare';

/** II provider subtypes for ICRC-29 routing */
export type IIProvider = 'ii' | 'apple' | 'google' | 'microsoft';

/** All II-based wallet IDs */
export type IIWalletId = 'ii' | 'ii-apple' | 'ii-google' | 'ii-microsoft';

/** Base wallet IDs that have configs (excludes virtual II provider variants) */
export type BaseWalletId = Exclude<WalletId, 'ii-apple' | 'ii-google' | 'ii-microsoft'>;

export type WalletCategory = 'ic' | 'ethereum' | 'solana';

export interface WalletConfig {
	id: BaseWalletId;
	name: string;
	icon: string;
	description?: string;
	enabled: boolean;
	category: WalletCategory;
	downloadUrl?: string;
	/** Whether wallet requires browser extension to be detected */
	requiresDetection?: boolean;
	/** Whether this is a featured wallet (shown at top) */
	featured?: boolean;
	/** Whether this wallet is detected/installed in the browser (runtime) */
	detected?: boolean;
	/** Whether this was the most recently used wallet (runtime) */
	recent?: boolean;
}

/**
 * Master wallet configuration
 * Set enabled: false to hide wallet from UI
 * Note: Virtual II provider IDs (ii-apple, ii-google, ii-microsoft) don't have configs
 *       as they all route through the main II entry with provider shortcuts
 */
export const WALLET_CONFIG: Record<BaseWalletId, WalletConfig> = {
	// ═══════════════════════════════════════════════════════════════════════════
	// IC Native Wallets (no SIWE/SIWS needed)
	// ═══════════════════════════════════════════════════════════════════════════
	ii: {
		id: 'ii',
		name: 'Internet Identity',
		icon: '/wallets/internet-identity.svg',
		description: 'Passwordless authentication',
		enabled: false, // Handled by ii-signer, shown as provider buttons at top
		category: 'ic',
		featured: false
	},
	nfid: {
		id: 'nfid',
		name: 'NFID',
		icon: '/wallets/nfid.png',
		description: 'Sign in with Google or Email',
		enabled: false, // TODO: Implement directly with NFID SDK
		category: 'ic'
	},
	plug: {
		id: 'plug',
		name: 'Plug',
		icon: '/wallets/plug.png',
		description: 'IC browser wallet',
		enabled: false, // TODO: Implement directly with @psychedelic/plug-connect
		category: 'ic',
		downloadUrl: 'https://plugwallet.ooo/',
		requiresDetection: true
	},
	oisy: {
		id: 'oisy',
		name: 'Oisy',
		icon: '/wallets/oisy.svg',
		description: 'Multi-chain IC wallet',
		enabled: true,
		category: 'ic'
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// Ethereum Wallets (requires SIWE canister)
	// ═══════════════════════════════════════════════════════════════════════════
	metamask: {
		id: 'metamask',
		name: 'MetaMask',
		icon: '/wallets/metamask-icon.svg',
		enabled: false, // TODO: Implement directly with ic-siwe-js
		category: 'ethereum',
		downloadUrl: 'https://metamask.io/download/',
		requiresDetection: true,
		featured: true
	},
	walletconnect: {
		id: 'walletconnect',
		name: 'WalletConnect',
		icon: '/wallets/walletconnect-icon.svg',
		enabled: false, // TODO: Implement directly with ic-siwe-js
		category: 'ethereum'
	},
	coinbase: {
		id: 'coinbase',
		name: 'Coinbase Wallet',
		icon: '/wallets/coinbase-icon.svg',
		enabled: false, // TODO: Implement directly with ic-siwe-js
		category: 'ethereum',
		downloadUrl: 'https://www.coinbase.com/wallet',
		requiresDetection: true
	},
	okx: {
		id: 'okx',
		name: 'OKX Wallet',
		icon: '/wallets/okx.svg',
		enabled: false, // TODO: Implement directly with ic-siwe-js
		category: 'ethereum',
		downloadUrl: 'https://www.okx.com/web3',
		requiresDetection: true
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// Solana Wallets (requires SIWS canister)
	// ═══════════════════════════════════════════════════════════════════════════
	phantom: {
		id: 'phantom',
		name: 'Phantom',
		icon: '/wallets/phantom-icon.png',
		enabled: false, // TODO: Implement directly with ic-siws-js
		category: 'solana',
		downloadUrl: 'https://phantom.app/',
		requiresDetection: true
	},
	solflare: {
		id: 'solflare',
		name: 'Solflare',
		icon: '/wallets/solflare.svg',
		enabled: false, // TODO: Implement directly with ic-siws-js
		category: 'solana',
		downloadUrl: 'https://solflare.com/',
		requiresDetection: true
	}
};

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all enabled wallets
 */
export function getEnabledWallets(): WalletConfig[] {
	return Object.values(WALLET_CONFIG).filter((w) => w.enabled);
}

/**
 * Get enabled wallets by category
 */
export function getEnabledWalletsByCategory(category: WalletCategory): WalletConfig[] {
	return getEnabledWallets().filter((w) => w.category === category);
}

/**
 * Get featured wallets (shown prominently at top)
 */
export function getFeaturedWallets(): WalletConfig[] {
	return getEnabledWallets().filter((w) => w.featured);
}

/**
 * Get non-featured enabled wallets
 */
export function getOtherWallets(): WalletConfig[] {
	return getEnabledWallets().filter((w) => !w.featured);
}

/**
 * Check if any Ethereum wallets are enabled (requires SIWE canister)
 */
export function hasEthereumWallets(): boolean {
	return getEnabledWalletsByCategory('ethereum').length > 0;
}

/**
 * Check if any Solana wallets are enabled (requires SIWS canister)
 */
export function hasSolanaWallets(): boolean {
	return getEnabledWalletsByCategory('solana').length > 0;
}

/**
 * Get wallet config by ID
 * Returns undefined for virtual II provider IDs (ii-apple, ii-google, ii-microsoft)
 */
export function getWalletById(id: WalletId): WalletConfig | undefined {
	if (id === 'ii-apple' || id === 'ii-google' || id === 'ii-microsoft') {
		return WALLET_CONFIG['ii']; // Virtual IDs fall back to main II config
	}
	return WALLET_CONFIG[id as BaseWalletId];
}

// ═══════════════════════════════════════════════════════════════════════════
// II Provider Helpers (for ICRC-29 routing)
// ═══════════════════════════════════════════════════════════════════════════

/** II wallet IDs that route through ii-signer */
const II_WALLET_IDS: IIWalletId[] = ['ii', 'ii-apple', 'ii-google', 'ii-microsoft'];

/**
 * Check if a wallet ID is an II-based wallet (uses ii-signer)
 */
export function isIIWallet(walletId: WalletId): walletId is IIWalletId {
	return II_WALLET_IDS.includes(walletId as IIWalletId);
}

/**
 * Check if a wallet ID is Oisy (uses oisy-signer)
 */
export function isOisyWallet(walletId: WalletId): boolean {
	return walletId === 'oisy';
}

/**
 * Get the II provider from a wallet ID
 * Returns the provider shortcut for ICRC-29 URL routing
 */
export function getIIProvider(walletId: IIWalletId): IIProvider {
	switch (walletId) {
		case 'ii-apple':
			return 'apple';
		case 'ii-google':
			return 'google';
		case 'ii-microsoft':
			return 'microsoft';
		case 'ii':
		default:
			return 'ii';
	}
}
