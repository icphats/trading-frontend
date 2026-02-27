/**
 * Internet Identity Signer - Mainnet (II 2.0 ICRC-29/34)
 *
 * Uses @slide-computer/signer-web for II 2.0 authentication.
 * Enables OpenID provider shortcuts (Apple, Google, Microsoft).
 *
 * URLs:
 * - https://id.ai/authorize              → Generic II
 * - https://id.ai/authorize?openid=apple → Direct to Apple
 * - https://id.ai/authorize?openid=google → Direct to Google
 * - https://id.ai/authorize?openid=microsoft → Direct to Microsoft
 */

import { PostMessageTransport } from '@slide-computer/signer-web';
import { Signer } from '@slide-computer/signer';
import { DelegationIdentity, DelegationChain, Ed25519KeyIdentity } from '@dfinity/identity';
import { HttpAgent } from '@dfinity/agent';
import { HOST, DERIVATION_ORIGIN } from '$lib/constants/app.constants';
import type { IIProvider, IISignerResult, IISessionData } from './ii-signer';
import { IIUserCancelledError } from './ii-signer';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** II 2.0 ICRC-29 base URL */
const II_MAINNET_URL = 'https://id.ai/authorize';

/** Session duration: 8 hours in milliseconds */
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

/** Session duration: 8 hours in nanoseconds */
const SESSION_DURATION_NS = BigInt(SESSION_DURATION_MS) * BigInt(1_000_000);

/** LocalStorage key for II session */
const II_SESSION_KEY = 'ii-signer-session';

/** Window features for the II popup */
const WINDOW_FEATURES = 'toolbar=0,location=0,menubar=0,width=500,height=600,left=100,top=100';

// ═══════════════════════════════════════════════════════════════════════════
// Popup Tracking
// ═══════════════════════════════════════════════════════════════════════════

let activePopupWindow: Window | null = null;
let popupPollInterval: ReturnType<typeof setInterval> | null = null;

function cleanupActiveConnection(): void {
	if (popupPollInterval) {
		clearInterval(popupPollInterval);
		popupPollInterval = null;
	}
	activePopupWindow = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// URL Helpers
// ═══════════════════════════════════════════════════════════════════════════

function getIIUrl(provider: IIProvider): string {
	if (provider === 'ii') {
		return II_MAINNET_URL;
	}
	return `${II_MAINNET_URL}?openid=${provider}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Connect using ICRC-29/34 signer for mainnet
 * Enables II 2.0 with OpenID provider shortcuts
 */
export async function connectMainnet(provider: IIProvider): Promise<IISignerResult> {
	cleanupActiveConnection();

	const iiUrl = getIIUrl(provider);
	console.log('[II-Mainnet] Connecting to:', iiUrl, '| Provider:', provider);

	// Generate session key
	const sessionKey = Ed25519KeyIdentity.generate();

	// Promise that rejects when popup is closed
	let rejectOnClose: ((error: IIUserCancelledError) => void) | null = null;
	const popupClosedPromise = new Promise<never>((_, reject) => {
		rejectOnClose = reject;
	});

	// Patch window.open to capture popup reference
	const originalWindowOpen = window.open.bind(window);
	window.open = function (...args: Parameters<typeof window.open>): Window | null {
		const result = originalWindowOpen(...args);
		const url = args[0];
		if (result && typeof url === 'string' && url.includes('id.ai')) {
			activePopupWindow = result;

			popupPollInterval = setInterval(() => {
				if (activePopupWindow && activePopupWindow.closed) {
					cleanupActiveConnection();
					if (rejectOnClose) {
						rejectOnClose(new IIUserCancelledError());
					}
				}
			}, 300);
		}
		return result;
	};

	const transport = new PostMessageTransport({
		url: iiUrl,
		windowOpenerFeatures: WINDOW_FEATURES,
		establishTimeout: 120_000,
		disconnectTimeout: 2_000,
		// Disable click handler detection - our async chain (dynamic imports, etc.)
		// triggers this check, but the popup still opens fine in modern browsers
		detectNonClickEstablishment: false
	});

	try {
		const signer = new Signer({
			transport,
			derivationOrigin: DERIVATION_ORIGIN
		});

		const publicKeyDer = sessionKey.getPublicKey().toDer();
		const publicKey = new Uint8Array(publicKeyDer);

		const delegationChain = await Promise.race([
			signer.delegation({
				publicKey,
				maxTimeToLive: SESSION_DURATION_NS
			}),
			popupClosedPromise
		]);

		// Cast required: @slide-computer/signer returns @icp-sdk/core types
		const identity = DelegationIdentity.fromDelegation(
			sessionKey,
			delegationChain as unknown as DelegationChain
		);

		const agent = HttpAgent.createSync({
			identity,
			host: HOST
		});

		// Persist session
		persistSession(sessionKey, delegationChain, provider);

		console.log('[II-Mainnet] ✅ Connected:', identity.getPrincipal().toString());

		return {
			identity,
			agent,
			principal: identity.getPrincipal().toString(),
			sessionKey
		};
	} catch (error) {
		if (error instanceof IIUserCancelledError) {
			throw error;
		}

		if (
			error instanceof Error &&
			(error.message.toLowerCase().includes('closed') ||
				error.message.toLowerCase().includes('cancel') ||
				error.message.toLowerCase().includes('disconnect') ||
				error.message.toLowerCase().includes('could not be established') ||
				error.message.toLowerCase().includes('abort') ||
				error.name === 'AbortError')
		) {
			throw new IIUserCancelledError();
		}
		throw error;
	} finally {
		window.open = originalWindowOpen;
		cleanupActiveConnection();
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Management
// ═══════════════════════════════════════════════════════════════════════════

function persistSession(
	sessionKey: Ed25519KeyIdentity,
	delegationChain: { toJSON(): unknown },
	provider: IIProvider
): void {
	try {
		const sessionData: IISessionData = {
			sessionKeyJson: JSON.stringify(sessionKey.toJSON()),
			delegationChainJson: JSON.stringify(delegationChain.toJSON()),
			expiresAt: Date.now() + SESSION_DURATION_MS,
			provider
		};
		localStorage.setItem(II_SESSION_KEY, JSON.stringify(sessionData));
	} catch (error) {
		console.warn('[II-Mainnet] Failed to persist session:', error);
	}
}

/**
 * Restore mainnet II session from localStorage
 */
export async function restoreSessionMainnet(): Promise<IISignerResult | null> {
	try {
		const stored = localStorage.getItem(II_SESSION_KEY);
		if (!stored) return null;

		const sessionData: IISessionData = JSON.parse(stored);

		if (Date.now() > sessionData.expiresAt) {
			clearSessionMainnet();
			return null;
		}

		const sessionKey = Ed25519KeyIdentity.fromJSON(sessionData.sessionKeyJson);

		const delegationChain = DelegationChain.fromJSON(sessionData.delegationChainJson);

		// Check delegation expiration
		const delegations = delegationChain.delegations;
		if (delegations.length > 0) {
			const expiration = delegations[delegations.length - 1].delegation.expiration;
			if (BigInt(Date.now()) * BigInt(1_000_000) > expiration) {
				clearSessionMainnet();
				return null;
			}
		}

		const identity = DelegationIdentity.fromDelegation(sessionKey, delegationChain);

		const agent = HttpAgent.createSync({
			identity,
			host: HOST
		});

		console.log('[II-Mainnet] Session restored:', identity.getPrincipal().toString());

		return {
			identity,
			agent,
			principal: identity.getPrincipal().toString(),
			sessionKey
		};
	} catch (error) {
		console.warn('[II-Mainnet] Failed to restore session:', error);
		clearSessionMainnet();
		return null;
	}
}

/**
 * Clear mainnet II session
 */
export function clearSessionMainnet(): void {
	try {
		localStorage.removeItem(II_SESSION_KEY);
	} catch {
		// Ignore errors
	}
}

/**
 * Check if there's a stored mainnet session
 */
export function hasSessionMainnet(): boolean {
	try {
		const stored = localStorage.getItem(II_SESSION_KEY);
		if (!stored) return false;

		const sessionData: IISessionData = JSON.parse(stored);
		return Date.now() < sessionData.expiresAt;
	} catch {
		return false;
	}
}

/**
 * Get provider from stored session
 */
export function getStoredProviderMainnet(): IIProvider | null {
	try {
		const stored = localStorage.getItem(II_SESSION_KEY);
		if (!stored) return null;

		const sessionData: IISessionData = JSON.parse(stored);
		if (Date.now() > sessionData.expiresAt) return null;

		return sessionData.provider;
	} catch {
		return null;
	}
}
