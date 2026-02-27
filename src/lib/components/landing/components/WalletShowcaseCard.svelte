<script lang="ts">
  import { accountDrawer } from '$lib/components/portal/drawers/specific/AccountDrawer';

  const wallets = [
    { name: 'Internet Identity', icon: '/wallets/internet-identity.svg' },
    { name: 'Apple', icon: '/wallets/apple.png' },
    { name: 'Google', icon: '/wallets/google.svg' },
    { name: 'MetaMask', icon: '/wallets/metamask-icon.svg' },
    { name: 'Phantom', icon: '/wallets/phantom-icon.png' },
    { name: 'Plug', icon: '/wallets/plug.png' }
  ];

  function handleConnect() {
    accountDrawer.open();
  }
</script>

<div class="wallet-card">
  <div class="card-content">
    <!-- Header Pill -->
    <div class="pill">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </svg>
      <span>Wallets</span>
    </div>

    <!-- Title -->
    <h3 class="subtitle">Connect Your Way</h3>

    <!-- Description -->
    <p class="description">
      Sign in with Internet Identity, Google, Apple, or your favorite crypto wallet.
    </p>

    <!-- CTA Button -->
    <button class="card-button" onclick={handleConnect}>
      <span>Connect Wallet</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  </div>

  <!-- Wallet Icons Grid -->
  <div class="wallets-showcase">
    {#each wallets as wallet}
      <div class="wallet-icon-wrapper" title={wallet.name}>
        <img src={wallet.icon} alt={wallet.name} class="wallet-icon" />
      </div>
    {/each}
  </div>
</div>

<style>
  .wallet-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 32px;
    overflow: hidden;
    background: oklch(from #FC72FF l c h / 0.12);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .wallet-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 3rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    width: fit-content;
    background: oklch(from #FC72FF l c h / 0.2);
    border-radius: 20px;
    color: #FC72FF;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .pill svg {
    width: 20px;
    height: 20px;
  }

  .subtitle {
    margin: 1rem 0 0 0;
    font-size: 2rem;
    font-weight: 500;
    line-height: 1.2;
    color: #FC72FF;
  }

  .description {
    margin: 0.5rem 0 0 0;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #FC72FF;
    opacity: 0.85;
    max-width: 400px;
  }

  .card-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--card);
    border: none;
    border-radius: 24px;
    color: var(--foreground);
    font-size: 0.9375rem;
    font-weight: 500;
    width: fit-content;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .card-button:hover {
    background: var(--muted);
    transform: scale(1.02);
  }

  /* Wallet Icons Showcase */
  .wallets-showcase {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 0 3rem 3rem;
  }

  .wallet-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    max-width: 80px;
    background: var(--card);
    border-radius: 20px;
    padding: 1rem;
    transition: transform 0.2s ease, background 0.2s ease;
    cursor: pointer;
  }

  .wallet-icon-wrapper:hover {
    transform: scale(1.08);
    background: var(--muted);
  }

  .wallet-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .card-content {
      padding: 2rem;
    }

    .subtitle {
      font-size: 1.75rem;
    }

    .description {
      font-size: 1.125rem;
    }

    .wallets-showcase {
      padding: 0 2rem 2rem;
      gap: 0.75rem;
    }

    .wallet-icon-wrapper {
      max-width: 64px;
      padding: 0.75rem;
      border-radius: 16px;
    }
  }

  @media (max-width: 768px) {
    .wallets-showcase {
      grid-template-columns: repeat(6, 1fr);
    }

    .wallet-icon-wrapper {
      max-width: 56px;
      padding: 0.625rem;
    }
  }

  @media (max-width: 640px) {
    .card-content {
      padding: 1.5rem;
    }

    .subtitle {
      font-size: 1.5rem;
    }

    .description {
      font-size: 1rem;
    }

    .wallets-showcase {
      grid-template-columns: repeat(3, 1fr);
      padding: 0 1.5rem 1.5rem;
    }

    .wallet-icon-wrapper {
      max-width: 56px;
      padding: 0.5rem;
      border-radius: 12px;
    }
  }
</style>
