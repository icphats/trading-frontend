/**
 * Explorer utilities for Internet Computer canisters
 */

/**
 * Get the IC Dashboard explorer URL for a canister
 */
export function getCanisterExplorerUrl(canisterId: string): string {
  return `https://dashboard.internetcomputer.org/canister/${canisterId}`;
}
