/**
 * Internet Identity Signer - Router
 *
 * Routes II authentication to the appropriate implementation:
 * - LOCAL: Uses auth-client (II 1.0) via ii-signer-local.ts
 * - MAINNET: Uses ICRC-29/34 signer (II 2.0) via ii-signer-mainnet.ts
 *
 * This separation exists because local II 2.0 support isn't fully ready yet.
 * Once DFINITY releases local II 2.0 support, we can consolidate to mainnet-only.
 */

import { DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';
import { HttpAgent } from '@dfinity/agent';
import { IS_LOCAL } from '$lib/constants/app.constants';

// ═══════════════════════════════════════════════════════════════════════════
// Types (shared across implementations)
// ═══════════════════════════════════════════════════════════════════════════

/** OpenID providers supported by II 2.0 (mainnet only) */
export type IIProvider = 'ii' | 'apple' | 'google' | 'microsoft';

/** Result of a successful II connection */
export interface IISignerResult {
	identity: DelegationIdentity;
	agent: HttpAgent;
	principal: string;
	/** Session key for persistence (mainnet only, null for local auth-client) */
	sessionKey: Ed25519KeyIdentity | null;
}

/** Stored session data for persistence (mainnet ICRC-34 sessions) */
export interface IISessionData {
	sessionKeyJson: string;
	delegationChainJson: string;
	expiresAt: number;
	provider: IIProvider;
}

// ═══════════════════════════════════════════════════════════════════════════
// Error Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Custom error for user cancellation (popup closed without completing login)
 */
export class IIUserCancelledError extends Error {
	constructor(message = 'User cancelled the login') {
		super(message);
		this.name = 'IIUserCancelledError';
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Connect to Internet Identity
 *
 * Routes to appropriate implementation:
 * - LOCAL: auth-client (II 1.0) - reliable local development
 * - MAINNET: ICRC-29/34 signer (II 2.0) - enables OpenID shortcuts
 *
 * @param provider - The OpenID provider (ii, apple, google, microsoft)
 *                   Note: Provider shortcuts only work on mainnet
 * @returns Connection result with identity, agent, and principal
 * @throws {IIUserCancelledError} When user closes popup without completing login
 */
export async function connectWithII(provider: IIProvider): Promise<IISignerResult> {
	if (IS_LOCAL) {
		const { connectLocal } = await import('./ii-signer-local');
		return connectLocal();
	} else {
		const { connectMainnet } = await import('./ii-signer-mainnet');
		return connectMainnet(provider);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Restore II session
 *
 * - LOCAL: Uses auth-client's built-in session persistence
 * - MAINNET: Restores ICRC-34 delegation from localStorage
 */
export async function restoreIISession(): Promise<IISignerResult | null> {
	if (IS_LOCAL) {
		const { restoreSessionLocal } = await import('./ii-signer-local');
		return restoreSessionLocal();
	} else {
		const { restoreSessionMainnet } = await import('./ii-signer-mainnet');
		return restoreSessionMainnet();
	}
}

/**
 * Clear II session
 */
export async function clearIISession(): Promise<void> {
	if (IS_LOCAL) {
		const { clearSessionLocal } = await import('./ii-signer-local');
		await clearSessionLocal();
	} else {
		const { clearSessionMainnet } = await import('./ii-signer-mainnet');
		clearSessionMainnet();
	}
}

/**
 * Check if there's a stored II session
 */
export async function hasStoredIISession(): Promise<boolean> {
	if (IS_LOCAL) {
		const { hasSessionLocal } = await import('./ii-signer-local');
		return hasSessionLocal();
	} else {
		const { hasSessionMainnet } = await import('./ii-signer-mainnet');
		return hasSessionMainnet();
	}
}

/**
 * Get the provider from a stored session
 * Returns 'ii' for local (no provider shortcuts)
 */
export async function getStoredIIProvider(): Promise<IIProvider | null> {
	if (IS_LOCAL) {
		// Local doesn't support provider shortcuts
		const { hasSessionLocal } = await import('./ii-signer-local');
		return (await hasSessionLocal()) ? 'ii' : null;
	} else {
		const { getStoredProviderMainnet } = await import('./ii-signer-mainnet');
		return getStoredProviderMainnet();
	}
}
