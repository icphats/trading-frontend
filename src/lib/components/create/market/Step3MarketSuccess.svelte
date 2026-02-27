<script lang="ts">
  import { goto } from "$app/navigation";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import { marketCreation } from "$lib/domain/markets";

  interface Props {
    marketCanisterId: string;
  }

  let { marketCanisterId }: Props = $props();
</script>

<div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-6">
  <!-- Success Icon -->
  <div class="flex justify-center mb-6">
    <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
      <svg class="w-8 h-8 text-green-500" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
    </div>
  </div>

  <!-- Success Message -->
  <div class="text-center mb-6">
    <h3 class="text-xl font-bold mb-2">Market Created Successfully!</h3>
    <p class="text-sm text-[color:var(--muted-foreground)]">
      Your spot market for {marketCreation.selectedToken?.symbol}/{marketCreation.selectedQuoteToken?.symbol} is now live and ready for liquidity pools and trading.
    </p>
  </div>

  <!-- Market Details -->
  <div class="space-y-4 mb-6">
    <!-- Token Pair Display -->
    <div class="bg-[color:var(--muted)]/30 rounded-[var(--radius-md)] p-4">
      <div class="text-sm text-[color:var(--muted-foreground)] mb-2">Token Pair</div>
      <div class="flex items-center justify-center gap-4">
        {#if marketCreation.selectedToken}
          <div class="flex flex-col items-center">
            <Logo src={marketCreation.selectedToken.logo} alt={marketCreation.selectedToken.symbol} size="lg" />
            <span class="text-sm font-semibold mt-2">{marketCreation.selectedToken.symbol}</span>
          </div>
        {/if}

        <div class="text-2xl font-bold text-[color:var(--muted-foreground)]">/</div>

        {#if marketCreation.selectedQuoteToken}
          <div class="flex flex-col items-center">
            <Logo src={marketCreation.selectedQuoteToken.logo} alt={marketCreation.selectedQuoteToken.symbol} size="lg" />
            <span class="text-sm font-semibold mt-2">{marketCreation.selectedQuoteToken.symbol}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Market Canister ID Box -->
    <div class="bg-[color:var(--muted)]/30 rounded-[var(--radius-md)] p-4">
      <div class="text-sm text-[color:var(--muted-foreground)] mb-1">Market Canister ID</div>
      <CopyableId id={marketCanisterId} variant="outline" full />
    </div>
  </div>

  <!-- Success Info -->
  <div class="bg-green-500/10 border border-green-500/20 rounded-[var(--radius-md)] p-4 mb-6">
    <div class="flex items-start gap-3">
      <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-green-500 mb-1">What's Next?</p>
        <ul class="text-xs text-[color:var(--muted-foreground)] space-y-1 list-disc list-inside">
          <li>Create liquidity pools with different fee tiers</li>
          <li>Users can now trade this pair on the exchange</li>
          <li>Add liquidity to start earning fees</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="flex flex-col sm:flex-row gap-3">
    <ButtonV2 variant="primary" onclick={() => goto("/")} class="flex-1">Go to Home</ButtonV2>
    <ButtonV2 variant="secondary" onclick={() => goto("/create/market")} class="flex-1">Create Another Market</ButtonV2>
  </div>
</div>
