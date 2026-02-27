<script lang="ts">
  import { user } from '$lib/domain/user/auth.svelte';
  import CopyableId from '$lib/components/ui/CopyableId.svelte';

  interface Props {
    compact?: boolean;
  }

  let { compact = false }: Props = $props();

  const principal = $derived(user.principal?.toString() || '');
</script>

<div class="address-display" class:compact>
  {#if user.isAuthenticated}
    <div class="address-row">
      <div class="avatar">
        <span class="avatar-text">
          {principal.slice(0, 2).toUpperCase()}
        </span>
      </div>
      {#if !compact}
        <CopyableId id={principal} variant="outline" />
      {/if}
    </div>
  {:else}
    <div class="disconnected">
      <span class="disconnected-text">Not connected</span>
    </div>
  {/if}
</div>

<style>
  .address-display {
    display: flex;
    align-items: center;
  }

  .address-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .compact .address-row {
    gap: 8px;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .compact .avatar {
    width: 24px;
    height: 24px;
  }

  .avatar-text {
    font-size: 12px;
    font-weight: 600;
    color: white;
  }

  .compact .avatar-text {
    font-size: 10px;
  }

  .disconnected {
    padding: 8px 12px;
  }

  .disconnected-text {
    font-size: 14px;
    color: var(--muted-foreground);
  }
</style>
