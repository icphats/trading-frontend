import { Actor } from '@icp-sdk/core/agent';
import type { IDL } from '@dfinity/candid';
import { user } from '$lib/domain/user/auth.svelte';

/**
 * Create an actor for interacting with a canister.
 *
 * Routing based on authType:
 * - 'ii-signer': Uses standard agent-based approach (II signer provides authenticated agent)
 * - 'oisy-signer': Uses anonymous agent (Oisy doesn't support delegation)
 *     - Query calls work normally
 *     - Update calls will fail - use Oisy wallet directly for token operations
 * - 'anonymous': Uses standard agent-based approach with anonymous agent
 *
 * For Oisy wallet token operations (transfer, approve), use the helpers in oisy-signer.ts:
 * - oisyTransfer() for ICRC-1 transfers
 * - oisyApprove() for ICRC-2 approvals
 */
export const createActor = <T>(idl: IDL.InterfaceFactory, canisterId: string): T => {
	if (!user.agent) {
		console.warn(
			`[createActor] Creating actor for ${canisterId} before user.agent is ready - this may cause cert errors`
		);
	}
	return Actor.createActor(idl as any, { agent: user.agent ?? undefined, canisterId }) as T;
};
