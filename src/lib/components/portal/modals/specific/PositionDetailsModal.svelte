<script lang="ts">
  import type { PositionViewEnhanced } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Modal from "../Modal.svelte";
  import ButtonV2 from "$lib/components/ui/ButtonV2.svelte";
  import Logo from "$lib/components/ui/Logo.svelte";
  import { tickToPrice, bpsToPercent } from "$lib/domain/markets/utils";
  import { formatSigFig, formatUSD, bigIntToString } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import IncreaseLiquidityModal from "./IncreaseLiquidityModal.svelte";
  import DecreaseLiquidityModal from "./DecreaseLiquidityModal.svelte";
  import CollectFeesModal from "./CollectFeesModal.svelte";
  import LockPositionModal from "./LockPositionModal.svelte";
  import TransferPositionModal from "./TransferPositionModal.svelte";
  import { formatTimestamp } from "$lib/utils/format.utils";
  import { PERMANENT_LOCK_MS } from "$lib/constants/app.constants";

  interface Props {
    open: boolean;
    position: PositionViewEnhanced | null;
    spot: SpotMarket;
    onClose?: () => void;
  }

  let {
    open = $bindable(false),
    position,
    spot,
    onClose
  }: Props = $props();

  // Sub-modal states
  let increaseModalOpen = $state(false);
  let decreaseModalOpen = $state(false);
  let collectModalOpen = $state(false);
  let lockModalOpen = $state(false);
  let transferModalOpen = $state(false);

  // Token info
  const market = $derived(entityStore.getMarket(spot.canister_id));
  const baseToken = $derived(market?.baseToken ? entityStore.getToken(market.baseToken) : null);
  const quoteToken = $derived(market?.quoteToken ? entityStore.getToken(market.quoteToken) : null);
  const baseDecimals = $derived(baseToken?.decimals ?? 8);
  const quoteDecimals = $derived(quoteToken?.decimals ?? 8);

  // Derived position info
  const inRange = $derived(
    position && spot.lastTradeTick !== null ? spot.lastTradeTick >= position.tick_lower && spot.lastTradeTick < position.tick_upper : false
  );

  const feeTier = $derived(
    position ? (position.fee_pips / 10000).toFixed(position.fee_pips % 10000 === 0 ? 1 : 2) + '%' : ''
  );

  const lowerPrice = $derived.by(() => {
    if (!position) return '0';
    return formatSigFig(tickToPrice(position.tick_lower, baseDecimals, quoteDecimals), 5, { subscriptZeros: true });
  });

  const upperPrice = $derived.by(() => {
    if (!position) return '0';
    return formatSigFig(tickToPrice(position.tick_upper, baseDecimals, quoteDecimals), 5, { subscriptZeros: true });
  });

  const positionValue = $derived(
    position ? formatUSD(Number(position.usd_value_e6) / 1e6) : '—'
  );

  const feesValue = $derived(
    position ? formatUSD(Number(position.fees_usd_value_e6) / 1e6) : '—'
  );

  const apr = $derived(
    position ? bpsToPercent(position.apr_bps).toFixed(1) + '%' : '—'
  );

  const positionIdDisplay = $derived(position ? position.position_id.toString() : '');

  // Lock status
  const lockedUntil = $derived(position?.locked_until?.[0] ?? null);
  const isLocked = $derived(lockedUntil !== null && lockedUntil > BigInt(Date.now()));
  const isPermanentlyLocked = $derived(lockedUntil !== null && lockedUntil >= PERMANENT_LOCK_MS);

  // Token amounts
  const baseAmount = $derived(
    position && baseToken ? bigIntToString(position.amount_base, baseToken.decimals) : '0'
  );
  const quoteAmount = $derived(
    position && quoteToken ? bigIntToString(position.amount_quote, quoteToken.decimals) : '0'
  );
  const baseFees = $derived(
    position && baseToken ? bigIntToString(position.fees_base, baseToken.decimals) : '0'
  );
  const quoteFees = $derived(
    position && quoteToken ? bigIntToString(position.fees_quote, quoteToken.decimals) : '0'
  );

  // Handlers
  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleIncreaseClick() {
    open = false;
    increaseModalOpen = true;
  }

  function handleDecreaseClick() {
    open = false;
    decreaseModalOpen = true;
  }

  function handleCollectClick() {
    open = false;
    collectModalOpen = true;
  }

  function handleLockClick() {
    open = false;
    lockModalOpen = true;
  }

  function handleTransferClick() {
    open = false;
    transferModalOpen = true;
  }

  function handleBackToDetails() {
    increaseModalOpen = false;
    decreaseModalOpen = false;
    collectModalOpen = false;
    lockModalOpen = false;
    transferModalOpen = false;
    open = true;
  }

  function handleSuccess() {
    increaseModalOpen = false;
    decreaseModalOpen = false;
    collectModalOpen = false;
    lockModalOpen = false;
    transferModalOpen = false;
    onClose?.();
  }
</script>

<Modal bind:open onClose={handleClose} title="Position Details" size="sm" compactHeader={true}>
  {#snippet children()}
    {#if position}
      <div class="modal-body">
        <!-- Position Header -->
        <div class="position-header">
          <span class="position-status" class:in-range={inRange} class:out-of-range={!inRange}>
            <span class="status-dot"></span>
            {inRange ? 'In Range' : 'Out of Range'}
          </span>
          {#if isLocked && lockedUntil}
            <span class="lock-badge">&#128274; {isPermanentlyLocked ? 'Permanent' : `Until ${formatTimestamp(lockedUntil)}`}</span>
          {/if}
          <span class="position-id">#{positionIdDisplay}</span>
        </div>

        <!-- Range & Stats -->
        <div class="flat-section">
          <div class="range-top">
            <div class="range-stat">
              <span class="range-stat-label">Fee Tier</span>
              <span class="range-stat-value">{feeTier}</span>
            </div>
            <div class="range-stat right">
              <span class="range-stat-label">APR</span>
              <span class="range-stat-value apr">{apr}</span>
            </div>
          </div>
          <div class="range-prices">
            <div class="range-bound">
              <span class="range-bound-value">{lowerPrice}</span>
              <span class="range-bound-label">Min</span>
            </div>
            <div class="range-connector">
              <span class="range-line"></span>
              <span class="range-unit">{quoteToken?.displaySymbol ?? ''}</span>
            </div>
            <div class="range-bound">
              <span class="range-bound-value">{upperPrice}</span>
              <span class="range-bound-label">Max</span>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Deposited Amounts -->
        <div class="flat-section">
          <div class="token-row">
            <div class="token-info">
              {#if baseToken}
                <Logo src={baseToken.logo ?? undefined} alt={baseToken.displaySymbol} size="xs" circle={true} />
                <span class="token-symbol">{baseToken.displaySymbol}</span>
              {/if}
            </div>
            <span class="token-amount">{baseAmount}</span>
          </div>
          <div class="token-row">
            <div class="token-info">
              {#if quoteToken}
                <Logo src={quoteToken.logo ?? undefined} alt={quoteToken.displaySymbol} size="xs" circle={true} />
                <span class="token-symbol">{quoteToken.displaySymbol}</span>
              {/if}
            </div>
            <span class="token-amount">{quoteAmount}</span>
          </div>
          <div class="section-footer">
            <span class="section-footer-label">Total Value</span>
            <span class="section-footer-value">{positionValue}</span>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Uncollected Fees -->
        <div class="flat-section">
          <span class="section-label">Uncollected Fees</span>
          <div class="token-row">
            <div class="token-info">
              {#if baseToken}
                <Logo src={baseToken.logo ?? undefined} alt={baseToken.displaySymbol} size="xs" circle={true} />
                <span class="token-symbol">{baseToken.displaySymbol}</span>
              {/if}
            </div>
            <span class="token-amount">{baseFees}</span>
          </div>
          <div class="token-row">
            <div class="token-info">
              {#if quoteToken}
                <Logo src={quoteToken.logo ?? undefined} alt={quoteToken.displaySymbol} size="xs" circle={true} />
                <span class="token-symbol">{quoteToken.displaySymbol}</span>
              {/if}
            </div>
            <span class="token-amount">{quoteFees}</span>
          </div>
          <div class="section-footer">
            <span class="section-footer-label">Total Fees</span>
            <span class="section-footer-value fees">{feesValue}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <ButtonV2 variant="primary" size="xl" fullWidth onclick={handleCollectClick}>
            Collect Fees
          </ButtonV2>
          <div class="action-row">
            <ButtonV2 variant="secondary" size="md" fullWidth onclick={handleIncreaseClick}>
              Increase
            </ButtonV2>
            <ButtonV2 variant="secondary" size="md" fullWidth onclick={handleDecreaseClick} disabled={isLocked}>
              {isLocked ? 'Locked' : 'Decrease'}
            </ButtonV2>
          </div>
          <div class="action-row">
            <ButtonV2 variant="secondary" size="md" fullWidth onclick={handleLockClick}>
              {isLocked ? 'Extend Lock' : 'Lock'}
            </ButtonV2>
            <ButtonV2 variant="secondary" size="md" fullWidth onclick={handleTransferClick}>
              Transfer
            </ButtonV2>
          </div>
        </div>
      </div>
    {:else}
      <div class="modal-empty">
        <p>No position selected</p>
      </div>
    {/if}
  {/snippet}
</Modal>

<!-- Sub-modals -->
{#if position}
  <IncreaseLiquidityModal
    positionId={position.position_id}
    {spot}
    bind:open={increaseModalOpen}
    onClose={handleBackToDetails}
    onSuccess={handleSuccess}
  />

  <DecreaseLiquidityModal
    positionId={position.position_id}
    {spot}
    bind:open={decreaseModalOpen}
    onClose={handleBackToDetails}
    onSuccess={handleSuccess}
  />

  <CollectFeesModal
    positionId={position.position_id}
    {spot}
    bind:open={collectModalOpen}
    onClose={handleBackToDetails}
    onSuccess={handleSuccess}
  />

  <LockPositionModal
    positionId={position.position_id}
    {spot}
    bind:open={lockModalOpen}
    onClose={handleBackToDetails}
    onSuccess={handleSuccess}
  />

  <TransferPositionModal
    positionId={position.position_id}
    {spot}
    bind:open={transferModalOpen}
    onClose={handleBackToDetails}
    onSuccess={handleSuccess}
  />
{/if}

<style>
  .position-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .position-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .position-status.in-range {
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .position-status.in-range .status-dot {
    background: var(--color-bullish);
  }

  .position-status.out-of-range {
    background: oklch(from var(--color-warning, orange) l c h / 0.15);
    color: var(--color-warning, orange);
  }

  .position-status.out-of-range .status-dot {
    background: var(--color-warning, orange);
  }

  .lock-badge {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.1875rem 0.5rem;
    border-radius: var(--radius-sm);
    background: oklch(from var(--color-blue) l c h / 0.15);
    color: var(--color-blue);
    white-space: nowrap;
  }

  .position-id {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  /* Token rows */
  .token-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .token-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .token-symbol {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
  }

  .token-amount {
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  /* Flat sections & dividers */
  .flat-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .divider {
    display: none;
  }

  .section-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted-foreground);
  }

  .section-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border);
    padding-top: 0.5rem;
    margin-top: 0.25rem;
  }

  .section-footer-label {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .section-footer-value {
    font-size: 0.875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .section-footer-value.fees {
    color: var(--color-bullish);
  }

  .range-top {
    display: flex;
    justify-content: space-between;
  }

  .range-stat {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .range-stat.right {
    text-align: right;
  }

  .range-stat-label {
    font-size: 0.6875rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .range-stat-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }

  .range-stat-value.apr {
    color: var(--color-bullish);
  }

  .range-prices {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .range-bound {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
  }

  .range-bound-value {
    font-size: 0.875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .range-bound-label {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted-foreground);
  }

  .range-connector {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .range-line {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, var(--muted-foreground), var(--border) 50%, var(--muted-foreground));
  }

  .range-unit {
    font-size: 0.625rem;
    color: var(--muted-foreground);
  }

  /* Actions */
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .action-row {
    display: flex;
    gap: 0.5rem;
  }

</style>
