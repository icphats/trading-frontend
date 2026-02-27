<script lang="ts">
  import { agentEngine } from '$lib/domain/agents/agent-engine.svelte';
  import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
  import { SpotMarket } from '$lib/domain/markets/state/spot-market.svelte';
  import { CATEGORIES, ACTION_META, ALL_ACTIONS, type ActionCategory, type ActionType } from '$lib/domain/agents/agent.types';

  let selectedCanisterId = $state('');
  let marketInstance = $state<SpotMarket | null>(null);
  let loadingMarket = $state(false);
  let expandedCategories = $state<Set<ActionCategory>>(new Set());

  let markets = $derived(entityStore.allMarkets);

  async function selectMarket(canisterId: string) {
    if (!canisterId || loadingMarket) return;
    selectedCanisterId = canisterId;
    loadingMarket = true;
    try {
      const market = entityStore.getMarket(canisterId);
      if (!market) return;
      const spot = new SpotMarket(canisterId, market.symbol.split('/')[0], market.symbol);
      await spot.hydrateAll();
      marketInstance = spot;
    } catch (e) {
      console.error('Failed to load market:', e);
    } finally {
      loadingMarket = false;
    }
  }

  function handleStart() {
    if (!marketInstance) return;
    agentEngine.start(marketInstance);
  }

  function handlePauseResume() {
    if (agentEngine.status === 'running') {
      agentEngine.pause();
    } else if (agentEngine.status === 'paused') {
      agentEngine.resume();
    }
  }

  function handleStop() {
    agentEngine.stop();
    marketInstance = null;
    selectedCanisterId = '';
  }

  function toggleCategory(cat: ActionCategory) {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    expandedCategories = next;
  }

  function toggleCategoryActions(cat: ActionCategory, enabled: boolean) {
    const actionsInCat = ALL_ACTIONS.filter(a => ACTION_META[a].category === cat);
    const next = new Set(agentEngine.config.enabledActions);
    for (const a of actionsInCat) {
      if (enabled) next.add(a);
      else next.delete(a);
    }
    agentEngine.config.enabledActions = next;
  }

  function toggleAction(action: ActionType) {
    const next = new Set(agentEngine.config.enabledActions);
    if (next.has(action)) next.delete(action);
    else next.add(action);
    agentEngine.config.enabledActions = next;
  }

  function isCategoryEnabled(cat: ActionCategory): boolean {
    return ALL_ACTIONS
      .filter(a => ACTION_META[a].category === cat)
      .some(a => agentEngine.config.enabledActions.has(a));
  }
</script>

<div class="controls">
  <!-- Market Selection -->
  <div class="control-group">
    <span class="control-label">Market</span>
    <select
      class="select"
      bind:value={selectedCanisterId}
      onchange={(e) => selectMarket((e.target as HTMLSelectElement).value)}
      disabled={agentEngine.status !== 'idle'}
    >
      <option value="">Select market...</option>
      {#each markets as m}
        <option value={m.canisterId}>{m.symbol}</option>
      {/each}
    </select>
  </div>

  <!-- Start / Pause / Stop -->
  <div class="control-group buttons">
    {#if agentEngine.status === 'idle'}
      <button
        class="btn btn-start"
        onclick={handleStart}
        disabled={!marketInstance || loadingMarket}
      >
        {loadingMarket ? 'Loading...' : 'Start'}
      </button>
    {:else}
      <button class="btn btn-pause" onclick={handlePauseResume}>
        {agentEngine.status === 'running' ? 'Pause' : 'Resume'}
      </button>
      <button class="btn btn-stop" onclick={handleStop}>
        Stop
      </button>
    {/if}
  </div>

  <!-- Speed -->
  <div class="control-group">
    <span class="control-label">
      Speed: {(agentEngine.config.delayMs / 1000).toFixed(1)}s
    </span>
    <input
      type="range"
      class="slider"
      min="500"
      max="10000"
      step="500"
      bind:value={agentEngine.config.delayMs}
    />
  </div>

  <!-- Toggles Row -->
  <div class="control-group toggles-row">
    <label class="toggle-label">
      <input type="checkbox" bind:checked={agentEngine.config.dryRun} />
      <span>Dry Run</span>
    </label>
    <label class="toggle-label">
      <input type="checkbox" bind:checked={agentEngine.config.autoDeposit} />
      <span>Auto Deposit</span>
    </label>
  </div>

  <!-- Category Toggles -->
  <div class="control-group">
    <span class="control-label">Actions</span>
    <div class="categories">
      {#each CATEGORIES as cat}
        {@const enabled = isCategoryEnabled(cat)}
        <div class="category">
          <div class="category-header">
            <label class="toggle-label">
              <input
                type="checkbox"
                checked={enabled}
                onchange={(e) => toggleCategoryActions(cat, (e.target as HTMLInputElement).checked)}
              />
              <span class="category-name">{cat}</span>
            </label>
            <button class="expand-btn" onclick={() => toggleCategory(cat)}>
              {expandedCategories.has(cat) ? '−' : '+'}
            </button>
          </div>
          {#if expandedCategories.has(cat)}
            <div class="category-actions">
              {#each ALL_ACTIONS.filter(a => ACTION_META[a].category === cat) as action}
                <label class="toggle-label action-toggle">
                  <input
                    type="checkbox"
                    checked={agentEngine.config.enabledActions.has(action)}
                    onchange={() => toggleAction(action)}
                  />
                  <span>{ACTION_META[action].label}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Kill Switches -->
  {#if agentEngine.status !== 'idle'}
    <div class="control-group">
      <span class="control-label kill-label">Kill Switches</span>
      <div class="kill-buttons">
        <button class="btn btn-kill" onclick={() => agentEngine.cancelAllOrders()}>
          Cancel All Orders
        </button>
        <button class="btn btn-kill" onclick={() => agentEngine.cancelAllTriggers()}>
          Cancel All Triggers
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--terminal-bg);
    border-radius: 16px;
    border: 1px solid oklch(1 0 0 / 0.06);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .control-label {
    font-size: 0.6875rem;
    font-weight: 500;
    color: oklch(1 0 0 / 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .select {
    padding: 0.5rem 0.75rem;
    background: oklch(1 0 0 / 0.04);
    border: 1px solid oklch(1 0 0 / 0.08);
    border-radius: 8px;
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    outline: none;
  }

  .select:focus {
    border-color: oklch(1 0 0 / 0.15);
  }

  .select option {
    background: var(--background);
    color: var(--foreground);
  }

  .buttons {
    flex-direction: row;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid oklch(1 0 0 / 0.1);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    background: oklch(1 0 0 / 0.04);
    color: var(--foreground);
  }

  .btn:hover:not(:disabled) {
    background: oklch(1 0 0 / 0.08);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-start {
    background: oklch(from var(--color-bullish) l c h / 0.12);
    border-color: oklch(from var(--color-bullish) l c h / 0.2);
    color: var(--color-bullish);
  }

  .btn-start:hover:not(:disabled) {
    background: oklch(from var(--color-bullish) l c h / 0.2);
  }

  .btn-pause {
    background: oklch(0.8 0.16 85 / 0.12);
    border-color: oklch(0.8 0.16 85 / 0.2);
    color: oklch(0.8 0.16 85);
  }

  .btn-stop {
    background: oklch(from var(--color-bearish) l c h / 0.12);
    border-color: oklch(from var(--color-bearish) l c h / 0.2);
    color: var(--color-bearish);
  }

  .slider {
    width: 100%;
    accent-color: var(--color-bullish);
    height: 4px;
  }

  .toggles-row {
    flex-direction: row;
    gap: 1rem;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: oklch(1 0 0 / 0.6);
    cursor: pointer;
  }

  .toggle-label input[type="checkbox"] {
    accent-color: var(--color-bullish);
    width: 14px;
    height: 14px;
  }

  .categories {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .category {
    border: 1px solid oklch(1 0 0 / 0.04);
    border-radius: 6px;
    overflow: hidden;
  }

  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
    background: oklch(1 0 0 / 0.02);
  }

  .category-name {
    text-transform: capitalize;
    font-weight: 500;
  }

  .expand-btn {
    background: none;
    border: none;
    color: oklch(1 0 0 / 0.3);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0 0.25rem;
    line-height: 1;
  }

  .category-actions {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.375rem 0.5rem 0.375rem 1.5rem;
    border-top: 1px solid oklch(1 0 0 / 0.04);
  }

  .action-toggle span {
    font-size: 0.625rem;
  }

  .kill-label {
    color: var(--color-bearish);
  }

  .kill-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .btn-kill {
    background: oklch(from var(--color-bearish) l c h / 0.08);
    border-color: oklch(from var(--color-bearish) l c h / 0.15);
    color: var(--color-bearish);
    font-size: 0.6875rem;
    padding: 0.375rem 0.75rem;
  }

  .btn-kill:hover {
    background: oklch(from var(--color-bearish) l c h / 0.15);
  }
</style>
