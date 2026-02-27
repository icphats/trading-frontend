<script lang="ts" module>
  /**
   * Shorten an ID/address with ellipsis in the middle
   * Pattern: xxxxx...xxxx (5 start, 4 end)
   */
  export function shortenId(id: string): string {
    if (!id) return '';
    if (id.length <= 12) return id;
    return `${id.slice(0, 5)}...${id.slice(-4)}`;
  }
</script>

<script lang="ts">
  /**
   * CopyableId - Single primitive for displaying copyable IDs/addresses
   *
   * Four visual variants:
   * - inline:  Minimal text-only, icon on hover (default)
   * - pill:    Filled bg, rounded-20, copy icon always visible
   * - outline: Transparent bg + border, rounded-20, copy icon always visible
   * - block:   Full-width bordered box, mono, copy button right-aligned
   */

  interface Props {
    /** The full ID/address to copy */
    id: string;
    /** Visual variant */
    variant?: 'inline' | 'pill' | 'outline' | 'block';
    /** Optional label above (block variant) */
    label?: string;
    /** Size: sm=12px, md=14px */
    size?: 'sm' | 'md';
    /** Show full ID, no truncation (block always full) */
    full?: boolean;
    /** Monospace font (default: true for pill/outline/block, false for inline) */
    mono?: boolean;
  }

  let {
    id,
    variant = 'inline',
    label,
    size = 'md',
    full = false,
    mono,
  }: Props = $props();

  let isCopied = $state(false);
  let isHovered = $state(false);

  async function handleCopy() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      isCopied = true;
      setTimeout(() => {
        isCopied = false;
      }, 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  const isBlock = $derived(variant === 'block');
  const showFull = $derived(full || isBlock);
  const displayId = $derived(showFull ? id : shortenId(id));
  const useMono = $derived(mono ?? variant !== 'inline');
  const iconAlwaysVisible = $derived(variant === 'pill' || variant === 'outline' || variant === 'inline' || isBlock);
  const showIcon = $derived(iconAlwaysVisible || isHovered || isCopied);
  const iconPx = $derived(size === 'sm' ? 12 : variant === 'pill' ? 16 : 14);
</script>

{#if isBlock}
  <!-- Block variant: full-width with optional label -->
  <div class="block-wrapper">
    {#if label}
      <span class="block-label" class:sm={size === 'sm'}>{label}</span>
    {/if}
    <button
      class="copyable-id block"
      class:sm={size === 'sm'}
      class:copied={isCopied}
      onclick={handleCopy}
      title={isCopied ? 'Copied!' : 'Copy to clipboard'}
    >
      <span class="id-text mono">{displayId}</span>
      <span class="icon-container visible">
        {#if isCopied}
          <svg class="icon checkmark" width={iconPx} height={iconPx} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        {:else}
          <svg class="icon copy" width={iconPx} height={iconPx} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
          </svg>
        {/if}
      </span>
    </button>
  </div>
{:else}
  <!-- Inline / Pill / Outline variants -->
  <button
    class="copyable-id {variant}"
    class:sm={size === 'sm'}
    class:copied={isCopied}
    onclick={handleCopy}
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
    title={isCopied ? 'Copied!' : 'Copy to clipboard'}
  >
    <span class="id-text" class:mono={useMono}>{displayId}</span>
    <span class="icon-container" class:visible={showIcon}>
      {#if isCopied}
        <svg class="icon checkmark" width={iconPx} height={iconPx} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      {:else}
        <svg class="icon copy" width={iconPx} height={iconPx} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
        </svg>
      {/if}
    </span>
  </button>
{/if}

<style>
  /* ── Shared ── */
  .copyable-id {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
    text-align: left;
  }

  .id-text {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--foreground);
  }

  .sm .id-text {
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .id-text.mono {
    font-family: var(--font-mono);
  }

  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 150ms ease;
    flex-shrink: 0;
  }

  .icon-container.visible {
    opacity: 1;
  }

  .icon {
    color: var(--muted-foreground);
    transition: color 150ms ease, transform 150ms ease;
  }

  .icon.checkmark {
    color: var(--color-connected);
    animation: checkmarkPop 200ms ease-out;
  }

  @keyframes checkmarkPop {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  /* ── Inline variant ── */
  .copyable-id.inline {
    gap: 4px;
  }

  .copyable-id.inline:hover {
    opacity: 0.7;
  }

  .copyable-id.inline .id-text {
    font-weight: 500;
  }

  /* ── Pill variant ── */
  .copyable-id.pill {
    padding: 8px 12px;
    border-radius: 20px;
    background-color: var(--muted);
  }

  .copyable-id.pill:hover {
    opacity: 0.8;
  }

  .copyable-id.pill:active {
    opacity: 0.6;
  }

  .copyable-id.pill .id-text {
    font-weight: 535;
    line-height: 1rem;
  }

  .copyable-id.pill.copied {
    background-color: rgba(76, 175, 80, 0.1);
  }

  /* ── Outline variant ── */
  .copyable-id.outline {
    padding: 6px 10px;
    border-radius: 20px;
    background: transparent;
    border: 1px solid var(--border);
  }

  .copyable-id.outline:hover {
    border-color: var(--muted-foreground);
  }

  .copyable-id.outline.copied {
    border-color: var(--color-connected);
    background-color: rgba(76, 175, 80, 0.05);
  }

  .copyable-id.outline .id-text {
    color: var(--muted-foreground);
  }

  .copyable-id.outline.sm {
    padding: 4px 8px;
  }

  /* ── Block variant ── */
  .block-wrapper {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .block-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .block-label.sm {
    font-size: 0.75rem;
  }

  .copyable-id.block {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    gap: 8px;
  }

  .copyable-id.block:hover {
    border-color: var(--muted-foreground);
  }

  .copyable-id.block.copied {
    border-color: var(--color-connected);
  }

  .copyable-id.block .id-text {
    flex: 1;
    min-width: 0;
    word-break: break-all;
    font-size: 0.8125rem;
    line-height: 1.25rem;
  }

  .copyable-id.block.sm .id-text {
    font-size: 0.75rem;
  }
</style>
