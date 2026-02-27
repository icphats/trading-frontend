import { Actor } from "@icp-sdk/core/agent";
import { AnonymousIdentity } from "@icp-sdk/core/agent";
import { createAgent } from "@dfinity/utils";
import { createActor } from "$lib/actors/create-actor";
import { idlFactory as minterIDL } from 'declarations/minter/minter.did.js';
import { idlFactory as registryIDL } from 'declarations/registry/registry.did.js';
import { idlFactory as indexerIDL } from 'declarations/indexer/indexer.did.js';
import { idlFactory as trollboxIDL } from 'declarations/trollbox/trollbox.did.js';
import { idlFactory as treasuryIDL } from 'declarations/treasury/treasury.did.js';
import { idlFactory as oracleIDL } from 'declarations/oracle/oracle.did.js';
import type { _SERVICE as MinterService } from 'declarations/minter/minter.did';
import type { _SERVICE as RegistryService } from 'declarations/registry/registry.did';
import type { _SERVICE as IndexerService } from 'declarations/indexer/indexer.did';
import type { _SERVICE as TrollboxService } from 'declarations/trollbox/trollbox.did';
import type { _SERVICE as TreasuryService } from 'declarations/treasury/treasury.did';
import type { _SERVICE as OracleService } from 'declarations/oracle/oracle.did';
import { canisterIds, HOST, IS_LOCAL } from "$lib/constants/app.constants";

export class API {
    // Public actors (anonymous, no auth required)
    indexer: IndexerService | null = $state(null);
    treasury: TreasuryService | null = $state(null);
    oracle: OracleService | null = $state(null);

    // Authenticated actors (require user agent)
    minter: MinterService | null = $state(null);
    registry: RegistryService | null = $state(null);
    trollbox: TrollboxService | null = $state(null);

    /**
     * Initialize public actors with anonymous agent
     * Can be called immediately without waiting for user auth
     * Fast path for read-only data (indexer, pricing, etc.)
     */
    initPublic = async (): Promise<void> => {
        if (!canisterIds.indexer) {
            throw new Error('Missing indexer canister ID in environment');
        }

        // Create anonymous agent with root key (for local dev)
        const anonAgent = await createAgent({
            identity: new AnonymousIdentity(),
            host: HOST
        });
        if (IS_LOCAL) {
            await anonAgent.fetchRootKey();
        }

        this.indexer = Actor.createActor(indexerIDL as any, {
            agent: anonAgent,
            canisterId: canisterIds.indexer
        });

        // oracle is optional (may not be deployed in all environments)
        if (canisterIds.oracle) {
            this.oracle = Actor.createActor(oracleIDL as any, {
                agent: anonAgent,
                canisterId: canisterIds.oracle
            });
        }

        // treasury is optional (may not be deployed in all environments)
        if (canisterIds.treasury) {
            this.treasury = Actor.createActor(treasuryIDL as any, {
                agent: anonAgent,
                canisterId: canisterIds.treasury
            });
        }
    };

    /**
     * Initialize authenticated actors with user agent
     * Called after user.init() completes
     */
    init = async (): Promise<void> => {
        if (!canisterIds.minter || !canisterIds.registry || !canisterIds.trollbox) {
            throw new Error('Missing required canister IDs in environment');
        }
        this.minter = createActor<MinterService>(minterIDL, canisterIds.minter);
        this.registry = createActor<RegistryService>(registryIDL, canisterIds.registry);
        this.trollbox = createActor<TrollboxService>(trollboxIDL, canisterIds.trollbox);

    };
}

export const api = new API();