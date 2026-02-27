import type { Principal } from '@icp-sdk/core/principal';
import type { Identity, Agent } from '@icp-sdk/core/agent';
import { AnonymousIdentity } from '@icp-sdk/core/agent';
import { Principal as DfinityPrincipal } from '@dfinity/principal';
import { AccountIdentifier } from '@dfinity/ledger-icp';
import { createAgent } from '@dfinity/utils';
import { HOST, IS_LOCAL } from '$lib/constants/app.constants';
import { globalPreferences } from '$lib/repositories/storage/local-storage';
import { notifyIdentityChange } from './identity-events';
import { isIIWallet, isOisyWallet, getIIProvider, type WalletId, type IIWalletId } from './wallet-config';
import {
	connectWithII,
	restoreIISession,
	clearIISession,
	hasStoredIISession,
	type IISignerResult
} from './ii-signer';
import {
	connectWithOisy,
	disconnectOisy,
	type OisySignerResult
} from './oisy-signer';

/** Authentication type - determines how actors are created */
export type AuthType = 'anonymous' | 'ii-signer' | 'oisy-signer';

/**
 * Wrapper identity that provides Principal access
 * Used for signers that don't expose raw Identity (e.g., Oisy)
 */
class PrincipalIdentityWrapper {
	private _principal: Principal;

	constructor(principalText: string) {
		this._principal = DfinityPrincipal.fromText(principalText) as unknown as Principal;
	}

	getPrincipal(): Principal {
		return this._principal;
	}

	// Minimal Identity interface support
	transformRequest(): Promise<unknown> {
		throw new Error('This identity wrapper does not support direct request transformation');
	}
}

export class User {
	// Core state - preserved for backward compatibility
	isAuthenticated: boolean = $state(false);
	identity: Identity | null = $state(null);
	agent: Agent | null = $state(null);
	isReady: boolean = $state(false);

	// Track connected wallet type
	connectedWallet: WalletId | null = $state(null);

	// Auth type - determines how actors should be created
	authType: AuthType = $state('anonymous');

	// Derived state - unchanged
	principal: Principal | null = $derived(this.identity ? this.identity.getPrincipal() : null);
	principalText: string | null = $derived(this.principal ? this.principal.toString() : null);
	accountId: AccountIdentifier | null = $derived(
		this.principal ? AccountIdentifier.fromPrincipal({ principal: this.principal }) : null
	);

	// ICRC-1 Account derived from principal
	icrcAccount = $derived.by(() => {
		if (!this.principal) return null;
		return {
			owner: this.principal,
			subaccount: [] as [] | [Uint8Array]
		};
	});

	/**
	 * Initialize user auth state.
	 * Checks for stored II signer session.
	 * ATOMIC: No state updates until agent is fully ready.
	 */
	init = async (): Promise<void> => {
		try {
			// Check for stored II session
			if (await hasStoredIISession()) {
				const iiResult = await restoreIISession();
				if (iiResult) {
					this.updateStateFromIISigner(iiResult);
					this.isReady = true;
					return;
				}
			}

			// Create anonymous agent for non-authenticated state
			const agent = await createAgent({
				identity: new AnonymousIdentity(),
				host: HOST
			});
			if (IS_LOCAL) await agent.fetchRootKey();

			this.agent = agent;
			this.identity = null;
			this.isAuthenticated = false;
			this.authType = 'anonymous';

			this.isReady = true;
		} catch (error) {
			console.error('User initialization error:', error);
			this.isReady = true;
			throw error;
		}
	};

	/**
	 * Login with a specific wallet type
	 * Routes wallets through their respective signers:
	 * - II wallets → ii-signer (ICRC-34 delegation)
	 * - Oisy → oisy-signer (ICRC-49 per-call approval)
	 * @param walletId - The wallet to connect with (defaults to 'ii' for backward compatibility)
	 */
	login = async (walletId: WalletId = 'ii'): Promise<void> => {
		this.isReady = false;

		try {
			// Clear old actor caches before connecting
			notifyIdentityChange();

			// Route II wallets through ii-signer
			if (isIIWallet(walletId)) {
				const provider = getIIProvider(walletId as IIWalletId);
				const iiResult = await connectWithII(provider);
				this.updateStateFromIISigner(iiResult);
			}
			// Route Oisy through oisy-signer
			else if (isOisyWallet(walletId)) {
				const oisyResult = await connectWithOisy();
				this.updateStateFromOisySigner(oisyResult);
			}
			// Other wallets not yet implemented
			else {
				throw new Error(`Wallet "${walletId}" is not yet implemented. Only II and Oisy are currently supported.`);
			}

			this.connectedWallet = walletId;

			// Save as recent wallet for next time
			globalPreferences.setRecentWalletId(walletId);

			this.isReady = true;
		} catch (error) {
			console.error('Login error:', error);
			this.isReady = true;
			throw error;
		}
	};

	/**
	 * Logout and reset to anonymous state.
	 * ATOMIC: Prepares everything first, then updates state together.
	 */
	logout = async (): Promise<void> => {
		this.isReady = false;

		try {
			// Clear II session if using ii-signer
			if (this.authType === 'ii-signer') {
				await clearIISession();
			}

			// Disconnect from Oisy if using oisy-signer
			if (this.authType === 'oisy-signer') {
				await disconnectOisy();
			}

			// Create anonymous agent
			const agent = await createAgent({
				identity: new AnonymousIdentity(),
				host: HOST
			});
			if (IS_LOCAL) await agent.fetchRootKey();

			// Clear old actor caches
			notifyIdentityChange();

			// ATOMIC: Set all state at once
			this.identity = null;
			this.agent = agent;
			this.isAuthenticated = false;
			this.connectedWallet = null;
			this.authType = 'anonymous';
			this.isReady = true;
		} catch (error) {
			console.error('Logout error:', error);
			this.isReady = true;
			throw error;
		}
	};

	/**
	 * Update internal state from II signer connection
	 * The agent from II signer can be used directly for authenticated calls.
	 */
	private updateStateFromIISigner = (result: IISignerResult): void => {
		// ATOMIC: Set all state at once
		this.agent = result.agent as unknown as Agent;
		this.identity = result.identity as unknown as Identity;
		this.isAuthenticated = true;
		this.authType = 'ii-signer';
	};

	/**
	 * Update internal state from Oisy signer connection
	 *
	 * Note: Oisy doesn't use delegation - each canister call requires user approval.
	 * The agent here is anonymous (for queries). For updates, use the Oisy wallet
	 * directly via getOisyWallet() and its transfer/approve methods.
	 */
	private updateStateFromOisySigner = (result: OisySignerResult): void => {
		// Create wrapper identity for principal access
		const wrapperIdentity = new PrincipalIdentityWrapper(result.principal);

		// ATOMIC: Set all state at once
		this.agent = result.agent as unknown as Agent;
		this.identity = wrapperIdentity as unknown as Identity;
		this.isAuthenticated = true;
		this.authType = 'oisy-signer';
	};
}

export const user = new User();
