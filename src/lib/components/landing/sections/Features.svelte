<script lang="ts">
  import FeatureCard from '../components/FeatureCard.svelte';
  import WalletShowcaseCard from '../components/WalletShowcaseCard.svelte';
  import SwapCard from '../components/SwapCard.svelte';

  // Feature cards data
  const features = [
    {
      title: 'Spot Trading',
      subtitle: 'Trade any token',
      description: 'Swap tokens instantly with deep liquidity pools and minimal slippage.',
      buttonText: 'Start Trading',
      href: '/trade',
      color: '#2ABDFF'
    },
    {
      title: 'Portfolio',
      subtitle: 'Track everything',
      description: 'Monitor your holdings, positions, and trading history in one place.',
      buttonText: 'View Portfolio',
      href: '/portfolio',
      color: '#9B59B6'
    },
    {
      title: 'Fast Settlement',
      subtitle: '1-2 second finality',
      description: 'Experience near-instant trade execution powered by the Internet Computer.',
      buttonText: 'Learn More',
      href: '/trade',
      color: '#2ECC71'
    },
    {
      title: 'Self-Custody',
      subtitle: 'Your keys, your crypto',
      description: 'Trade directly from your wallet. No deposits, no withdrawals, no middlemen.',
      buttonText: 'Connect Wallet',
      href: '/trade',
      color: '#F39C12'
    },
    {
      title: 'ICP Native',
      subtitle: 'Built on-chain',
      description: '100% on-chain order book and matching engine. Fully decentralized.',
      buttonText: 'Explore',
      href: '/explore',
      color: '#29ABE2'
    }
  ];
</script>

<section class="features-section">
  <div class="features-container">
    <h2 class="section-title">Built for DeFi</h2>

    <!-- Featured Cards Row -->
    <div class="featured-row">
      <WalletShowcaseCard />
      <SwapCard />
    </div>

    <div class="features-grid">
      {#each features as feature}
        <FeatureCard
          title={feature.title}
          subtitle={feature.subtitle}
          description={feature.description}
          buttonText={feature.buttonText}
          href={feature.href}
          color={feature.color}
        />
      {/each}
    </div>
  </div>
</section>

<style>
  .features-section {
    width: 100%;
    padding: 4rem 2.5rem;
    display: flex;
    justify-content: center;
  }

  .features-container {
    max-width: 1280px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .section-title {
    font-size: 2.5rem;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
  }

  .featured-row {
    display: flex;
    gap: 1rem;
    width: 100%;
    align-items: flex-start;
  }

  .featured-row > :global(*) {
    flex: 1 1 0;
    min-width: 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .features-section {
      padding: 3rem 2rem;
    }

    .section-title {
      font-size: 2rem;
    }
  }

  @media (max-width: 768px) {
    .featured-row {
      flex-direction: column;
    }

    .featured-row > :global(*) {
      flex: 1 1 100%;
      min-width: unset;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .features-section {
      padding: 2rem 1.5rem;
    }

    .section-title {
      font-size: 1.75rem;
    }
  }
</style>
