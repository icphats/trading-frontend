<script lang="ts">
  import { goto } from "$app/navigation";
  import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
  import CreationLayout from "$lib/components/ui/wizard/CreationLayout.svelte";
  import StepIndicator from "$lib/components/ui/wizard/StepIndicator.svelte";
  import Step1MarketPair from "$lib/components/create/market/Step1MarketPair.svelte";
  import Step2MarketConfirmation from "$lib/components/create/market/Step2MarketConfirmation.svelte";
  import Step3MarketSuccess from "$lib/components/create/market/Step3MarketSuccess.svelte";
  import { marketCreation } from "$lib/domain/markets";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";

  // Current step tracking
  let currentStep = $state(1);

  // Creation state
  let isCreating = $state(false);
  let creationError = $state<string>("");

  // Initialize quote token to ICP on mount
  $effect(() => {
    if (!marketCreation.selectedQuoteToken) {
      const icpToken = entityStore.getTokenBySymbol("ICP");
      if (icpToken) {
        // Convert NormalizedToken to TokenMetadata format
        marketCreation.selectedQuoteToken = {
          canisterId: icpToken.canisterId,
          name: icpToken.name,
          displayName: icpToken.displayName,
          symbol: icpToken.symbol,
          displaySymbol: icpToken.displaySymbol,
          decimals: icpToken.decimals,
          fee: icpToken.fee,
          logo: icpToken.logo ?? undefined,
        };
      }
    }
  });

  function handleNext() {
    if (currentStep === 1 && marketCreation.step1Valid) {
      currentStep = 2;
    }
  }

  function handleBack() {
    if (currentStep === 2) {
      currentStep = 1;
    }
  }

  function handleCreate() {
    // Move to success step after creation
    currentStep = 3;
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Market", active: true },
  ];

  const stepsList = [
    { number: 1, label: "Select Token Pair", description: "Choose base and quote tokens" },
    { number: 2, label: "Confirm", description: "Review and create market" },
    { number: 3, label: "Success", description: "Market created" },
  ];
</script>

<CreationLayout>
  {#snippet breadcrumb()}
    <Breadcrumb items={breadcrumbItems} />
  {/snippet}

  {#snippet header()}
    <h1 class="text-3xl font-bold">Create Spot Market</h1>
  {/snippet}

  {#snippet steps()}
    <StepIndicator steps={stepsList} {currentStep} stickyTop="2rem" />
  {/snippet}

  {#snippet content()}
    {#if currentStep === 1}
      <Step1MarketPair onNext={handleNext} onCancel={() => goto("/")} />
    {:else if currentStep === 2}
      <Step2MarketConfirmation
        onBack={handleBack}
        onCreate={handleCreate}
        {isCreating}
        {creationError}
        onCreatingChange={(value) => (isCreating = value)}
        onErrorChange={(value) => (creationError = value)}
      />
    {:else if currentStep === 3}
      <Step3MarketSuccess marketCanisterId={marketCreation.marketCanisterId} />
    {/if}
  {/snippet}
</CreationLayout>
