<script lang="ts">
  import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
  import Logo from '$lib/components/ui/Logo.svelte';
  import CopyableId from '$lib/components/ui/CopyableId.svelte';
  import ButtonV2 from '$lib/components/ui/ButtonV2.svelte';
  import InfoTip from '$lib/components/ui/InfoTip.svelte';
  import TopUpModal from './TopUpModal.svelte';
  import { user } from '$lib/domain/user/auth.svelte';
  import type { TokenDetailState } from '$lib/domain/tokens/state/token-detail.svelte';

  interface Props {
    state: TokenDetailState;
    canisterId: string;
  }

  let { state: pageState, canisterId }: Props = $props();

  let topUpOpen = $state(false);

  const token = $derived(pageState.token!);

  const breadcrumbItems = $derived([
    { label: 'Tokens', href: '/create/token' },
    { label: token.symbol, active: true },
  ]);

  const totalSupplyFormatted = $derived.by(() => {
    if (token.totalSupply === null) return null;
    const raw = Number(token.totalSupply) / Math.pow(10, token.decimals);
    return raw.toLocaleString(undefined, { maximumFractionDigits: token.decimals });
  });

  const feeFormatted = $derived.by(() => {
    const raw = Number(token.fee) / Math.pow(10, token.decimals);
    return raw.toLocaleString(undefined, { maximumFractionDigits: token.decimals });
  });

  $effect(() => {
    const agent = user.agent;
    if (agent) {
      pageState.loadStatus(agent, canisterId);
    }
  });

  function refreshStatus() {
    if (user.agent) {
      pageState.loadStatus(user.agent, canisterId);
    }
  }
</script>

<div class="page">
  <Breadcrumb items={breadcrumbItems} />

  <!-- Header -->
  <div class="header">
    <Logo src={token.logo ?? undefined} alt={token.symbol} size="lg" circle />
    <div class="header-info">
      <h1 class="token-name">{token.name}</h1>
      <div class="token-meta">
        <span class="token-symbol">{token.symbol}</span>
        <CopyableId id={canisterId} variant="pill" mono size="sm" />
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <ButtonV2 variant="secondary" size="md" onclick={refreshStatus} loading={pageState.isLoadingStatus}>
      Refresh
    </ButtonV2>
    <ButtonV2 variant="primary" size="md" onclick={() => topUpOpen = true}>
      Top Up
    </ButtonV2>
  </div>

  <!-- Token Info -->
  <section class="section">
    <h2 class="section-title">Token Info</h2>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-label">Decimals <InfoTip text="Number of decimal places for the smallest unit of this token." /></span>
        <span class="info-value">{token.decimals}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Transfer Fee <InfoTip text="Fee charged on every transfer. Paid by the sender and burned." /></span>
        <span class="info-value">{feeFormatted} {token.symbol}</span>
      </div>
      {#if totalSupplyFormatted !== null}
        <div class="info-row">
          <span class="info-label">Total Supply <InfoTip text="Total number of tokens currently in existence." /></span>
          <span class="info-value">{totalSupplyFormatted}</span>
        </div>
      {/if}
      {#if pageState.mintingAccount}
        <div class="info-row">
          <span class="info-label">Minting Account <InfoTip text="Principal authorized to mint and burn tokens." /></span>
          <CopyableId id={pageState.mintingAccount} variant="inline" mono size="sm" />
        </div>
      {/if}
      {#if pageState.supportedStandards.length > 0}
        <div class="info-row">
          <span class="info-label">Standards <InfoTip text="ICRC standards implemented by this token ledger." /></span>
          <span class="info-value">{pageState.supportedStandards.join(', ')}</span>
        </div>
      {/if}
    </div>
  </section>

  <!-- Canister Status -->
  <section class="section">
    <h2 class="section-title">Canister Status</h2>

    {#if pageState.statusError}
      <div class="status-error">
        <p>{pageState.statusError}</p>
        {#if !user.isAuthenticated}
          <p class="status-hint">Connect your wallet to view canister status.</p>
        {:else}
          <p class="status-hint">Only controllers can query canister status.</p>
        {/if}
      </div>
    {:else if pageState.isLoadingStatus && !pageState.canisterStatus}
      <div class="status-loading">
        <div class="spinner-sm"></div>
        <span>Loading canister status...</span>
      </div>
    {:else if pageState.canisterStatus}
      <!-- Overview -->
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Status <InfoTip text="Whether the canister is running and processing messages, stopped, or in the process of stopping." /></span>
          <span class="info-value">
            <span class="status-indicator" class:running={pageState.statusLabel === 'Running'} class:stopped={pageState.statusLabel === 'Stopped'} class:stopping={pageState.statusLabel === 'Stopping'}>
              <span class="status-dot"></span>
              {pageState.statusLabel}
            </span>
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Canister Version <InfoTip text="Incremented on every code install, upgrade, or settings change." /></span>
          <span class="info-value">{pageState.version}</span>
        </div>
        {#if pageState.moduleHashHex}
          <div class="info-row">
            <span class="info-label">Module Hash <InfoTip text="SHA-256 hash of the installed Wasm module. Use this to verify which code is running." /></span>
            <CopyableId id={pageState.moduleHashHex} variant="inline" mono size="sm" />
          </div>
        {/if}
        <div class="info-row">
          <span class="info-label">Ready for Migration <InfoTip text="Whether the IC considers this canister ready for subnet migration. Managed automatically by the network." /></span>
          <span class="info-value">{pageState.readyForMigration ? 'Yes' : 'No'}</span>
        </div>
      </div>

      <!-- Cycles -->
      <h3 class="subsection-title">Cycles</h3>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Balance <InfoTip text="Spendable cycles available for computation and storage. This is your canister's main fuel supply." /></span>
          <span class="info-value">{pageState.cyclesFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reserved <InfoTip text="Cycles set aside by the system to guarantee future storage costs. These are locked and not spendable." /></span>
          <span class="info-value">{pageState.reservedCyclesFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Idle Burn / Day <InfoTip text="Cycles consumed per day just for existing — covers storage costs even when the canister has no activity." /></span>
          <span class="info-value">{pageState.idleBurnFormatted}</span>
        </div>
      </div>

      <!-- Memory -->
      <h3 class="subsection-title">Memory</h3>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Total <InfoTip text="Sum of all memory used by this canister across all categories." /></span>
          <span class="info-value">{pageState.memoryFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Wasm Heap <InfoTip text="Main working memory where your canister's live data (variables, maps, etc.) resides." /></span>
          <span class="info-value">{pageState.wasmMemoryFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Stable <InfoTip text="Persistent memory that survives upgrades. Used for long-term storage like history and archives." /></span>
          <span class="info-value">{pageState.stableMemoryFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Wasm Binary <InfoTip text="Size of the installed Wasm module (your canister's compiled code)." /></span>
          <span class="info-value">{pageState.wasmBinaryFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Global <InfoTip text="Memory used by Wasm global variables." /></span>
          <span class="info-value">{pageState.globalMemoryFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Chunk Store <InfoTip text="Temporary storage for uploading large Wasm modules in chunks." /></span>
          <span class="info-value">{pageState.wasmChunkStoreFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Canister History <InfoTip text="Memory used to store the canister's change history (installs, upgrades, controller changes)." /></span>
          <span class="info-value">{pageState.canisterHistoryFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Snapshots <InfoTip text="Memory used by saved canister snapshots (point-in-time backups)." /></span>
          <span class="info-value">{pageState.snapshotsFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Custom Sections <InfoTip text="Memory used by custom Wasm sections (metadata embedded in the module)." /></span>
          <span class="info-value">{pageState.customSectionsFormatted}</span>
        </div>
      </div>

      <!-- Query Stats -->
      {#if pageState.queryStats}
        <h3 class="subsection-title">Query Stats</h3>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Total Calls <InfoTip text="Cumulative number of query calls made to this canister since creation." /></span>
            <span class="info-value">{pageState.queryStats.totalCalls}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Instructions <InfoTip text="Cumulative Wasm instructions executed across all query calls." /></span>
            <span class="info-value">{pageState.queryStats.totalInstructions}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Request Payload <InfoTip text="Total bytes received in query call arguments." /></span>
            <span class="info-value">{pageState.queryStats.requestPayload}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Response Payload <InfoTip text="Total bytes sent back in query call responses." /></span>
            <span class="info-value">{pageState.queryStats.responsePayload}</span>
          </div>
        </div>
      {/if}

      <!-- Settings -->
      <h3 class="subsection-title">Settings</h3>
      <div class="info-grid">
        {#if pageState.controllers.length > 0}
          {#each pageState.controllers as controller, i}
            <div class="info-row">
              <span class="info-label">{i === 0 ? 'Controllers' : ''} {#if i === 0}<InfoTip text="Principals authorized to manage this canister — install code, change settings, or delete it." />{/if}</span>
              <CopyableId id={controller} variant="inline" mono size="sm" />
            </div>
          {/each}
        {/if}
        <div class="info-row">
          <span class="info-label">Freezing Threshold <InfoTip text="If the cycles balance would only cover this many seconds of idle burn, the canister freezes and rejects new calls." /></span>
          <span class="info-value">{pageState.freezingThreshold}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Wasm Memory Limit <InfoTip text="Maximum Wasm heap size. The canister traps if it tries to grow beyond this." /></span>
          <span class="info-value">{pageState.wasmMemoryLimit}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Wasm Memory Threshold <InfoTip text="When free Wasm memory drops below this, the on_low_wasm_memory hook fires as a warning." /></span>
          <span class="info-value">{pageState.wasmMemoryThreshold}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Memory Allocation <InfoTip text="Guaranteed memory reservation. 'Best effort' means the canister uses only what it needs." /></span>
          <span class="info-value">{pageState.memoryAllocation}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Compute Allocation <InfoTip text="Guaranteed share of subnet compute. 'Best effort' means no reservation — the canister competes for cycles." /></span>
          <span class="info-value">{pageState.computeAllocation}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reserved Cycles Limit <InfoTip text="Maximum cycles the system can lock as reserved. Prevents unbounded storage cost reservations." /></span>
          <span class="info-value">{pageState.reservedCyclesLimit}</span>
        </div>
      </div>
    {:else if !user.isAuthenticated}
      <p class="status-hint">Connect your wallet to view canister status.</p>
    {/if}
  </section>
</div>

<TopUpModal bind:open={topUpOpen} {canisterId} onSuccess={refreshStatus} />

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    margin-bottom: 20px;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-bottom: 32px;
  }

  .header-info {
    min-width: 0;
  }

  .token-name {
    font-family: 'Basel', sans-serif;
    font-size: 28px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
    line-height: 1.2;
  }

  .token-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .token-symbol {
    font-size: 15px;
    color: var(--muted-foreground);
    font-weight: 485;
  }

  .section {
    margin-bottom: 32px;
  }

  .section-title {
    font-family: 'Basel', sans-serif;
    font-size: 18px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0 0 16px;
  }

  .info-grid {
    background: var(--muted);
    border-radius: 16px;
    padding: 4px 0;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
  }

  .info-label {
    font-size: 14px;
    color: var(--muted-foreground);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .info-value {
    font-size: 14px;
    color: var(--foreground);
    font-weight: 485;
    text-align: right;
  }

  .subsection-title {
    font-family: 'Basel', sans-serif;
    font-size: 15px;
    font-weight: 500;
    color: var(--muted-foreground);
    margin: 20px 0 8px;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted-foreground);
  }

  .status-indicator.running .status-dot {
    background: var(--success);
    box-shadow: 0 0 6px oklch(from var(--success) l c h / 0.5);
  }

  .status-indicator.running {
    color: var(--success);
  }

  .status-indicator.stopped .status-dot {
    background: var(--destructive);
    box-shadow: 0 0 6px color-mix(in srgb, var(--destructive) 50%, transparent);
  }

  .status-indicator.stopped {
    color: var(--destructive);
  }

  .status-indicator.stopping .status-dot {
    background: var(--warning);
    box-shadow: 0 0 6px oklch(from var(--warning) l c h / 0.5);
  }

  .status-indicator.stopping {
    color: var(--warning);
  }

  .status-error {
    background: var(--muted);
    border-radius: 16px;
    padding: 20px;
    text-align: center;
    color: var(--muted-foreground);
    font-size: 14px;
  }

  .status-error p {
    margin: 0;
  }

  .status-hint {
    font-size: 13px;
    color: var(--muted-foreground);
    margin-top: 8px;
  }

  .status-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted-foreground);
    font-size: 14px;
    padding: 20px;
    background: var(--muted);
    border-radius: 16px;
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-bottom-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

</style>
