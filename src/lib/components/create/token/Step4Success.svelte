<script lang="ts">
  import { goto } from "$app/navigation";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import { tokenCreation } from "$lib/domain/tokens";

  interface Props {
    canisterId: string;
  }

  let { canisterId }: Props = $props();

  function handleGoHome() {
    tokenCreation.reset();
    goto("/");
  }

  function handleCreateMarket() {
    tokenCreation.reset();
    goto("/create/market");
  }
</script>

<div class="space-y-6">
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-6 space-y-6 overflow-hidden">
    <!-- Success Icon and Header -->
    <div class="text-center">
    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
      <svg class="w-8 h-8 text-green-500" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
      </svg>
    </div>
      <h3 class="text-2xl font-bold mb-2">Token Created Successfully!</h3>
      <p class="text-sm text-[color:var(--muted-foreground)]">
        Your {tokenCreation.tokenSymbol} token has been deployed to the Internet Computer
      </p>
    </div>

    <!-- Token Summary Card -->
    <div class="bg-[color:var(--muted)]/30 rounded-[var(--radius-md)] p-6">
    <div class="flex items-start gap-6">
      <!-- Logo -->
      {#if tokenCreation.logoBase64}
        <div class="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-[color:var(--border)]">
          <img src={tokenCreation.logoBase64} alt="{tokenCreation.tokenSymbol} logo" class="w-full h-full object-contain bg-[color:var(--background)]" />
        </div>
      {/if}

      <!-- Token Info -->
      <div class="flex-1 space-y-3">
        <div>
          <div class="text-xl font-bold">
            {tokenCreation.tokenName} (<span class="uppercase">{tokenCreation.tokenSymbol}</span>)
          </div>
          <div class="text-sm text-[color:var(--muted-foreground)] mt-1">
            {tokenCreation.decimals} decimals • {tokenCreation.totalSupply} <span class="uppercase">{tokenCreation.tokenSymbol}</span> total supply
          </div>
        </div>

        <div>
          <div class="text-xs text-[color:var(--muted-foreground)] mb-1">Canister ID</div>
          <CopyableId id={canisterId} variant="outline" full />
        </div>
      </div>
    </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center gap-4 mt-6">
      <ButtonV2 variant="secondary" size="xl" onclick={handleGoHome}>Go to Home</ButtonV2>
      <ButtonV2 variant="primary" size="xl" onclick={handleCreateMarket} class="flex-1">
        Create Market for {tokenCreation.tokenSymbol}
      </ButtonV2>
    </div>
  </div>
</div>
