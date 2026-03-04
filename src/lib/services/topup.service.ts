import type { Agent } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { IcpLedgerCanister, AccountIdentifier, SubAccount } from '@icp-sdk/canisters/ledger/icp';
import { CmcCanister } from '@icp-sdk/canisters/cmc';

const CMC_CANISTER_ID = Principal.fromText('rkp4c-7iaaa-aaaaa-aaaca-cai');
const ICP_LEDGER_CANISTER_ID = Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai');
const TOP_UP_MEMO = 0x50555054n; // "TPUP"
const ICP_FEE = 10_000n;

export { ICP_FEE };

export async function getIcpToCyclesRate(agent: Agent): Promise<bigint> {
  const cmc = CmcCanister.create({ agent, canisterId: CMC_CANISTER_ID });
  return cmc.getIcpToCyclesConversionRate({ certified: false });
}

export async function topUpCanister(
  agent: Agent,
  canisterId: string,
  icpE8s: bigint,
): Promise<bigint> {
  const targetPrincipal = Principal.fromText(canisterId);

  // Step 1: Transfer ICP to CMC subaccount derived from target canister
  const ledger = IcpLedgerCanister.create({ agent, canisterId: ICP_LEDGER_CANISTER_ID });
  const to = AccountIdentifier.fromPrincipal({
    principal: CMC_CANISTER_ID,
    subAccount: SubAccount.fromPrincipal(targetPrincipal),
  });

  const blockIndex = await ledger.transfer({
    to,
    amount: icpE8s,
    memo: TOP_UP_MEMO,
    fee: ICP_FEE,
  });

  // Step 2: Notify CMC to convert ICP to cycles
  const cmc = CmcCanister.create({ agent, canisterId: CMC_CANISTER_ID });
  const cycles = await cmc.notifyTopUp({
    canister_id: targetPrincipal,
    block_index: blockIndex,
  });

  return cycles;
}
