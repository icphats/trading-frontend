<script lang="ts">
  import {
    creationJournal,
    phaseLabel,
    phaseIndex,
    type CreationPhase,
  } from '$lib/domain/markets/state/creation-journal.svelte';

  interface Props {
    isActive: boolean;
    creationType: 'ledger' | 'spot_market';
  }

  let { isActive, creationType }: Props = $props();

  // Only phases observable via polling (survive across an await boundary).
  // Payment + validation happen before the journal entry exists ("Preparing..." covers that).
  // Atomic phases (set & overwritten in the same sync block) are excluded.
  const LEDGER_PHASES: CreationPhase[] = [
    { creating_canister: null },   // awaiting treasury
    { installing_wasm: null },     // awaiting install_code
    { completed: null },
  ];

  const SPOT_MARKET_PHASES: CreationPhase[] = [
    { querying_metadata: null },   // awaiting ICRC-1 queries + ICRC-2 checks
    { creating_canister: null },   // awaiting treasury
    { installing_wasm: null },     // awaiting install_code
    { notifying_indexer: null },   // awaiting indexer
    { completed: null },
  ];

  const phases = $derived(creationType === 'ledger' ? LEDGER_PHASES : SPOT_MARKET_PHASES);
  const totalSteps = $derived(phases.length);

  const entry = $derived(creationJournal.activeEntry ?? creationJournal.latestEntry);
  const hasEntry = $derived(!!entry);
  const currentPhase = $derived(entry?.phase);
  const currentLabel = $derived(currentPhase ? phaseLabel(currentPhase) : 'Preparing...');
  const symbol = $derived(entry?.symbol ?? '');

  /** Position of the current phase within the visible dot list (not the global index). */
  const currentDotIndex = $derived.by(() => {
    if (!currentPhase) return -1;
    const globalIdx = phaseIndex(currentPhase);
    // Find which dot matches or is the closest preceding dot
    let best = -1;
    for (let i = 0; i < phases.length; i++) {
      const dotGlobalIdx = phaseIndex(phases[i]);
      if (dotGlobalIdx <= globalIdx) best = i;
    }
    return best;
  });

  const isFailed = $derived(currentPhase ? 'failed' in currentPhase : false);
  const isCompleted = $derived(currentPhase ? 'completed' in currentPhase : false);
  const isInProgress = $derived(!isFailed && !isCompleted);

  const errorMessage = $derived.by(() => {
    if (!isFailed || !entry?.result || entry.result.length === 0) return '';
    const res = entry.result[0];
    if (res && 'err' in res) return res.err;
    return '';
  });

  // Elapsed time tracking
  let elapsedSeconds = $state(0);

  const elapsedDisplay = $derived.by(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    if (mins > 0) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    return `${secs}s`;
  });

  // Polling lifecycle — reset stale entries before starting
  $effect(() => {
    if (isActive) {
      creationJournal.reset();
      creationJournal.startPolling(2000);
    } else {
      creationJournal.stopPolling();
    }

    return () => {
      creationJournal.reset();
    };
  });

  // Elapsed time ticker
  $effect(() => {
    if (!isActive || !entry) {
      elapsedSeconds = 0;
      return;
    }

    const startedAtMs = Number(entry.started_at);

    function update() {
      elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    }

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  });

  /**
   * Map the current phase to its progress position among the visible
   * (non-failed) phase dots. Failed is not shown as a dot, so we
   * cap the index at totalSteps - 1.
   */
  function dotState(dotIndex: number): 'done' | 'active' | 'pending' {
    // No entry yet — first dot is active, rest pending
    if (!hasEntry) {
      return dotIndex === 0 ? 'active' : 'pending';
    }

    if (isFailed) {
      if (dotIndex < currentDotIndex) return 'done';
      return 'pending';
    }

    if (dotIndex < currentDotIndex) return 'done';
    if (dotIndex === currentDotIndex) return 'active';
    return 'pending';
  }
</script>

{#if isActive}
  <div class="creation-progress">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        {#if isCompleted}
          <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        {:else if isFailed}
          <svg class="w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        {:else}
          <svg class="w-5 h-5 text-[color:var(--muted-foreground)] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-dasharray="50 20" stroke-linecap="round" />
          </svg>
        {/if}
        <span
          class="text-sm font-semibold"
          class:text-emerald-500={isCompleted}
          class:text-red-500={isFailed}
        >
          {currentLabel}
        </span>
      </div>
      <span class="text-xs text-[color:var(--muted-foreground)] font-[family-name:var(--font-numeric)] tabular-nums">
        {elapsedDisplay}
      </span>
    </div>

    <!-- Symbol -->
    {#if symbol}
      <p class="text-xs text-[color:var(--muted-foreground)] mt-1">
        Creating <span class="font-semibold text-[color:var(--foreground)]">{symbol}</span>
      </p>
    {/if}

    <!-- Step dots -->
    <div class="flex items-center gap-1.5 mt-3">
      {#each phases as _, i}
        {@const state = dotState(i)}
        <div
          class="step-dot"
          class:done={state === 'done'}
          class:active={state === 'active' && isInProgress}
          class:failed={state === 'active' && isFailed}
          class:completed-dot={state === 'active' && isCompleted}
        ></div>
      {/each}
      <span class="text-[0.625rem] text-[color:var(--muted-foreground)] ml-1.5 font-[family-name:var(--font-numeric)] tabular-nums">
        {hasEntry ? Math.min(currentDotIndex + 1, totalSteps) : 1}/{totalSteps}
      </span>
    </div>

    <!-- Error message -->
    {#if isFailed && errorMessage}
      <div class="mt-3 bg-red-500/10 border border-red-500/20 rounded-[var(--radius-md)] px-3 py-2">
        <p class="text-xs text-red-400">{errorMessage}</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .creation-progress {
    border: 1px solid var(--border);
    background: var(--background);
    border-radius: var(--radius-md);
    padding: 0.875rem 1rem;
  }

  .step-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 9999px;
    background: var(--muted);
    flex-shrink: 0;
    transition: background 200ms ease, box-shadow 200ms ease;
  }

  .step-dot.done {
    background: var(--primary, #3b82f6);
  }

  .step-dot.active {
    background: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #3b82f6) 25%, transparent);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  .step-dot.completed-dot {
    background: #10b981;
    box-shadow: none;
    animation: none;
  }

  .step-dot.failed {
    background: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
    animation: none;
  }

  @keyframes pulse-dot {
    0%, 100% {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, #3b82f6) 20%, transparent);
    }
    50% {
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--primary, #3b82f6) 10%, transparent);
    }
  }
</style>
