<script lang="ts">
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import { tokenCreation } from "$lib/domain/tokens";
  import { canisterIds } from "$lib/constants/app.constants";
  import { api } from "$lib/actors/api.svelte";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { userPortfolio } from "$lib/domain/user";

  interface Props {
    onBack: () => void;
    onCreate: () => void;
    isCreating: boolean;
    creationError: string;
  }

  let { onBack, onCreate, isCreating, creationError }: Props = $props();

  const displayMintingAddress = $derived(
    tokenCreation.isBlackholed ? canisterIds.registry : tokenCreation.mintingAddress
  );

  let creationFeeE8s = $state<bigint | null>(null);

  const creationFeeIcp = $derived(
    creationFeeE8s !== null ? Number(creationFeeE8s) / 1e8 : null
  );

  // ICP balance check (matching market flow pattern)
  const icpToken = $derived(entityStore.getTokenBySymbol("ICP"));
  const icpBalance = $derived(
    icpToken
      ? (userPortfolio.allTokens.find((t) => t.canisterId === icpToken.canisterId)?.balance ?? 0n)
      : 0n
  );
  const insufficientBalance = $derived(
    creationFeeE8s !== null && icpBalance < creationFeeE8s
  );

  $effect(() => {
    if (!api.registry) return;
    api.registry.get_creation_fees().then((fees: { spot: bigint; ledger: bigint }) => {
      creationFeeE8s = fees.ledger;
    });
  });
</script>

<div class="space-y-6">
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-4 sm:p-6 space-y-6 overflow-hidden">
    <div>
      <h3 class="text-lg font-semibold">Review Token Details</h3>
      <p class="text-sm text-[color:var(--muted-foreground)] mt-1">Please review your token configuration before creation. Once created, these parameters cannot be changed.</p>
    </div>

    <!-- Token Summary Card -->
    <div class="bg-[color:var(--muted)]/30 rounded-[var(--radius-md)] p-4 sm:p-6 space-y-4">
      <!-- Header: Logo + Name -->
      <div class="flex items-center gap-4">
        {#if tokenCreation.logoBase64}
          <div class="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-[color:var(--border)]">
            <img src={tokenCreation.logoBase64} alt="{tokenCreation.tokenSymbol} logo" class="w-full h-full object-contain bg-[color:var(--background)]" />
          </div>
        {/if}
        <div>
          <div class="text-lg sm:text-2xl font-bold">
            {tokenCreation.tokenName}
          </div>
          <div class="text-sm text-[color:var(--muted-foreground)]">
            <span class="uppercase">{tokenCreation.tokenSymbol}</span>
          </div>
        </div>
      </div>

      <!-- Details Grid -->
      <div class="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <div class="text-xs text-[color:var(--muted-foreground)] mb-0.5">Decimals</div>
          <div class="text-sm font-semibold">{tokenCreation.decimals}</div>
        </div>
        <div>
          <div class="text-xs text-[color:var(--muted-foreground)] mb-0.5">Transfer Fee</div>
          <div class="text-sm font-semibold font-[family-name:var(--font-numeric)] tabular-nums">
            {tokenCreation.transferFee} <span class="uppercase text-xs">{tokenCreation.tokenSymbol}</span>
          </div>
        </div>
        <div>
          <div class="text-xs text-[color:var(--muted-foreground)] mb-0.5">Total Supply</div>
          <div class="text-sm font-semibold font-[family-name:var(--font-numeric)] tabular-nums">
            {tokenCreation.totalSupply} <span class="uppercase text-xs">{tokenCreation.tokenSymbol}</span>
          </div>
        </div>
        <div>
          <div class="text-xs text-[color:var(--muted-foreground)] mb-0.5 flex items-center gap-1.5">
            <span>Minting</span>
            {#if tokenCreation.isBlackholed}
              <span class="inline-flex items-center px-1.5 py-0.5 bg-[color:var(--muted)] rounded-full text-[0.625rem] font-semibold uppercase leading-none">Blackholed</span>
            {/if}
          </div>
          <div class="text-sm font-semibold">{tokenCreation.isBlackholed ? "Disabled" : "Custom"}</div>
        </div>
      </div>

      <!-- Minting Address -->
      <div>
        <div class="text-xs text-[color:var(--muted-foreground)] mb-1">Minting Address</div>
        <CopyableId id={displayMintingAddress || ''} variant="inline" full size="sm" mono />
      </div>
    </div>

    <!-- Initial Balances List -->
    <div>
      <h4 class="text-sm font-semibold mb-3">Initial Supply Distribution</h4>
      <div class="space-y-2">
        {#each tokenCreation.initialBalances as row}
          <div class="p-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)] space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
            <div class="min-w-0 sm:flex-1 sm:pr-4"><CopyableId id={row.principal} variant="inline" full size="sm" mono /></div>
            <div class="text-sm font-semibold font-[family-name:var(--font-numeric)] tabular-nums whitespace-nowrap">
              {parseFloat(row.amount).toLocaleString("en-US")} <span class="uppercase text-xs">{tokenCreation.tokenSymbol}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Error Message -->
    {#if creationError}
      <div class="bg-red-500/10 border border-red-500/20 rounded-[var(--radius-md)] p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-semibold text-red-500">Error</p>
            <p class="text-xs text-[color:var(--muted-foreground)] mt-1">{creationError}</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Creation Fee -->
    {#if creationFeeIcp !== null}
      <div class="flex items-center justify-between p-4 bg-[color:var(--muted)]/30 rounded-[var(--radius-md)]">
        <span class="text-sm text-[color:var(--muted-foreground)]">Creation Fee</span>
        <span class="text-sm font-semibold font-[family-name:var(--font-numeric)] tabular-nums">{creationFeeIcp} ICP</span>
      </div>
    {/if}

    <!-- Insufficient Balance Warning -->
    {#if insufficientBalance}
      <div class="bg-red-500/10 border border-red-500/20 rounded-[var(--radius-md)] p-4">
        <p class="text-sm font-semibold text-red-500">Insufficient ICP balance to cover the creation fee.</p>
      </div>
    {/if}

    <!-- Footer -->
    <div class="flex items-center justify-between gap-4 mt-6">
      <ButtonV2 variant="secondary" size="lg" onclick={onBack} disabled={isCreating}>Back</ButtonV2>
      <ButtonV2 variant="primary" size="lg" onclick={onCreate} disabled={isCreating || !tokenCreation.formValid || insufficientBalance}>
        {isCreating ? "Creating Token..." : "Create"}
      </ButtonV2>
    </div>
  </div>
</div>
