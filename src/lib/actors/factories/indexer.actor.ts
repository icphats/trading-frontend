import { createActor } from "$lib/actors/create-actor";
import { idlFactory as indexerIDL } from 'declarations/indexer/indexer.did.js';
import type { _SERVICE as IndexerService } from 'declarations/indexer/indexer.did';

/**
 * Create an Indexer actor instance
 * @param canisterId - The canister ID for the indexer
 * @returns Typed actor instance for interacting with the indexer canister
 */
export function createIndexerActor(canisterId: string): IndexerService {
	return createActor<IndexerService>(indexerIDL, canisterId);
}
