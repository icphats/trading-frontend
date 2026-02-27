/**
 * Internet Identity Signer - Local Development (II 1.0)
 *
 * Uses @dfinity/auth-client for reliable local II authentication.
 * This is the traditional approach that works with local II canisters.
 */

import { DelegationIdentity } from '@dfinity/identity';
import { AuthClient } from '@dfinity/auth-client';
import { HttpAgent } from '@dfinity/agent';
import { HOST, canisterIds, DERIVATION_ORIGIN } from '$lib/constants/app.constants';
import type { IISignerResult } from './ii-signer';
import { IIUserCancelledError } from './ii-signer';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Extract port from HOST (e.g., "http://localhost:8080" -> "8080") */
const LOCAL_PORT = new URL(HOST).port || '8080';

/**
 * Local II URL - use subdomain format for Chrome/Firefox.
 * Format: http://<canister_id>.localhost:<port>
 */
const II_LOCAL_URL = `http://${canisterIds.internetIdentity}.localhost:${LOCAL_PORT}`;

/** Session duration: 8 hours in nanoseconds */
const SESSION_DURATION_NS = BigInt(8 * 60 * 60 * 1000) * BigInt(1_000_000);

/** Create auth-client with built-in idle manager disabled (we manage session expiry ourselves) */
const createAuthClient = () => AuthClient.create({ idleOptions: { disableIdle: true } });

// ═══════════════════════════════════════════════════════════════════════════
// Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Connect using @dfinity/auth-client for local development
 */
export async function connectLocal(): Promise<IISignerResult> {
	console.log('[II-Local] Connecting to:', II_LOCAL_URL);

	const authClient = await createAuthClient();

	return new Promise((resolve, reject) => {
		authClient.login({
			identityProvider: II_LOCAL_URL,
			derivationOrigin: DERIVATION_ORIGIN,
			maxTimeToLive: SESSION_DURATION_NS,
			onSuccess: async () => {
				try {
					const identity = authClient.getIdentity() as DelegationIdentity;

					const agent = HttpAgent.createSync({
						identity,
						host: HOST
					});

					await agent.fetchRootKey();

					console.log('[II-Local] ✅ Connected:', identity.getPrincipal().toString());

					resolve({
						identity,
						agent,
						principal: identity.getPrincipal().toString(),
						sessionKey: null // auth-client manages its own session
					});
				} catch (error) {
					reject(error);
				}
			},
			onError: (error) => {
				if (error?.includes?.('UserInterrupt') || error?.includes?.('closed')) {
					reject(new IIUserCancelledError());
				} else {
					reject(new Error(error || 'Authentication failed'));
				}
			}
		});
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Restore local II session using auth-client's built-in persistence
 */
export async function restoreSessionLocal(): Promise<IISignerResult | null> {
	try {
		const authClient = await createAuthClient();

		if (await authClient.isAuthenticated()) {
			const identity = authClient.getIdentity() as DelegationIdentity;

			const agent = HttpAgent.createSync({
				identity,
				host: HOST
			});

			await agent.fetchRootKey();

			console.log('[II-Local] Session restored:', identity.getPrincipal().toString());

			return {
				identity,
				agent,
				principal: identity.getPrincipal().toString(),
				sessionKey: null
			};
		}

		return null;
	} catch (error) {
		console.warn('[II-Local] Failed to restore session:', error);
		return null;
	}
}

/**
 * Clear local II session
 */
export async function clearSessionLocal(): Promise<void> {
	try {
		const authClient = await createAuthClient();
		await authClient.logout();
	} catch {
		// Ignore errors
	}
}

/**
 * Check if there's an active local session
 */
export async function hasSessionLocal(): Promise<boolean> {
	try {
		const authClient = await createAuthClient();
		return await authClient.isAuthenticated();
	} catch {
		return false;
	}
}
