<script lang="ts">
  import TokenPairLogo from '$lib/components/ui/TokenPairLogo.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  interface Props {
    baseSymbol: string;
    quoteSymbol: string;
    baseLogo?: string;
    quoteLogo?: string;
    feePips: number;
    isLoading?: boolean;
    onToggleReversed?: () => void;
  }

  let {
    baseSymbol,
    quoteSymbol,
    baseLogo,
    quoteLogo,
    feePips,
    isLoading = false,
    onToggleReversed
  }: Props = $props();

  // Format fee tier for display (e.g., 3000 pips -> 0.30%)
  const feePercent = $derived((feePips / 10000).toFixed(2));
</script>

<div class="pool-header">
  {#if isLoading}
    <div class="pool-header-skeleton">
      <div class="skeleton-logo"></div>
      <div class="skeleton-content">
        <div class="skeleton-text skeleton-name"></div>
      </div>
    </div>
  {:else}
    <div class="pool-identity">
      <TokenPairLogo
        {baseLogo}
        {quoteLogo}
        {baseSymbol}
        {quoteSymbol}
        size="sm"
      />
      <div class="pool-name-row">
        <h1 class="pool-name">
          <span class="token-link">{baseSymbol}</span>
          <span class="separator">/</span>
          <span class="token-link">{quoteSymbol}</span>
        </h1>
        <Badge variant="gray" size="sm">{feePercent}%</Badge>
        {#if onToggleReversed}
          <button
            class="swap-direction-btn"
            onclick={onToggleReversed}
            aria-label="Toggle token order"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M7 16V4M7 4L3 8M7 4L11 8" />
              <path d="M17 8V20M17 20L21 16M17 20L13 16" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .pool-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  /* Pool Identity */
  .pool-identity {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pool-name-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pool-name {
    font-family: 'Basel', sans-serif;
    font-size: 24px;
    line-height: 32px;
    font-weight: 500;
    color: var(--foreground);
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .token-link {
    cursor: default;
  }

  .separator {
    color: var(--muted-foreground);
  }

  .swap-direction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 150ms ease-out;
  }

  .swap-direction-btn:hover {
    background: var(--muted);
    color: var(--foreground);
  }

  /* Loading skeleton */
  .pool-header-skeleton {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .skeleton-logo {
    width: 44px;
    height: 32px;
    border-radius: 16px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-text {
    border-radius: 8px;
    background: var(--muted);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-name {
    width: 200px;
    height: 32px;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .pool-name {
      font-size: 20px;
      line-height: 26px;
    }
  }
</style>
