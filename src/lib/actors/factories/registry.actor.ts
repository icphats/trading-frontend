import { createActor } from "$lib/actors/create-actor";
import { idlFactory as registryIDL } from 'declarations/registry/registry.did.js';
import type { _SERVICE as RegistryService } from 'declarations/registry/registry.did';

/**
 * Create a Registry actor instance
 * @param canisterId - The canister ID for the registry
 * @returns Typed actor instance for interacting with the registry canister
 */
export function createRegistryActor(canisterId: string): RegistryService {
	return createActor<RegistryService>(registryIDL, canisterId);
}
