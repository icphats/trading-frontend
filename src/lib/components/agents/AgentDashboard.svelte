<script lang="ts">
  import AgentControls from './AgentControls.svelte';
  import AgentTerminal from './AgentTerminal.svelte';
  import AgentStatePanel from './AgentStatePanel.svelte';
  import { agentEngine } from '$lib/domain/agents/agent-engine.svelte';

  // The market instance is managed inside AgentControls and stored on agentEngine
  // AgentStatePanel reads directly from agentEngine's market reference
  // We expose it via a derived that reads the engine's internal market
  let market = $derived(agentEngine['market']);
</script>

<div class="dashboard">
  <div class="dashboard-header">
    <h1 class="dashboard-title">Agent Auto-Trader</h1>
    <span class="dashboard-subtitle">random-walk testing engine</span>
  </div>

  <div class="dashboard-grid">
    <div class="controls-column">
      <AgentControls />
    </div>

    <div class="terminal-column">
      <AgentTerminal />
    </div>

    <div class="state-column">
      <AgentStatePanel {market} />
    </div>
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 64px);
    min-height: 0;
    padding: 1.5rem;
    gap: 1rem;
    box-sizing: border-box;
    overflow: hidden;
  }

  .dashboard-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .dashboard-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
  }

  .dashboard-subtitle {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: oklch(1 0 0 / 0.3);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 260px 1fr 220px;
    gap: 1rem;
    flex: 1;
    min-height: 0;
  }

  .controls-column {
    overflow-y: auto;
    min-height: 0;
  }

  .terminal-column {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .state-column {
    min-height: 0;
  }

  @media (max-width: 1024px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }

    .terminal-column {
      min-height: 400px;
    }
  }

  @media (max-width: 767px) {
    .dashboard {
      padding: 1rem;
    }
  }
</style>
