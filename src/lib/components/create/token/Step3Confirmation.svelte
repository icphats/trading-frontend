<script lang="ts">
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import { tokenCreation } from "$lib/domain/tokens";
  import { canisterIds } from "$lib/constants/app.constants";
  import { api } from "$lib/actors/api.svelte";

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

  $effect(() => {
    if (!api.registry) return;
    api.registry.get_creation_fees().then((fees) => {
      creationFeeE8s = fees.ledger;
    });
  });
</script>

<div class="space-y-6">
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-6 space-y-6 overflow-hidden">
    <div>
      <h3 class="text-lg font-semibold">Review Token Details</h3>
      <p class="text-sm text-[color:var(--muted-foreground)] mt-1">Please review your token configuration before creation. Once created, these parameters cannot be changed.</p>
    </div>

    <!-- Token Summary Card -->
    <div class="bg-[color:var(--muted)]/30 rounded-[var(--radius-md)] p-6">
    <div class="flex items-start gap-6">
      <!-- Logo -->
      {#if tokenCreation.logoBase64}
        <div class="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 border-2 border-[color:var(--border)]">
          <img src={tokenCreation.logoBase64} alt="{tokenCreation.tokenSymbol} logo" class="w-full h-full object-contain bg-[color:var(--background)]" />
        </div>
      {/if}

      <!-- Token Info -->
      <div class="flex-1 space-y-4">
        <div>
          <div class="text-2xl font-bold">
            {tokenCreation.tokenName} (<span class="uppercase">{tokenCreation.tokenSymbol}</span>)
          </div>
          <div class="text-sm text-[color:var(--muted-foreground)] mt-1">
            {tokenCreation.decimals} decimals • {tokenCreation.transferFee} <span class="uppercase">{tokenCreation.tokenSymbol}</span> transfer fee
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-xs text-[color:var(--muted-foreground)] mb-1 flex items-center gap-2">
              <span>Minting Address</span>
              {#if tokenCreation.isBlackholed}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-[color:var(--muted)] rounded-full text-[0.625rem] font-semibold uppercase">
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                  Blackholed
                </span>
              {/if}
            </div>
            <CopyableId id={displayMintingAddress || ''} variant="outline" full size="sm" />
            {#if tokenCreation.isBlackholed}
              <div class="text-xs text-[color:var(--muted-foreground)] mt-1">Registry canister - no minting possible</div>
            {/if}
          </div>
          <div>
            <div class="text-xs text-[color:var(--muted-foreground)] mb-1">Total Supply</div>
            <div class="text-sm font-semibold font-[family-name:var(--font-numeric)] tabular-nums">
              {tokenCreation.totalSupply} <span class="uppercase">{tokenCreation.tokenSymbol}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Initial Balances List -->
    <div>
      <h4 class="text-sm font-semibold mb-3">Initial Supply Distribution</h4>
      <div class="space-y-2">
        {#each tokenCreation.initialBalances as row}
          <div class="flex items-center justify-between p-3 bg-[color:var(--background)] border border-[color:var(--border)] rounded-[var(--radius-md)]">
            <div class="flex-1 pr-4"><CopyableId id={row.principal} variant="outline" full size="sm" /></div>
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

    <!-- Footer -->
    <div class="flex items-center justify-between gap-4 mt-6">
      <ButtonV2 variant="secondary" size="xl" onclick={onBack} disabled={isCreating}>Back</ButtonV2>
      <ButtonV2 variant="primary" size="xl" onclick={onCreate} disabled={isCreating || !tokenCreation.formValid}>
        {isCreating ? "Creating Token..." : "Create"}
      </ButtonV2>
    </div>
  </div>
</div>
