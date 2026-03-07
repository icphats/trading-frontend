<script lang="ts">
  interface Props {
    text: string;
  }

  let { text }: Props = $props();

  let visible = $state(false);
  let bubbleStyle = $state('');
  let iconEl: HTMLButtonElement | undefined = $state();

  function show() {
    if (!iconEl) return;
    const rect = iconEl.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 8;
    bubbleStyle = `left:${x}px;top:${y}px;`;
    visible = true;
  }

  function hide() {
    visible = false;
  }
</script>

<span class="info-tip">
  <button
    class="info-icon"
    aria-label="Info"
    bind:this={iconEl}
    onmouseenter={show}
    onmouseleave={hide}
    onfocus={show}
    onblur={hide}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  </button>
  {#if visible}
    <span class="info-bubble" role="tooltip" style={bubbleStyle}>{text}</span>
  {/if}
</span>

<style>
  .info-tip {
    display: inline-flex;
    align-items: center;
  }

  .info-icon {
    all: unset;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    cursor: help;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity 0.15s, color 0.15s;
  }

  .info-icon:hover,
  .info-icon:focus-visible {
    color: var(--foreground);
    opacity: 1;
  }

  .info-bubble {
    position: fixed;
    transform: translate(-50%, -100%);
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--foreground);
    color: var(--background);
    font-size: 12px;
    font-weight: 400;
    font-style: normal;
    line-height: 1.4;
    white-space: normal;
    width: max-content;
    max-width: 240px;
    z-index: 9999;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .info-bubble::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--foreground);
  }
</style>
