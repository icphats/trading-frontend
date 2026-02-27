<script lang="ts">
  import { accountDrawer } from '$lib/components/portal/drawers/specific/AccountDrawer';

  // Control animation state - start animations after mount
  let mounted = $state(false);

  $effect(() => {
    // Trigger entrance animations after a brief delay
    const timer = setTimeout(() => {
      mounted = true;
    }, 50);
    return () => clearTimeout(timer);
  });
</script>

<div class="banner">
  <!-- Grid pattern background -->
  <div class="grid-pattern"></div>

  <!-- Floating decorative elements -->
  <div class="floating-elements">
    <!-- Token-like circles with staggered animations -->
    <div class="emblem emblem-1" class:mounted>
      <div class="emblem-inner"></div>
    </div>
    <div class="emblem emblem-2" class:mounted>
      <div class="emblem-inner"></div>
    </div>
    <div class="emblem emblem-3" class:mounted>
      <div class="emblem-inner"></div>
    </div>
    <div class="emblem emblem-4" class:mounted>
      <div class="emblem-inner"></div>
    </div>
    <div class="emblem emblem-5" class:mounted>
      <div class="emblem-inner"></div>
    </div>
    <div class="emblem emblem-6" class:mounted>
      <div class="emblem-inner"></div>
    </div>
  </div>

  <!-- Center content -->
  <div class="content" class:mounted>
    <p class="title">Connect a wallet <span class="subtitle">to view your portfolio</span></p>
    <button class="connect-button" onclick={() => accountDrawer.open()}>
      Connect
    </button>
  </div>
</div>

<style>
  .banner {
    position: relative;
    width: 100%;
    height: 200px;
    background: rgba(255, 255, 255, 0.01);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Grid pattern overlay */
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 8px 8px;
    opacity: 0.5;
    pointer-events: none;
  }

  /* Floating elements container */
  .floating-elements {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  /* Token-like emblems */
  .emblem {
    position: absolute;
    border-radius: 50%;
    background: oklch(from var(--primary) l c h / 0.1);
    border: 1px solid oklch(from var(--primary) l c h / 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0.5) rotate(-180deg);
    transition:
      opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
      transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .emblem.mounted {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }

  .emblem-inner {
    width: 60%;
    height: 60%;
    border-radius: 50%;
    background: oklch(from var(--primary) l c h / 0.15);
  }

  /* Individual emblem positions and sizes */
  .emblem-1 {
    width: 64px;
    height: 64px;
    top: 15%;
    left: 8%;
    transition-delay: 0.1s;
  }

  .emblem-2 {
    width: 48px;
    height: 48px;
    top: 60%;
    left: 15%;
    transition-delay: 0.2s;
  }

  .emblem-3 {
    width: 40px;
    height: 40px;
    top: 25%;
    left: 25%;
    transition-delay: 0.15s;
  }

  .emblem-4 {
    width: 56px;
    height: 56px;
    top: 20%;
    right: 10%;
    transition-delay: 0.25s;
  }

  .emblem-5 {
    width: 44px;
    height: 44px;
    top: 55%;
    right: 18%;
    transition-delay: 0.3s;
  }

  .emblem-6 {
    width: 36px;
    height: 36px;
    top: 35%;
    right: 28%;
    transition-delay: 0.2s;
  }

  /* Content styling */
  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.5s ease-out,
      transform 0.5s ease-out;
  }

  .content.mounted {
    opacity: 1;
    transform: translateY(0);
  }

  .title {
    font-size: 18px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0 0 12px;
    line-height: 1.4;
  }

  .subtitle {
    font-weight: 400;
    color: var(--muted-foreground);
  }

  .connect-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0 24px;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    border-radius: 20px;
    font-size: 16px;
    font-weight: 535;
    cursor: pointer;
    transition:
      background-color 200ms ease-out,
      transform 150ms ease-out,
      box-shadow 200ms ease-out;
  }

  .connect-button:hover {
    background: oklch(from var(--primary) calc(l * 0.9) c h);
    box-shadow: 0 4px 16px oklch(from var(--primary) l c h / 0.3);
    transform: translateY(-1px);
  }

  .connect-button:active {
    background: oklch(from var(--primary) calc(l * 0.85) c h);
    transform: translateY(0);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .banner {
      height: 180px;
    }

    .title {
      font-size: 20px;
    }

    .subtitle {
      font-size: 14px;
    }

    .emblem-1, .emblem-4 {
      width: 48px;
      height: 48px;
    }

    .emblem-2, .emblem-5 {
      width: 36px;
      height: 36px;
    }

    .emblem-3, .emblem-6 {
      width: 28px;
      height: 28px;
    }

    /* Hide some emblems on mobile */
    .emblem-3, .emblem-6 {
      display: none;
    }
  }
</style>
