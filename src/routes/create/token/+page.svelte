<script lang="ts">
  import { goto } from "$app/navigation";
  import Breadcrumb from "$lib/components/ui/Breadcrumb.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import EmptyState from "$lib/components/ui/list/EmptyState.svelte";
  import CreatedTokensList from "$lib/components/create/token/CreatedTokensList.svelte";
  import { createdTokens } from "$lib/domain/tokens";
  import { user } from "$lib/domain/user/auth.svelte";
  import { api } from "$lib/actors/api.svelte";

  $effect(() => {
    if (user.principal && api.registry) {
      createdTokens.load();
    }
  });

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Tokens", active: true },
  ];
</script>

<div class="mx-auto max-w-5xl px-4 py-8 space-y-6">
  <Breadcrumb items={breadcrumbItems} />

  <div class="flex items-center justify-between">
    <h1 class="text-3xl font-bold">Your Tokens</h1>
    <ButtonV2 variant="primary" size="md" onclick={() => goto("/create/token/new")}>
      Create Token
    </ButtonV2>
  </div>

  {#if !user.isAuthenticated}
    <EmptyState
      message="Connect your wallet"
      hint="Sign in to view tokens you've created"
    />
  {:else if createdTokens.isLoading && !createdTokens.hasFetched}
    <EmptyState variant="loading" message="Loading your tokens..." />
  {:else if createdTokens.error}
    <EmptyState variant="error" message="Failed to load tokens" hint={createdTokens.error} />
  {:else if createdTokens.isEmpty}
    <EmptyState
      message="No tokens yet"
      hint="Create your first ICRC token on the Internet Computer"
    />
  {:else}
    <CreatedTokensList tokens={createdTokens.tokens} />
  {/if}
</div>
