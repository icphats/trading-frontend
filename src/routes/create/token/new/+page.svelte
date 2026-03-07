<script lang="ts">
  import { goto } from "$app/navigation";
  import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
  import CreationLayout from "$lib/components/ui/wizard/CreationLayout.svelte";
  import StepIndicator from "$lib/components/ui/wizard/StepIndicator.svelte";
  import { tokenCreation, createdTokens } from "$lib/domain/tokens";
  import type { CreateLedgerArgs } from "$lib/actors/services/registry.service";
  import { user } from "$lib/domain/user/auth.svelte";
  import { api } from "$lib/actors/api.svelte";
  import { checkAndApprove } from "$lib/utils/allowance.utils";
  import { canisterIds } from "$lib/constants/app.constants";
  import { discoverToken } from "$lib/domain/orchestration/token-discovery";
  import Step1TokenDetails from "$lib/components/create/token/Step1TokenDetails.svelte";
  import Step2InitialSupply from "$lib/components/create/token/Step2InitialSupply.svelte";
  import Step3Confirmation from "$lib/components/create/token/Step3Confirmation.svelte";
  import Step4Success from "$lib/components/create/token/Step4Success.svelte";

  let currentStep = $state(1);
  let isCreating = $state(false);
  let creationError = $state<string>("");
  let createdTokenCanisterId = $state<string>("");

  function handleNext() {
    if (currentStep === 1 && tokenCreation.step1Valid) {
      currentStep = 2;
    } else if (currentStep === 2 && tokenCreation.step2Valid) {
      currentStep = 3;
    }
  }

  function handleBack() {
    if (currentStep === 2) {
      currentStep = 1;
    } else if (currentStep === 3) {
      currentStep = 2;
    }
  }

  async function confirmAndCreate() {
    if (!tokenCreation.formValid) {
      creationError = "Please complete all required fields correctly.";
      return;
    }

    if (!user.principal) {
      creationError = "Please connect your wallet to create a token.";
      return;
    }

    if (!api.registry) {
      creationError = "Registry service not available. Please refresh the page.";
      return;
    }

    isCreating = true;
    creationError = "";

    try {
      await checkAndApprove(canisterIds.icp_ledger!, canisterIds.registry!);

      const ledgerInitArgs = tokenCreation.prepareLedgerInitArgs(user.principal as any);
      const controllers = [user.principal as any];
      const args: CreateLedgerArgs = {
        controllers: [controllers],
        init_args: ledgerInitArgs
      };

      const result = await api.registry!.create_ledger(args);

      if ("err" in result) {
        creationError = result.err.message || "Failed to create token";
        return;
      }

      createdTokenCanisterId = result.ok.canister_id.toText();

      const discovered = await discoverToken(createdTokenCanisterId);
      if (discovered) {
        createdTokens.addToken(discovered);
      }

      currentStep = 4;
    } catch (error) {
      creationError = error instanceof Error ? error.message : "An unexpected error occurred";
    } finally {
      isCreating = false;
    }
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Tokens", href: "/create/token" },
    { label: "New", active: true },
  ];

  const stepsList = [
    { number: 1, label: "Token Details", description: "Basic token information" },
    { number: 2, label: "Initial Supply", description: "Mint tokens to addresses" },
    { number: 3, label: "Confirm", description: "Review and create" },
    { number: 4, label: "Success", description: "Token created" },
  ];
</script>

<CreationLayout>
  {#snippet breadcrumb()}
    <Breadcrumb items={breadcrumbItems} />
  {/snippet}

  {#snippet header()}
    <h1 class="text-3xl font-bold">Create Token</h1>
    <p class="text-sm text-[color:var(--muted-foreground)]">Launch your own ICRC token on the Internet Computer</p>
  {/snippet}

  {#snippet steps()}
    <StepIndicator steps={stepsList} {currentStep} />
  {/snippet}

  {#snippet content()}
    {#if currentStep === 1}
      <Step1TokenDetails onNext={handleNext} onCancel={() => goto("/create/token")} />
    {:else if currentStep === 2}
      <Step2InitialSupply onNext={handleNext} onBack={handleBack} />
    {:else if currentStep === 3}
      <Step3Confirmation onBack={handleBack} onCreate={confirmAndCreate} {isCreating} {creationError} />
    {:else if currentStep === 4}
      <Step4Success canisterId={createdTokenCanisterId} />
    {/if}
  {/snippet}
</CreationLayout>
