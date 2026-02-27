<script lang="ts">
  interface Step {
    number: number;
    label: string;
  }

  interface Props {
    steps: Step[];
    currentStep: number;
    stickyTop?: string;
    onStepClick?: (stepNumber: number) => void;
  }

  let { steps, currentStep, stickyTop = '5rem', onStepClick }: Props = $props();

  // Find current step info for mobile header
  let currentStepData = $derived(steps.find(s => s.number === currentStep) ?? steps[0]);

  function handleStepClick(stepNumber: number) {
    // Only allow clicking completed steps or the current step
    if (onStepClick && stepNumber <= currentStep) {
      onStepClick(stepNumber);
    }
  }
</script>

<!-- Desktop: Sidebar indicator (hidden below 1024px) -->
<div class="step-indicator-sidebar" style="top: {stickyTop};">
  {#each steps as step, index (step.number)}
    {@const isActive = currentStep === step.number}
    {@const isCompleted = currentStep > step.number}
    {@const isUpcoming = currentStep < step.number}

    <button
      class="step-row"
      class:clickable={onStepClick && !isUpcoming}
      onclick={() => handleStepClick(step.number)}
      disabled={isUpcoming}
      type="button"
    >
      <!-- Number Circle -->
      <div
        class="step-circle"
        class:active={isActive || isCompleted}
      >
        {#if isCompleted}
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
          </svg>
        {:else}
          {step.number}
        {/if}
      </div>

      <!-- Text Content -->
      <div class="step-content">
        <span
          class="step-label"
          class:active={isActive}
          class:upcoming={isUpcoming}
        >
          Step {step.number}
        </span>
        <span
          class="step-title"
          class:active={isActive}
          class:upcoming={isUpcoming}
        >
          {step.label}
        </span>
      </div>
    </button>

    <!-- Connector Line -->
    {#if index !== steps.length - 1}
      <div class="connector"></div>
    {/if}
  {/each}
</div>

<!-- Mobile: Header indicator (visible below 1024px) -->
<div class="step-indicator-header">
  <div class="step-circle active">
    {currentStep}
  </div>
  <div class="step-content">
    <span class="step-label">
      Step {currentStep} of {steps.length}
    </span>
    <span class="step-title">
      {currentStepData?.label}
    </span>
  </div>
</div>

<style>
  /* Desktop Sidebar - shown on screens >= 1024px */
  .step-indicator-sidebar {
    display: none;
    width: 360px;
    position: sticky;
    border-radius: var(--radius-2xl);
    border: 1px solid var(--border);
    padding: 16px;
    background-color: var(--background);
    align-self: flex-start;
  }

  @media (min-width: 1024px) {
    .step-indicator-sidebar {
      display: block;
    }
  }

  /* Mobile Header - shown on screens < 1024px */
  /* Note: Spacing between header and content handled by parent .main-layout gap */
  .step-indicator-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 16px;
    background-color: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius-2xl);
    order: -1;
    /* Sticky header on mobile (Uniswap pattern) */
    position: sticky;
    top: 64px; /* Below navbar */
    z-index: 10;
  }

  @media (min-width: 1024px) {
    .step-indicator-header {
      display: none;
    }
  }

  .step-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: none;
    border: none;
    padding: 8px;
    margin: -8px;
    border-radius: 12px;
    text-align: left;
    transition: background-color 150ms ease;
  }

  .step-row.clickable {
    cursor: pointer;
  }

  .step-row.clickable:hover {
    background-color: var(--muted);
  }

  .step-row:disabled {
    cursor: default;
  }

  .step-circle {
    width: 32px;
    height: 32px;
    min-width: 32px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 500;
    background-color: var(--muted);
    color: var(--muted-foreground);
    transition: background-color 150ms ease, color 150ms ease;
  }

  .step-circle.active {
    background-color: var(--foreground);
    color: var(--background);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .step-label {
    font-size: 12px;
    line-height: 1;
    color: var(--muted-foreground);
    user-select: none;
  }

  .step-label.upcoming {
    opacity: 0.5;
  }

  .step-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3;
    color: var(--foreground);
    user-select: none;
  }

  .step-title.upcoming {
    color: var(--muted-foreground);
  }

  .connector {
    width: 2px;
    height: 32px;
    background-color: var(--border);
    margin-left: 15px;
    margin-top: 8px;
    margin-bottom: 8px;
    border-radius: 9999px;
  }
</style>
