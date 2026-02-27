<script lang="ts">
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import type { ToastData } from "$lib/state/portal/types";

  interface RoutingVenue {
    type: 'book' | 'pool';
    label: string;           // "Book" or "Pool-5"
    percent: number;          // allocation % (integer)
    inputAmount: string;
    outputAmount: string;
    feeAmount: string;
  }

  interface RoutingData {
    venues: RoutingVenue[];
    fillPercent: number;      // 0–100, how much of the order fills immediately
    totalFees: string;        // pre-formatted total fees
    inputSymbol: string;
    inputLogo?: string;
    outputSymbol: string;
    outputLogo?: string;
  }

  interface OrderDetail {
    side: 'Buy' | 'Sell';
    /** The base asset being bought/sold */
    baseSymbol: string;
    baseLogo?: string;
    /** Optional prominent condition block between hero and detail rows */
    condition?: { text: string; direction: 'above' | 'below' };
    /** Caller-defined detail rows — the economics of the trade */
    rows: Array<{ label: string; value: string; logo?: string }>;
    /** Optional venue routing breakdown — renders as its own card */
    routing?: RoutingData;
  }

  interface Props {
    open: boolean;
    title?: string;
    /** Plain text fallback — used when no orderDetail is provided */
    message?: string;
    /** Structured order data for rich rendering */
    orderDetail?: OrderDetail;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "primary" | "danger";
    showSkipOption?: boolean;
    onSkipPreferenceChange?: (skip: boolean) => void;
    onClose?: () => void;
    onConfirm: () => Promise<any>;
    onSuccess?: () => void;
    toastMessages: {
      loading: string;
      success: string | ((result: any) => string);
      error: (err: unknown) => string;
    };
    /** Override toast data when no orderDetail is provided (e.g. cancel confirmations) */
    overrideToastData?: ToastData;
  }

  let {
    open = $bindable(false),
    title = "Confirm Action",
    message = "Are you sure you want to proceed with this action?",
    orderDetail,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
    showSkipOption = false,
    onSkipPreferenceChange,
    onClose,
    onConfirm,
    onSuccess,
    toastMessages,
    overrideToastData
  }: Props = $props();

  let skipChecked = $state(false);
  let routingExpanded = $state(false);

  let toastData = $derived.by((): ToastData | undefined => {
    if (overrideToastData) return overrideToastData;
    if (!orderDetail) return undefined;
    return {
      type: 'order',
      side: orderDetail.side,
      orderType: 'market',
      symbol: orderDetail.baseSymbol,
      logo: orderDetail.baseLogo
    };
  });

  let sideColor = $derived(
    orderDetail?.side === 'Buy' ? 'var(--color-bullish)' : 'var(--color-bearish)'
  );

  async function handleConfirm() {
    open = false;

    if (skipChecked && onSkipPreferenceChange) {
      onSkipPreferenceChange(true);
    }
    skipChecked = false;

    try {
      await toastState.show({
        async: true,
        promise: onConfirm(),
        messages: toastMessages,
        data: toastData
      });
      onSuccess?.();
    } catch {
      // Error already shown by toast
    }
  }

  function handleCancel() {
    open = false;
    onClose?.();
  }
</script>

<Modal bind:open {onClose} {title} size="sm" compactHeader={true}>
  {#snippet children()}
    <div class="modal-body confirmation-modal">

      {#if orderDetail}
        <!-- Rich order confirmation -->
        <div class="order-summary">
          <!-- Hero: logo + side + base token -->
          <div class="order-hero">
            <Logo src={orderDetail.baseLogo} alt={orderDetail.baseSymbol} size="lg" circle />
            <div class="order-hero-text">
              <span class="order-side" style="color: {sideColor};">{orderDetail.side}</span>
              <span class="order-base">{orderDetail.baseSymbol}</span>
            </div>
          </div>

          <!-- Condition block (triggers) -->
          {#if orderDetail.condition}
            <div class="condition-block">
              <span class="condition-arrow" class:above={orderDetail.condition.direction === 'above'} class:below={orderDetail.condition.direction === 'below'}>
                {#if orderDetail.condition.direction === 'above'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                {/if}
              </span>
              <span class="condition-text">{orderDetail.condition.text}</span>
            </div>
          {/if}

          <!-- Detail rows: the economics -->
          <div class="modal-panel">
            {#each orderDetail.rows as row}
              <div class="modal-detail-row">
                <span class="modal-detail-label">{row.label}</span>
                <span class="modal-detail-value" style={row.logo ? 'display: inline-flex; align-items: center; gap: 4px;' : ''}>
                  {row.value}
                  {#if row.logo}
                    <img src={row.logo} alt="" class="row-logo" />
                  {/if}
                </span>
              </div>
            {/each}
          </div>

          <!-- Routing breakdown -->
          {#if orderDetail.routing?.venues.length}
            {@const routing = orderDetail.routing}
            {@const isFullFill = routing.fillPercent >= 99.9}
            {@const isPartialFill = routing.fillPercent > 0 && routing.fillPercent < 99.9}
            <div class="modal-panel routing-panel">
              <!-- Fill % bar -->
              <div class="fill-row">
                <span class="fill-label">Est. fill</span>
                <span class="fill-value" class:fill-full={isFullFill} class:fill-partial={isPartialFill}>{routing.fillPercent.toFixed(1)}%</span>
              </div>
              {#if !isFullFill}
                <div class="fill-bar-track">
                  <div class="fill-bar" class:fill-full={isFullFill} class:fill-partial={isPartialFill} style="width: {routing.fillPercent}%"></div>
                </div>
              {/if}

              <!-- Venue count + total fees (always visible) -->
              <button type="button" class="routing-collapsed" onclick={() => routingExpanded = !routingExpanded}>
                <span class="routing-summary">{routing.venues.length} venue{routing.venues.length !== 1 ? 's' : ''}</span>
                <span class="total-fees">{routing.totalFees} {routing.inputSymbol} fee</span>
                <svg class="routing-chevron" class:expanded={routingExpanded} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9l-7 7-7-7"/></svg>
              </button>

              <!-- Expanded: per-venue details -->
              {#if routingExpanded}
                <div class="routing-details">
                  {#each routing.venues as venue}
                    <div class="venue-card">
                      <span class="venue-heading">{venue.label} <span class="venue-heading-pct">({venue.percent}%)</span></span>
                      <div class="venue-amounts">
                        <div class="venue-amount-item">
                          <span class="venue-amount-value">{venue.inputAmount}</span>
                          <Logo src={routing.inputLogo} alt={routing.inputSymbol} size="xxs" circle />
                        </div>
                        <span class="venue-arrow">→</span>
                        <div class="venue-amount-item">
                          <span class="venue-amount-value">{venue.outputAmount}</span>
                          <Logo src={routing.outputLogo} alt={routing.outputSymbol} size="xxs" circle />
                        </div>
                      </div>
                      <div class="venue-fee-row">
                        <span class="venue-fee-label">Fee</span>
                        <span class="venue-fee-value">{venue.feeAmount} {routing.inputSymbol}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Plain text fallback -->
        <p class="confirmation-message">
          {message}
        </p>
      {/if}

      <!-- Skip preference toggle -->
      {#if showSkipOption}
        <label class="skip-toggle">
          <span class="skip-toggle-label">Skip trade confirmations</span>
          <span class="toggle-switch" class:active={skipChecked}>
            <input
              type="checkbox"
              bind:checked={skipChecked}
            />
            <span class="toggle-track">
              <span class="toggle-thumb"></span>
            </span>
          </span>
        </label>
      {/if}

      <!-- Action Buttons -->
      <div class="modal-actions">
        <ButtonV2
          variant="secondary"
          size="md"
          fullWidth
          onclick={handleCancel}
        >
          {cancelLabel}
        </ButtonV2>
        <ButtonV2
          variant={variant}
          size="md"
          fullWidth
          onclick={handleConfirm}
        >
          {confirmLabel}
        </ButtonV2>
      </div>
    </div>
  {/snippet}
</Modal>

<style>
  .confirmation-message {
    font-size: 0.875rem;
    color: var(--card-foreground);
    margin: 0;
    padding-bottom: 1rem;
  }

  .order-summary {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .order-hero {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.25rem 0;
  }

  .order-hero-text {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
  }

  .order-side {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .order-base {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .row-logo {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .condition-block {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--muted);
    border-radius: var(--radius-sm);
  }

  .condition-arrow {
    display: flex;
    align-items: center;
  }

  .condition-arrow.above {
    color: var(--color-bullish);
  }

  .condition-arrow.below {
    color: var(--color-bearish);
  }

  .condition-text {
    font-size: 0.875rem;
    color: var(--foreground);
  }

  /* Routing panel */
  .routing-panel {
    gap: 0.5rem;
  }

  /* Fill indicator */
  .fill-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .fill-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .fill-value {
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--muted-foreground);
  }

  .fill-value.fill-full {
    color: var(--color-bullish);
  }

  .fill-value.fill-partial {
    color: oklch(0.75 0.15 85);
  }

  .fill-bar-track {
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .fill-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 300ms ease;
    background: var(--muted-foreground);
  }

  .fill-bar.fill-full {
    background: var(--color-bullish);
  }

  .fill-bar.fill-partial {
    background: oklch(0.75 0.15 85);
  }

  /* Collapsed: badges + fees + chevron */
  .routing-collapsed {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    width: 100%;
  }

  .routing-summary {
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground);
    flex-shrink: 0;
  }

  .total-fees {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--muted-foreground);
    margin-left: auto;
    white-space: nowrap;
  }

  .routing-chevron {
    color: var(--muted-foreground);
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .routing-chevron.expanded {
    transform: rotate(180deg);
  }

  /* Venue heading */
  .venue-heading {
    font-size: 12px;
    font-weight: 600;
    color: var(--foreground);
  }

  .venue-heading-pct {
    font-weight: 400;
    color: var(--muted-foreground);
  }

  /* Expanded venue details */
  .routing-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .venue-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .venue-card + .venue-card {
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
  }

  .venue-amounts {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .venue-amount-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .venue-amount-item:first-child {
    justify-self: start;
  }

  .venue-amount-item:last-child {
    justify-self: end;
  }

  .venue-amount-value {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  .venue-arrow {
    justify-self: center;
    font-size: 10px;
    color: var(--muted-foreground);
  }

  .venue-fee-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .venue-fee-label {
    font-size: 11px;
    color: var(--muted-foreground);
  }

  .venue-fee-value {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--muted-foreground);
  }

  .skip-toggle {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-bottom: 0.75rem;
    cursor: pointer;
  }

  .skip-toggle-label {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    user-select: none;
  }

  .toggle-switch {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }

  .toggle-switch input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-track {
    width: 32px;
    height: 18px;
    background: var(--muted);
    border-radius: 9px;
    position: relative;
    transition: background 150ms ease;
  }

  .toggle-switch.active .toggle-track {
    background: var(--primary);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--foreground);
    border-radius: 50%;
    transition: transform 150ms ease;
  }

  .toggle-switch.active .toggle-thumb {
    transform: translateX(14px);
    background: var(--background);
  }
</style>
