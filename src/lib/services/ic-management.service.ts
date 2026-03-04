import type { Agent } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { IcManagementCanister, type CanisterStatusResponse } from '@icp-sdk/canisters/ic-management';

export type { CanisterStatusResponse };

export async function getCanisterStatus(
  agent: Agent,
  canisterId: string,
): Promise<CanisterStatusResponse> {
  const mgmt = IcManagementCanister.create({ agent });
  return mgmt.canisterStatus({ canisterId: Principal.fromText(canisterId) });
}
