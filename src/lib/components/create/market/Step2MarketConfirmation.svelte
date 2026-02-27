<script lang="ts">
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { marketCreation } from "$lib/domain/markets";
  import { createMarket, isRegistryAvailable, type SpotMarketMetadata } from "$lib/domain/orchestration";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { Principal } from "@dfinity/principal";
  import { api } from "$lib/actors/api.svelte";

  interface Props {
    onBack: () => void;
    onCreate: () => void;
    isCreating: boolean;
    creationError: string;
    onCreatingChange: (value: boolean) => void;
    onErrorChange: (value: string) => void;
  }

  let { onBack, onCreate, isCreating, creationError, onCreatingChange, onErrorChange }: Props = $props();

  let creationFeeE8s = $state<bigint | null>(null);

  const creationFeeIcp = $derived(
    creationFeeE8s !== null ? Number(creationFeeE8s) / 1e8 : null
  );

  $effect(() => {
    if (!api.registry) return;
    api.registry.get_creation_fees().then((fees) => {
      creationFeeE8s = fees.spot;
    });
  });

  /**
   * Create spot market for selected token pair
   */
  async function handleCreateMarket() {
    if (!marketCreation.selectedToken || !marketCreation.selectedQuoteToken || isCreating || !isRegistryAvailable()) return;

    onCreatingChange(true);
    onErrorChange("");

    try {
      // Create spot market with token principals
      const ledgerPrincipal = Principal.fromText(marketCreation.selectedToken.canisterId);
      const quotePrincipal = Principal.fromText(marketCreation.selectedQuoteToken.canisterId);
      const tokenSymbol = marketCreation.selectedToken.symbol;
      const quoteSymbol = marketCreation.selectedQuoteToken.symbol;

      await toastState.show({
        async: true,
        promise: createMarket({
          base: ledgerPrincipal,
          quote: quotePrincipal,
        }).then((r) => {
          if ("err" in r) throw new Error(r.err);
          return r;
        }),
        messages: {
          loading: `Creating ${tokenSymbol}/${quoteSymbol} market...`,
          success: (result) => {
            const metadata: SpotMarketMetadata = result.ok;
            marketCreation.marketCanisterId = metadata.canister_id.toString();
            onCreate();
            return `${tokenSymbol}/${quoteSymbol} market created successfully!`;
          },
          error: (error) => {
            const errorMsg = error instanceof Error ? error.message : "Failed to create market";
            console.error("Error creating market:", errorMsg);
            onErrorChange(errorMsg);
            return errorMsg;
          },
        },
      });
    } catch (error) {
      console.error("Error creating market:", error);
      onErrorChange(error instanceof Error ? error.message : "Failed to create market");
    } finally {
      onCreatingChange(false);
    }
  }
</script>

<div class="space-y-6">
  <div class="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-6 space-y-6 overflow-hidden">
    <div>
      <h3 class="text-lg font-semibold">Confirm Market Creation</h3>
      <p class="text-sm text-[color:var(--muted-foreground)] mt-1">Review the details below before creating your new spot market.</p>
    </div>

    <!-- Market Summary Card -->
    <div class="bg-[color:var(--muted)]/30 rounded-[var(--radius-md)] p-6">
    <div class="flex items-center justify-center gap-4 mb-4">
      <!-- Base Token -->
      {#if marketCreation.selectedToken}
        <div class="flex flex-col items-center">
          <Logo src={marketCreation.selectedToken.logo} alt={marketCreation.selectedToken.symbol} size="xl" />
          <span class="text-lg font-bold mt-2">{marketCreation.selectedToken.symbol}</span>
          <span class="text-xs text-[color:var(--muted-foreground)]">Base Token</span>
        </div>
      {/if}

      <!-- Separator -->
      <div class="text-3xl font-bold text-[color:var(--muted-foreground)]">/</div>

      <!-- Quote Token -->
      {#if marketCreation.selectedQuoteToken}
        <div class="flex flex-col items-center">
          <Logo src={marketCreation.selectedQuoteToken.logo} alt={marketCreation.selectedQuoteToken.symbol} size="xl" />
          <span class="text-lg font-bold mt-2">{marketCreation.selectedQuoteToken.symbol}</span>
          <span class="text-xs text-[color:var(--muted-foreground)]">Quote Token</span>
        </div>
      {/if}
    </div>

      <div class="text-center">
        <div class="text-sm text-[color:var(--muted-foreground)]">
          Creating spot market for <strong>{marketCreation.selectedToken?.symbol}/{marketCreation.selectedQuoteToken?.symbol}</strong>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    {#if creationError}
      <div class="bg-red-500/10 border border-red-500/20 rounded-[var(--radius-md)] p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-semibold text-red-500">Error</p>
            <p class="text-xs text-[color:var(--muted-foreground)] mt-1">{creationError}</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Info Box -->
    <div class="bg-blue-500/10 border border-blue-500/20 rounded-[var(--radius-md)] p-4">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-semibold text-blue-500">What happens next?</p>
          <p class="text-xs text-[color:var(--muted-foreground)] mt-1">A new spot market canister will be deployed for this token pair. After creation, users can create liquidity pools and trade this pair on the exchange.</p>
        </div>
      </div>
    </div>

    <!-- Creation Fee -->
    {#if creationFeeIcp !== null}
      <div class="flex items-center justify-between p-4 bg-[color:var(--muted)]/30 rounded-[var(--radius-md)]">
        <span class="text-sm text-[color:var(--muted-foreground)]">Creation Fee</span>
        <span class="text-sm font-semibold font-[family-name:var(--font-numeric)] tabular-nums">{creationFeeIcp} ICP</span>
      </div>
    {/if}

    <!-- Footer: Action Buttons -->
    <div class="flex items-center justify-between gap-4 mt-6">
      <ButtonV2 variant="secondary" size="xl" onclick={onBack} disabled={isCreating}>Back</ButtonV2>
      <ButtonV2 variant="primary" size="xl" onclick={handleCreateMarket} disabled={isCreating}>
        {isCreating ? "Creating Market..." : "Create Market"}
      </ButtonV2>
    </div>
  </div>
</div>
