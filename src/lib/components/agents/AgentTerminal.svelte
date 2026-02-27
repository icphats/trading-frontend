<script lang="ts">
  import { agentEngine } from '$lib/domain/agents/agent-engine.svelte';

  let scrollEl: HTMLElement;
  let userScrolledUp = $state(false);

  function onScroll() {
    if (!scrollEl) return;
    const distFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    userScrolledUp = distFromBottom > 60;
  }

  $effect(() => {
    const _ = agentEngine.log.length;
    if (scrollEl && !userScrolledUp) {
      requestAnimationFrame(() => {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
    }
  });
</script>

<div class="terminal">
  <div class="terminal-titlebar">
    <div class="terminal-dots">
      <span class="dot dot-red"></span>
      <span class="dot dot-yellow"></span>
      <span class="dot dot-green"></span>
    </div>
    <span class="terminal-filename">agent-engine</span>
    {#if agentEngine.isRunning}
      <span class="terminal-status running">running</span>
    {:else if agentEngine.status === 'paused'}
      <span class="terminal-status paused">paused</span>
    {:else}
      <span class="terminal-status idle">idle</span>
    {/if}
  </div>

  <div class="terminal-history" bind:this={scrollEl} onscroll={onScroll}>
    {#each agentEngine.log as entry (entry.id)}
      <div
        class="terminal-line line-enter"
        class:line-prompt={entry.type === 'prompt'}
        class:line-action={entry.type === 'action'}
        class:line-result={entry.type === 'result'}
        class:line-success={entry.type === 'success'}
        class:line-error={entry.type === 'error'}
        class:line-info={entry.type === 'info'}
      >
        {#if entry.type === 'prompt'}
          <span class="prompt-caret">&gt;</span> <span class="prompt-text">{entry.text}</span>
        {:else if entry.type === 'action'}
          <span class="action-bullet">⏺</span> <span class="action-text">{entry.text}</span>
        {:else if entry.type === 'result'}
          <span class="result-indent">  </span><span class="result-text">{entry.text}</span>
        {:else if entry.type === 'success'}
          <span class="success-check">  ✓</span> <span class="success-text">{entry.text}</span>
          {#if entry.durationMs}
            <span class="duration">{entry.durationMs.toFixed(0)}ms</span>
          {/if}
        {:else if entry.type === 'error'}
          <span class="error-x">  ✗</span> <span class="error-text">{entry.text}</span>
          {#if entry.durationMs}
            <span class="duration">{entry.durationMs.toFixed(0)}ms</span>
          {/if}
        {:else if entry.type === 'info'}
          <span class="info-text">  ℹ {entry.text}</span>
        {/if}
      </div>
    {/each}

    {#if agentEngine.log.length === 0}
      <div class="terminal-empty">
        <span class="empty-text">Select a market and click Start to begin</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .terminal {
    border-radius: 16px;
    background: var(--terminal-bg);
    border: 1px solid oklch(1 0 0 / 0.06);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .terminal-titlebar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid oklch(1 0 0 / 0.06);
    flex-shrink: 0;
  }

  .terminal-dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot-red { background: oklch(0.63 0.2 25); }
  .dot-yellow { background: oklch(0.8 0.16 85); }
  .dot-green { background: oklch(0.72 0.17 150); }

  .terminal-filename {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: oklch(1 0 0 / 0.4);
  }

  .terminal-status {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .terminal-status.running {
    color: var(--color-bullish);
    background: oklch(from var(--color-bullish) l c h / 0.1);
  }

  .terminal-status.paused {
    color: oklch(0.8 0.16 85);
    background: oklch(0.8 0.16 85 / 0.1);
  }

  .terminal-status.idle {
    color: oklch(1 0 0 / 0.3);
    background: oklch(1 0 0 / 0.04);
  }

  .terminal-history {
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: oklch(1 0 0 / 0.1) transparent;
  }

  .terminal-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
  }

  .empty-text {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: oklch(1 0 0 / 0.25);
  }

  .terminal-line {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-all;
    color: oklch(0.92 0 0);
  }

  .line-enter {
    animation: lineIn 200ms ease-out forwards;
  }

  @keyframes lineIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .line-prompt { margin-top: 0.5rem; }

  .prompt-caret {
    color: var(--color-bullish);
    font-weight: 600;
  }

  .prompt-text { color: oklch(0.95 0 0); }

  .line-action { margin-top: 0.125rem; }

  .action-bullet { color: oklch(0.72 0.12 300); }

  .action-text { color: oklch(1 0 0 / 0.65); }

  .result-indent { user-select: none; }

  .result-text { color: oklch(1 0 0 / 0.5); }

  .success-check { color: var(--color-bullish); }

  .success-text { color: var(--color-bullish); }

  .error-x { color: var(--color-bearish); }

  .error-text { color: var(--color-bearish); }

  .info-text {
    color: oklch(1 0 0 / 0.35);
    font-style: italic;
  }

  .duration {
    color: oklch(1 0 0 / 0.25);
    font-size: 0.625rem;
    margin-left: 0.5rem;
  }
</style>
