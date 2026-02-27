import { createActor } from "$lib/actors/create-actor";
import { idlFactory as spotIDL } from 'declarations/spot/spot.did.js';
import type { _SERVICE as SpotService } from 'declarations/spot/spot.did';

/**
 * Create a Spot Market actor instance
 * @param canisterId - The canister ID for the spot market
 * @returns Typed actor instance for interacting with the spot canister
 */
export function createSpotActor(canisterId: string): SpotService {
	return createActor<SpotService>(spotIDL, canisterId);
}
