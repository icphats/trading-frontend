<script lang="ts">
  import Logo from '$lib/components/ui/Logo.svelte';

  interface TokenInfo {
    symbol: string;
    displaySymbol: string;
    logo?: string | null;
  }

  interface PositionInfo {
    base: TokenInfo;
    quote: TokenInfo;
    fee_pips: number;
    status?: 'in_range' | 'out_of_range' | 'closed';
  }

  interface Props {
    position: PositionInfo;
    hideStatus?: boolean;
    size?: 'default' | 'mini';
  }

  let { position, hideStatus = false, size = 'default' }: Props = $props();

  const feePercent = $derived((position.fee_pips / 10000).toFixed(2));

  const statusText = $derived.by(() => {
    if (!position.status) return '';
    switch (position.status) {
      case 'in_range': return 'In range';
      case 'out_of_range': return 'Out of range';
      case 'closed': return 'Closed';
      default: return '';
    }
  });
</script>

<div class="position-info" class:mini={size === 'mini'}>
  <div class="token-logos">
    <div class="logo-wrapper">
      <Logo src={position.base.logo ?? undefined} alt={position.base.displaySymbol} size="md" circle={true} />
    </div>
    <div class="logo-wrapper overlap">
      <Logo src={position.quote.logo ?? undefined} alt={position.quote.displaySymbol} size="md" circle={true} />
    </div>
  </div>

  <div class="position-details">
    <div class="position-pair">
      <span class="pair-text">
        {position.base.displaySymbol} / {position.quote.displaySymbol}
      </span>
      <span class="fee-badge">{feePercent}%</span>
    </div>

    {#if !hideStatus && size !== 'mini' && position.status}
      <div class="position-status" class:in-range={position.status === 'in_range'} class:out-of-range={position.status === 'out_of_range'}>
        <span class="status-dot"></span>
        <span class="status-text">{statusText}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .position-info {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .position-info.mini {
    align-items: center;
  }

  .token-logos {
    display: flex;
    align-items: center;
  }

  .logo-wrapper {
    width: 44px;
    height: 44px;
  }

  .logo-wrapper.overlap {
    margin-left: -12px;
  }

  .position-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .position-pair {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .pair-text {
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .fee-badge {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    background: var(--muted);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
  }

  .position-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .position-status.in-range .status-dot {
    background: var(--success);
  }

  .position-status.out-of-range .status-dot {
    background: var(--warning);
  }

  .status-text {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .position-status.in-range .status-text {
    color: var(--success);
  }

  .position-status.out-of-range .status-text {
    color: var(--warning);
  }
</style>
