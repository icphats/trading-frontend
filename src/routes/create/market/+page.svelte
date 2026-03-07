<script lang="ts">
  import { goto } from "$app/navigation";
  import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import EmptyState from "$lib/components/ui/list/EmptyState.svelte";
  import CreatedMarketsList from "$lib/components/create/market/CreatedMarketsList.svelte";
  import { createdMarkets } from "$lib/domain/markets";
  import { user } from "$lib/domain/user/auth.svelte";
  import { api } from "$lib/actors/api.svelte";

  $effect(() => {
    if (user.principal && api.registry) {
      createdMarkets.load();
    }
  });

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Markets", active: true },
  ];
</script>

<div class="mx-auto max-w-5xl px-4 py-8 space-y-6">
  <Breadcrumb items={breadcrumbItems} />

  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-bold">Your Markets</h1>
    <ButtonV2 variant="primary" size="md" onclick={() => goto("/create/market/new")}>
      Create Market
    </ButtonV2>
  </div>

  {#if !user.isAuthenticated}
    <EmptyState
      message="Connect your wallet"
      hint="Sign in to view markets you've created"
    />
  {:else if createdMarkets.isLoading && !createdMarkets.hasFetched}
    <EmptyState variant="loading" message="Loading your markets..." />
  {:else if createdMarkets.error}
    <EmptyState variant="error" message="Failed to load markets" hint={createdMarkets.error} />
  {:else if createdMarkets.isEmpty}
    <EmptyState
      message="No markets yet"
      hint="Create your first spot market on the Internet Computer"
    />
  {:else}
    <CreatedMarketsList markets={createdMarkets.markets} />
  {/if}
</div>
