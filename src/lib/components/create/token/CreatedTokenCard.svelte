<script lang="ts">
  import { goto } from "$app/navigation";
  import type { NormalizedToken } from "$lib/types/entity.types";
  import { user } from "$lib/domain/user/auth.svelte";
  import { getCanisterStatus } from "$lib/services/ic-management.service";
  import Logo from "$lib/components/ui/Logo.svelte";
  import CopyableId from "$lib/components/ui/CopyableId.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import TopUpModal from "./TopUpModal.svelte";

  interface Props {
    token: NormalizedToken;
  }

  let { token }: Props = $props();

  let topUpOpen = $state(false);
  let cycles = $state<string | null>(null);
  let memory = $state<string | null>(null);
  let statusLoading = $state(false);
  let statusFailed = $state(false);

  $effect(() => {
    const agent = user.agent;
    const canisterId = token.canisterId;
    if (!agent) return;

    statusLoading = true;
    getCanisterStatus(agent, canisterId).then((status) => {
      cycles = formatCycles(status.cycles);
      memory = formatBytes(status.memory_size);
    }).catch(() => {
      statusFailed = true;
    }).finally(() => {
      statusLoading = false;
    });
  });

  function formatCycles(val: bigint): string {
    const n = Number(val);
    if (n >= 1e12) return `${(n / 1e12).toFixed(3)} T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)} B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
    return n.toLocaleString();
  }

  function formatBytes(val: bigint): string {
    const n = Number(val);
    if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${n} B`;
  }

  function handleDetails() {
    goto(`/create/token/${token.canisterId}`);
  }

  function handleTopUp() {
    topUpOpen = true;
  }

  function refreshStatus() {
    const agent = user.agent;
    if (!agent) return;
    getCanisterStatus(agent, token.canisterId).then((status) => {
      cycles = formatCycles(status.cycles);
      memory = formatBytes(status.memory_size);
    }).catch(() => {});
  }
</script>

<div
  class="block bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 space-y-4 text-inherit transition-colors hover:border-[var(--border-hover)]"
>
  <div class="flex items-center gap-3">
    <Logo src={token.logo ?? undefined} alt={token.symbol} size="sm" circle />
    <div class="min-w-0">
      <div class="font-semibold truncate">{token.name}</div>
      <div class="text-sm text-[color:var(--muted-foreground)]">{token.symbol}</div>
    </div>
  </div>

  <div class="space-y-2 text-sm">
    <div class="flex justify-between">
      <span class="text-[color:var(--muted-foreground)]">Canister ID</span>
      <CopyableId id={token.canisterId} variant="inline" mono />
    </div>
    {#if token.totalSupply !== null}
      <div class="flex justify-between">
        <span class="text-[color:var(--muted-foreground)]">Total Supply</span>
        <span>{(Number(token.totalSupply) / Math.pow(10, token.decimals)).toLocaleString()}</span>
      </div>
    {/if}
    {#if !statusFailed}
      <div class="flex justify-between items-center">
        <span class="text-[color:var(--muted-foreground)]">Cycles</span>
        {#if statusLoading}
          <span class="skeleton"></span>
        {:else if cycles}
          <span>{cycles}</span>
        {/if}
      </div>
      <div class="flex justify-between items-center">
        <span class="text-[color:var(--muted-foreground)]">Memory</span>
        {#if statusLoading}
          <span class="skeleton"></span>
        {:else if memory}
          <span>{memory}</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="flex gap-2">
    <ButtonV2 variant="secondary" size="sm" fullWidth onclick={handleDetails}>
      Details
    </ButtonV2>
    <ButtonV2 variant="primary" size="sm" fullWidth onclick={handleTopUp}>
      Top Up
    </ButtonV2>
  </div>
</div>

<TopUpModal bind:open={topUpOpen} canisterId={token.canisterId} onSuccess={refreshStatus} />

<style>
  .skeleton {
    display: inline-block;
    width: 64px;
    height: 14px;
    background: var(--muted);
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
