<script lang="ts">
  import { onMount } from 'svelte';
  import HeroSwapWidget from '../hero-swap/HeroSwapWidget.svelte';

  let mounted = $state(false);

  onMount(() => {
    setTimeout(() => {
      mounted = true;
    }, 100);
  });
</script>

<section class="hero-section">
  <div class="hero-content">
    <h2 class="hero-headline" class:animate={mounted}>
      Orderbook Precision, AMM Simplicity.
    </h2>
    <p class="hero-subtitle" class:animate={mounted}>
      The first hybrid DEX on the Internet Computer.
    </p>

    <div class="hero-swap" class:animate={mounted}>
      <HeroSwapWidget />
    </div>
  </div>
</section>

<style>
  .hero-section {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2.5rem;
    box-sizing: border-box;
  }

  .hero-content {
    width: 100%;
    max-width: 900px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }

  .hero-headline {
    font-size: clamp(1.5rem, 5.5vw, 2.75rem);
    font-weight: 500;
    line-height: 1.1;
    margin: 0;
    color: var(--foreground);
    opacity: 0;
    transform: translateY(20px);
  }

  .hero-headline.animate {
    animation: riseIn 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }

  .hero-subtitle {
    font-size: clamp(0.9375rem, 3.75vw, 1.125rem);
    line-height: 1.6;
    color: var(--muted-foreground);
    margin: 0;
    opacity: 0;
    transform: translateY(20px);
  }

  .hero-subtitle.animate {
    animation: riseIn 0.6s cubic-bezier(0.19, 1, 0.22, 1) 0.1s forwards;
  }

  .hero-swap {
    width: 100%;
    max-width: 628px;
    margin-top: 1.5rem;
    opacity: 0;
    transform: translateY(20px);
  }

  .hero-swap.animate {
    animation: riseIn 0.6s cubic-bezier(0.19, 1, 0.22, 1) 0.15s forwards;
  }

  @keyframes riseIn {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 767px) {
    .hero-section {
      padding: clamp(0.75rem, 5vw, 3rem) clamp(0.5rem, 4vw, 2rem) clamp(0.5rem, 4vw, 2rem);
    }

    .hero-content {
      gap: clamp(0.5rem, 2.5vw, 1rem);
    }

    .hero-swap {
      margin-top: clamp(0.5rem, 3vw, 1.5rem);
    }
  }
</style>
