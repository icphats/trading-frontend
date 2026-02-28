<script lang="ts">
  import Logo from '$lib/components/ui/Logo.svelte';
  import { formatFeePips } from '$lib/domain/markets/utils';

  interface TokenInfo {
    symbol: string;
    displaySymbol: string;
    logo?: string | null;
  }

  interface Props {
    base: TokenInfo;
    quote: TokenInfo;
    feePips: number; // Fee in pips (100-10000)
    onEdit: () => void;
  }

  let { base, quote, feePips, onEdit }: Props = $props();

  const feeDisplay = $derived(formatFeePips(feePips));
</script>

<div class="edit-pair-header">
  <div class="pair-info">
    <!-- Double Token Logo -->
    <div class="token-logos">
      <div class="logo-wrapper">
        <Logo src={base.logo ?? undefined} alt={base.displaySymbol} size="lg" circle={true} />
      </div>
      <div class="logo-wrapper overlap">
        <Logo src={quote.logo ?? undefined} alt={quote.displaySymbol} size="lg" circle={true} />
      </div>
    </div>

    <!-- Token Pair + Fee Badge -->
    <div class="pair-details">
      <div class="pair-row">
        <span class="pair-text">{base.displaySymbol}</span>
        <span class="pair-separator">/</span>
        <span class="pair-text">{quote.displaySymbol}</span>
      </div>
      <div class="badges">
        <span class="fee-badge">{feeDisplay}</span>
      </div>
    </div>
  </div>

  <!-- Edit Button -->
  <button class="edit-button" onclick={onEdit}>
    <svg class="edit-icon" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
    Edit
  </button>
</div>

<style>
  .edit-pair-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 1.5rem; /* Match rounded-3xl used by other components */
  }

  .pair-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .token-logos {
    display: flex;
    align-items: center;
  }

  .logo-wrapper {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .logo-wrapper.overlap {
    margin-left: -12px;
  }

  .pair-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .pair-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .pair-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .pair-separator {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .fee-badge {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    background: var(--muted);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
  }

  /* Edit button - elevated from header background */
  .edit-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--card);
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .edit-button:hover {
    background: var(--muted);
  }

  .edit-icon {
    width: 16px;
    height: 16px;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .edit-pair-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .logo-wrapper {
      width: 36px;
      height: 36px;
    }

    .pair-text {
      font-size: 1rem;
    }
  }
</style>
