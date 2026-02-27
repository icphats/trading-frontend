import { createActor } from "$lib/actors/create-actor";
import { idlFactory as ledgerIDL } from 'declarations/icrc_ledger/icrc_ledger.did.js';
import type { _SERVICE as LedgerService } from 'declarations/icrc_ledger/icrc_ledger.did';

/**
 * Create an ICRC Ledger actor instance
 * @param canisterId - The canister ID for the ledger
 * @returns Typed actor instance for interacting with the ledger canister
 */
export function createLedgerActor(canisterId: string): LedgerService {
	return createActor<LedgerService>(ledgerIDL, canisterId);
}
