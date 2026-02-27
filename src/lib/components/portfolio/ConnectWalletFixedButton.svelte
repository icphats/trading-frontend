<script lang="ts">
  import { accountDrawer } from '$lib/components/portal/drawers/specific/AccountDrawer';

  interface Props {
    visible?: boolean;
  }

  let { visible = false }: Props = $props();
</script>

<div class="fixed-button-container" class:visible>
  <!-- Gradient fade overlay -->
  <div class="fade-overlay"></div>

  <!-- Pill button -->
  <div class="pill-button">
    <span class="pill-text">Track your portfolio</span>
    <button class="connect-button" onclick={() => accountDrawer.open()}>
      Connect Wallet
    </button>
  </div>
</div>

<style>
  .fixed-button-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 150; /* Below modals (200) but above most content */
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.3s ease-out,
      transform 0.3s ease-out;
  }

  .fixed-button-container.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  /* Gradient fade overlay */
  .fade-overlay {
    width: 100%;
    height: 80px;
    background: linear-gradient(
      to top,
      var(--background) 0%,
      var(--background) 20%,
      transparent 100%
    );
    pointer-events: none;
  }

  /* Pill button styling */
  .pill-button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 6px 6px 20px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 28px;
    box-shadow: var(--shadow-lg);
    margin-bottom: 24px;
    pointer-events: auto;
  }

  :global(.dark) .pill-button {
    background: oklch(from var(--card) calc(l * 1.1) c h);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.3),
      0 0 1px rgba(255, 255, 255, 0.1);
  }

  .pill-text {
    font-size: 15px;
    font-weight: 485;
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .connect-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0 20px;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: 20px;
    font-size: 15px;
    font-weight: 535;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background-color 200ms ease-out,
      transform 150ms ease-out,
      box-shadow 200ms ease-out;
  }

  .connect-button:hover {
    background: oklch(from var(--primary) calc(l * 0.9) c h);
    box-shadow: 0 4px 12px oklch(from var(--primary) l c h / 0.3);
    transform: translateY(-1px);
  }

  .connect-button:active {
    background: oklch(from var(--primary) calc(l * 0.85) c h);
    transform: translateY(0);
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .pill-button {
      padding: 5px 5px 5px 16px;
      gap: 10px;
    }

    .pill-text {
      font-size: 14px;
    }

    .connect-button {
      height: 36px;
      padding: 0 16px;
      font-size: 14px;
    }
  }
</style>
