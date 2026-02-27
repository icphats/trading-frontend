/**
 * Oisy Wallet Signer
 *
 * Handles Oisy wallet connections via @dfinity/oisy-wallet-signer.
 * Uses ICRC-25/27/49 standards (NOT ICRC-34 delegation).
 *
 * Key difference from II:
 * - II uses ICRC-34 delegation (8hr session, no popups for calls)
 * - Oisy uses ICRC-49 (each canister call requires user approval popup)
 *
 * For trading apps, this is acceptable because:
 * - Deposits → popup (user approves transfer)
 * - Withdrawals → popup (user approves transfer)
 * - Trading → happens internally, no wallet interaction needed
 */

import { IcrcWallet } from '@dfinity/oisy-wallet-signer/icrc-wallet';
import type { IcrcAccounts } from '@dfinity/oisy-wallet-signer';
import { Principal } from '@icp-sdk/core/principal';
import { HttpAgent } from '@dfinity/agent';
import { HOST, IS_LOCAL } from '$lib/constants/app.constants';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** Result of a successful Oisy connection */
export interface OisySignerResult {
	/** The connected wallet instance (for token operations) */
	wallet: IcrcWallet;
	/** Principal string of the connected account */
	principal: string;
	/** Owner string from ICRC-27 accounts */
	owner: string;
	/** Anonymous agent for query calls (not authenticated) */
	agent: HttpAgent;
}

/** Stored session data for UI state persistence (not full session restore) */
export interface OisySessionData {
	principal: string;
	connectedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Oisy wallet sign page URL */
const OISY_SIGN_URL = 'https://oisy.com/sign';

/** LocalStorage key for Oisy connection state */
const OISY_SESSION_KEY = 'oisy-signer-session';

/** Window options for popup */
const WINDOW_OPTIONS = {
	position: 'center' as const,
	width: 500,
	height: 600
};

// ═══════════════════════════════════════════════════════════════════════════
// Error Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Custom error for user cancellation (popup closed without completing)
 */
export class OisyUserCancelledError extends Error {
	constructor(message = 'User cancelled the connection') {
		super(message);
		this.name = 'OisyUserCancelledError';
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════════════════════════════════════

/** Active Oisy wallet connection */
let activeWallet: IcrcWallet | null = null;

/** Reference to the active popup window for close detection */
let activePopupWindow: Window | null = null;
let popupPollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get the active Oisy wallet instance
 * Use this for token operations (transfer, approve)
 */
export function getOisyWallet(): IcrcWallet | null {
	return activeWallet;
}

/**
 * Cleanup active connection state
 */
function cleanupActiveConnection(): void {
	if (popupPollInterval) {
		clearInterval(popupPollInterval);
		popupPollInterval = null;
	}
	activePopupWindow = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Connect to Oisy wallet
 *
 * Opens the Oisy sign popup and establishes a connection.
 * Uses ICRC-25 for handshake and ICRC-27 for accounts.
 *
 * @returns The connection result with wallet instance and principal
 * @throws {OisyUserCancelledError} When user closes the popup
 *
 * @example
 * ```typescript
 * const result = await connectWithOisy();
 * console.log('Connected as:', result.principal);
 *
 * // Later, for token operations:
 * const wallet = getOisyWallet();
 * await wallet.transfer({ ... });
 * ```
 */
export async function connectWithOisy(): Promise<OisySignerResult> {
	// Cleanup any previous connection attempt
	cleanupActiveConnection();

	// Disconnect any existing wallet connection
	if (activeWallet) {
		try {
			await activeWallet.disconnect();
		} catch {
			// Ignore disconnect errors
		}
		activeWallet = null;
	}

	// Create a promise that rejects when popup is closed
	let rejectOnClose: ((error: OisyUserCancelledError) => void) | null = null;
	const popupClosedPromise = new Promise<never>((_, reject) => {
		rejectOnClose = reject;
	});

	// Temporarily patch window.open to capture the popup reference
	// This is necessary because IcrcWallet.connect opens the popup internally
	const originalWindowOpen = window.open.bind(window);
	window.open = function (...args: Parameters<typeof window.open>): Window | null {
		const result = originalWindowOpen(...args);
		// Capture popup if it's for Oisy
		const url = args[0];
		if (result && typeof url === 'string' && url.includes('oisy.com')) {
			activePopupWindow = result;

			// Start polling for popup closure
			popupPollInterval = setInterval(() => {
				if (activePopupWindow && activePopupWindow.closed) {
					cleanupActiveConnection();
					if (rejectOnClose) {
						rejectOnClose(new OisyUserCancelledError());
					}
				}
			}, 300);
		}
		return result;
	};

	try {
		// Connect to Oisy (opens popup, handles ICRC-25 handshake)
		// Race against popup close detection
		const wallet = await Promise.race([
			IcrcWallet.connect({
				url: OISY_SIGN_URL,
				windowOptions: WINDOW_OPTIONS,
				connectionOptions: {
					timeoutInMilliseconds: 120_000 // 2 minutes
				},
				onDisconnect: () => {
					activeWallet = null;
					clearOisySession();
				}
			}),
			popupClosedPromise
		]);

		// Request permissions for accounts
		await wallet.requestPermissions();

		// Get accounts (ICRC-27)
		const accounts: IcrcAccounts = await wallet.accounts();

		if (!accounts || accounts.length === 0) {
			throw new Error('No accounts returned from Oisy');
		}

		// Use the first account
		const account = accounts[0];
		const owner = account.owner;
		const principal = Principal.fromText(owner).toString();

		// Create anonymous agent for query calls
		// Note: Oisy doesn't provide an authenticated agent - use wallet.call() for updates
		const agent = await HttpAgent.create({ host: HOST });
		if (IS_LOCAL) {
			await agent.fetchRootKey();
		}

		// Store active wallet
		activeWallet = wallet;

		// Persist session indicator (not full session - Oisy doesn't support restore)
		persistSession(principal);

		return {
			wallet,
			principal,
			owner,
			agent
		};
	} catch (error) {
		// Re-throw OisyUserCancelledError as-is
		if (error instanceof OisyUserCancelledError) {
			throw error;
		}

		// Normalize other cancellation errors
		if (
			error instanceof Error &&
			(error.message.toLowerCase().includes('closed') ||
				error.message.toLowerCase().includes('cancel') ||
				error.message.toLowerCase().includes('disconnect') ||
				error.message.toLowerCase().includes('timeout') ||
				error.message.toLowerCase().includes('abort'))
		) {
			throw new OisyUserCancelledError();
		}
		throw error;
	} finally {
		// Restore original window.open
		window.open = originalWindowOpen;
		cleanupActiveConnection();
	}
}

/**
 * Disconnect from Oisy wallet
 */
export async function disconnectOisy(): Promise<void> {
	if (activeWallet) {
		try {
			await activeWallet.disconnect();
		} catch {
			// Ignore disconnect errors
		}
		activeWallet = null;
	}
	clearOisySession();
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Persistence
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Persist Oisy session indicator to localStorage
 * Note: Oisy doesn't support full session restore like II
 * This is just for UI state (showing "was connected to Oisy")
 */
function persistSession(principal: string): void {
	try {
		const sessionData: OisySessionData = {
			principal,
			connectedAt: Date.now()
		};
		localStorage.setItem(OISY_SESSION_KEY, JSON.stringify(sessionData));
	} catch (error) {
		console.warn('Failed to persist Oisy session:', error);
	}
}

/**
 * Clear Oisy session from localStorage
 */
export function clearOisySession(): void {
	try {
		localStorage.removeItem(OISY_SESSION_KEY);
	} catch {
		// Ignore errors
	}
}

/**
 * Check if there's a stored Oisy session indicator
 * Note: This doesn't mean we can restore the session - just that user was previously connected
 */
export function hasStoredOisySession(): boolean {
	try {
		return localStorage.getItem(OISY_SESSION_KEY) !== null;
	} catch {
		return false;
	}
}

/**
 * Get stored Oisy principal (if any)
 * Useful for showing "last connected as" in UI
 */
export function getStoredOisyPrincipal(): string | null {
	try {
		const stored = localStorage.getItem(OISY_SESSION_KEY);
		if (!stored) return null;

		const sessionData: OisySessionData = JSON.parse(stored);
		return sessionData.principal;
	} catch {
		return null;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Token Operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transfer tokens using Oisy wallet
 * This will show a popup for user approval
 *
 * @param ledgerCanisterId - The ICRC-1 ledger canister ID
 * @param to - Destination account
 * @param amount - Amount to transfer (in smallest unit)
 * @returns Block index of the transfer
 */
export async function oisyTransfer(params: {
	ledgerCanisterId: string;
	to: { owner: string; subaccount?: Uint8Array };
	amount: bigint;
	memo?: Uint8Array;
	fee?: bigint;
}): Promise<bigint> {
	const wallet = getOisyWallet();
	if (!wallet) {
		throw new Error('Oisy wallet not connected');
	}

	// Get owner from current accounts
	const accounts = await wallet.accounts();
	if (!accounts || accounts.length === 0) {
		throw new Error('No accounts available');
	}

	const blockIndex = await wallet.transfer({
		ledgerCanisterId: params.ledgerCanisterId,
		owner: accounts[0].owner,
		params: {
			to: {
				owner: Principal.fromText(params.to.owner),
				subaccount: params.to.subaccount ? [params.to.subaccount] : []
			},
			amount: params.amount,
			memo: params.memo,
			fee: params.fee
		}
	});

	return blockIndex;
}

/**
 * Approve spender using Oisy wallet
 * This will show a popup for user approval
 *
 * @param ledgerCanisterId - The ICRC-2 ledger canister ID
 * @param spender - Spender account to approve
 * @param amount - Amount to approve
 * @returns Block index of the approval
 */
export async function oisyApprove(params: {
	ledgerCanisterId: string;
	spender: { owner: string; subaccount?: Uint8Array };
	amount: bigint;
	expiresAt?: bigint;
}): Promise<bigint> {
	const wallet = getOisyWallet();
	if (!wallet) {
		throw new Error('Oisy wallet not connected');
	}

	// Get owner from current accounts
	const accounts = await wallet.accounts();
	if (!accounts || accounts.length === 0) {
		throw new Error('No accounts available');
	}

	const blockIndex = await wallet.approve({
		ledgerCanisterId: params.ledgerCanisterId,
		owner: accounts[0].owner,
		params: {
			spender: {
				owner: Principal.fromText(params.spender.owner),
				subaccount: params.spender.subaccount ? [params.spender.subaccount] : []
			},
			amount: params.amount,
			expires_at: params.expiresAt
		}
	});

	return blockIndex;
}
