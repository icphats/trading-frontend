<script lang="ts">
  import { staggerDelay } from './animations';

  interface Props {
    title: string;
    value: string;
    live?: boolean;
    delay?: number;
    inView?: boolean;
  }

  let { title, value, live = false, delay = 0, inView = false }: Props = $props();

  // Split value into characters for staggered animation
  let chars = $derived(value.split(''));
</script>

<div
  class="stat-card"
  class:live
  style="animation-delay: {delay}s;"
>
  <!-- Title -->
  <div class="stat-title" class:live>
    {#if live}
      <span class="live-dot"></span>
    {/if}
    <h3>{title}</h3>
  </div>

  <!-- Value with character animation -->
  <div class="stat-value" class:animate={inView}>
    {#each chars as char, i}
      <span
        class="char"
        class:live
        style="animation-delay: {staggerDelay(i, delay, 0.03)}s;"
        class:animate={inView}
      >
        {char}
      </span>
    {/each}
  </div>
</div>

<style>
  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;

    width: 100%;
    height: 100%;
    min-height: 140px;
    padding: 1.5rem;

    background-color: var(--muted);
    border-radius: 20px;
    overflow: hidden;

    /* Dot pattern background */
    background-image: radial-gradient(
      oklch(from var(--muted-foreground) l c h / 0.2) 0.5px,
      transparent 0
    );
    background-size: 12px 12px;
    background-position: -8.5px -8.5px;
  }

  .stat-card.live {
    background-color: rgba(47, 186, 97, 0.04);
    box-shadow: 0 0 20px rgba(47, 186, 97, 0.15), 0 0 40px rgba(47, 186, 97, 0.08);
  }

  .stat-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-title h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--muted-foreground);
    line-height: 1.4;
  }

  .stat-title.live h3 {
    color: var(--color-bullish);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-bullish);
    animation: pulsate 1s ease-in-out infinite alternate;
  }

  @keyframes pulsate {
    0% {
      box-shadow: 0 0 0 0 oklch(from var(--color-bullish) l c h / 0.4);
    }
    100% {
      box-shadow: 0 0 0 4px oklch(from var(--color-bullish) l c h / 0.2);
    }
  }

  .stat-value {
    display: flex;
    flex-wrap: wrap;
    font-variant-numeric: lining-nums tabular-nums;
  }

  .char {
    font-size: 2.5rem;
    font-weight: 500;
    color: var(--foreground);
    line-height: 1;
    opacity: 0;
    transform: translateY(20px);
  }

  .char.live {
    color: var(--color-bullish);
  }

  .char.animate {
    animation: charRise 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }

  @keyframes charRise {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Responsive sizing */
  @media (max-width: 1024px) {
    .stat-card {
      padding: 1.25rem;
      min-height: 120px;
    }

    .stat-title h3 {
      font-size: 1rem;
    }

    .char {
      font-size: 2rem;
    }
  }

  @media (max-width: 640px) {
    .stat-card {
      padding: 1rem;
      min-height: 100px;
    }

    .stat-title h3 {
      font-size: 0.875rem;
    }

    .char {
      font-size: 1.5rem;
    }
  }
</style>
