<script lang="ts">
  /**
   * SectionHeader - Section labels for grouped lists
   *
   * Usage:
   * <SectionHeader label="Your tokens" count={5} />
   * <SectionHeader label="Favorites" />
   */

  interface Props {
    label: string;
    count?: number;
  }

  let { label, count }: Props = $props();
</script>

<div class="section-header">
  <span class="section-label">{label}</span>
  {#if count !== undefined}
    <span class="section-count">{count}</span>
  {/if}
</div>

<style>
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-label {
    flex: 1;
  }

  .section-count {
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-sans);
    color: var(--muted-foreground);
    background: var(--muted);
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
