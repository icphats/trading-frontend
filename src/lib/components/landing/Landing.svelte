<script lang="ts">
  import Hero from './sections/Hero.svelte';
  import Stats from './sections/Stats.svelte';
  import Agents from './sections/Agents.svelte';
  import Footer from './Footer.svelte';
  import Background from '$lib/components/ui/Background.svelte';

</script>

<div class="landing-page">
  <Background />

  <!-- Agents Section -->
  <section class="snap-section">
    <Agents />
  </section>

  <!-- Hero Section -->
  <section class="snap-section">
    <Hero />
  </section>

  <!-- Stats Section -->
  <section class="snap-section">
    <Stats />
  </section>

  <!-- Footer Section -->
  <section class="snap-section snap-section--footer">
    <Footer />
  </section>
</div>

<style>
  .landing-page {
    width: 100%;
    height: 100dvh;
    overflow-y: auto;
    position: relative;
    z-index: 1;
  }

  .snap-section {
    min-height: 100dvh;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Enable snap only above mobile breakpoint */
  @media (min-width: 768px) {
    .landing-page {
      scroll-snap-type: y mandatory;
    }
    .snap-section {
      scroll-snap-align: start;
      scroll-snap-stop: always;
    }
  }

  /* Child components should fill the snap section */
  .snap-section > :global(*) {
    flex: 1;
  }

  /* Footer section - minimal height, sits at the bottom */
  .snap-section--footer {
    min-height: auto;
    padding: 2rem 0 0;
    display: flex;
    align-items: flex-end;
  }

  @media (min-width: 768px) {
    .snap-section--footer {
      scroll-snap-align: end;
      scroll-snap-stop: normal;
    }
  }

  /* Smooth scrolling for the whole page */
  :global(html) {
    scroll-behavior: smooth;
  }

  /* Fallback for browsers without dvh support */
  @supports not (height: 100dvh) {
    .landing-page {
      height: 100vh;
    }
    .snap-section {
      min-height: 100vh;
    }
  }
</style>
