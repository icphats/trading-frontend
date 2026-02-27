/**
 * Ticker Actions — Svelte actions for visibility-driven polling.
 *
 * Two actions:
 * 1. `use:ticker={spotCanisterId}` — for market/pool rows (1:1 with canister)
 * 2. `use:tokenTicker={tokenCanisterId}` — for token rows (fans out to all markets)
 *
 * Both use IntersectionObserver with 100px margin to register/unregister
 * with the PollingCoordinator based on viewport visibility.
 */

import { pollingCoordinator } from './polling-coordinator.svelte';

type ActionReturn = { update: (newId: string) => void; destroy: () => void };

function createTickerAction(
  register: (id: string) => void,
  unregister: (id: string) => void,
): (node: HTMLElement, id: string) => ActionReturn {
  return (node: HTMLElement, id: string): ActionReturn => {
    let currentId = id;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            register(currentId);
          } else {
            unregister(currentId);
          }
        }
      },
      { rootMargin: '100px' },
    );

    observer.observe(node);

    return {
      update(newId: string) {
        if (newId !== currentId) {
          unregister(currentId);
          currentId = newId;
          observer.disconnect();
          observer.observe(node);
        }
      },

      destroy() {
        observer.disconnect();
        unregister(currentId);
      },
    };
  };
}

/** Market/pool row action — registers a single spot canister. */
export const ticker = createTickerAction(
  (id) => pollingCoordinator.registerVisible(id),
  (id) => pollingCoordinator.unregisterVisible(id),
);

/** Token row action — registers all markets for a token (base + quote). */
export const tokenTicker = createTickerAction(
  (id) => pollingCoordinator.registerTokenVisible(id),
  (id) => pollingCoordinator.unregisterTokenVisible(id),
);
