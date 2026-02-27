<script lang="ts">
  import type { Snippet } from "svelte";

  export type BadgeVariant =
    | "green"
    | "red"
    | "blue"
    | "cyan"
    | "orange"
    | "purple"
    | "gray"
    | "yellow"
    | "pink";

  type BadgeSize = "xs" | "sm" | "md";

  interface Props {
    variant?: BadgeVariant;
    size?: BadgeSize;
    class?: string;
    children: Snippet;
  }

  const {
    variant = "gray",
    size = "sm",
    class: customClass = "",
    children
  }: Props = $props();
</script>

<span
  class={`badge badge-${variant} badge-${size} ${customClass}`}
>
  {@render children()}
</span>

<style>
  /* Base badge styles — matches SideBadge/TypeBadge/StatusBadge pattern */
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    border-radius: var(--radius-sm);
    border: 1px solid;
    white-space: nowrap;
  }

  /* Size variants */
  .badge-xs {
    padding: 2px 6px;
    font-size: 11px;
  }

  .badge-sm {
    padding: 2px 8px;
    font-size: 11px;
  }

  .badge-md {
    padding: 3px 10px;
    font-size: 12px;
  }

  /* Color variants — oklch border 0.4, bg 0.1 */
  .badge-green {
    border-color: oklch(from var(--color-bullish) l c h / 0.4);
    background: oklch(from var(--color-bullish) l c h / 0.1);
    color: var(--color-bullish);
  }

  .badge-red {
    border-color: oklch(from var(--color-bearish) l c h / 0.4);
    background: oklch(from var(--color-bearish) l c h / 0.1);
    color: var(--color-bearish);
  }

  .badge-blue {
    border-color: oklch(from var(--primary) l c h / 0.4);
    background: oklch(from var(--primary) l c h / 0.1);
    color: var(--primary);
  }

  .badge-cyan {
    border-color: oklch(from var(--color-cyan) l c h / 0.4);
    background: oklch(from var(--color-cyan) l c h / 0.1);
    color: var(--color-cyan);
  }

  .badge-orange {
    border-color: oklch(from var(--color-orange) l c h / 0.4);
    background: oklch(from var(--color-orange) l c h / 0.1);
    color: var(--color-orange);
  }

  .badge-purple {
    border-color: oklch(0.65 0.25 300 / 0.4);
    background: oklch(0.65 0.25 300 / 0.1);
    color: oklch(0.65 0.25 300);
  }

  .badge-gray {
    border-color: oklch(from var(--muted-foreground) l c h / 0.4);
    background: oklch(from var(--muted-foreground) l c h / 0.1);
    color: var(--muted-foreground);
  }

  .badge-yellow {
    border-color: oklch(from var(--color-yellow) l c h / 0.4);
    background: oklch(from var(--color-yellow) l c h / 0.1);
    color: var(--color-yellow);
  }

  .badge-pink {
    border-color: oklch(from var(--color-pink) l c h / 0.4);
    background: oklch(from var(--color-pink) l c h / 0.1);
    color: var(--color-pink);
  }
</style>
