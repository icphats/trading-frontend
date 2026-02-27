<script lang="ts">
  /**
   * ActivityDetailsModal - Shows detailed view of a single activity
   *
   * Displays type-specific detail panels based on activity variant:
   * - Order: side, tick, input/output, fees, status
   * - Trigger: type, side, trigger/limit ticks, amount, status
   * - Liquidity: position ID, fee tier, tick range, amounts
   * - Transfer: direction, token, amount, block index
   * - Penalty: token, amount, tick bounds, order ID
   */

  import type { ActivityView } from "$lib/actors/services/spot.service";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import Modal from "../Modal.svelte";
  import { tickToPrice } from "$lib/domain/markets/utils";
  import { formatToken, formatSigFig, formatPipsAsPercent } from "$lib/utils/format.utils";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import {
    getActivityTypeLabel,
    getActivityCategory,
    getOrderDetails,
    getTriggerDetails,
    getLiquidityDetails,
    getTransferDetails,
    getPenaltyDetails,
    getPositionTransferDetails,
    computeActivityUsdValue,
  } from "$lib/utils/activity.utils";
  import ActivityTypeBadge from "$lib/components/ui/badges/ActivityTypeBadge.svelte";
  import { getTriggerLabel } from "$lib/utils/trigger.utils";

  interface Props {
    open: boolean;
    activity: ActivityView | null;
    spot: SpotMarket;
    onClose?: () => void;
  }

  let {
    open = $bindable(false),
    activity,
    spot,
    onClose
  }: Props = $props();

  // Get token metadata
  const token0 = $derived(spot.tokens ? entityStore.getToken(spot.tokens[0].toString()) : null);
  const token1 = $derived(spot.tokens && spot.tokens[1] ? entityStore.getToken(spot.tokens[1].toString()) : null);

  // Derive activity type info
  const typeLabel = $derived(activity ? getActivityTypeLabel(activity.activity_type) : '');
  const category = $derived(activity ? getActivityCategory(activity.activity_type) : 'order');

  // Format timestamp
  const timestampFormatted = $derived.by(() => {
    if (!activity) return '';
    const date = new Date(Number(activity.timestamp_ms));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  });

  // Compute actual USD value from activity amounts and quote rate
  const usdFormatted = $derived.by(() => {
    if (!activity) return '-';
    const tokenContext = {
      baseSymbol: token0?.displaySymbol ?? 'BASE',
      quoteSymbol: token1?.displaySymbol ?? 'QUOTE',
      baseDecimals: token0?.decimals ?? 8,
      quoteDecimals: token1?.decimals ?? 8,
    };
    const value = computeActivityUsdValue(activity, tokenContext);
    if (value === 0) return '-';
    if (value < 0.01) return '<$0.01';
    return `$${value.toFixed(2)}`;
  });

  // Activity ID display
  const activityIdDisplay = $derived(activity ? activity.activity_id.toString() : '');

  // Extract details based on type
  const orderDetails = $derived(activity ? getOrderDetails(activity) : null);
  const triggerDetails = $derived(activity ? getTriggerDetails(activity) : null);
  const liquidityDetails = $derived(activity ? getLiquidityDetails(activity) : null);
  const transferDetails = $derived(activity ? getTransferDetails(activity) : null);
  const penaltyDetails = $derived(activity ? getPenaltyDetails(activity) : null);
  const positionTransferDetails = $derived(activity ? getPositionTransferDetails(activity) : null);

  // Detect order_modified vs terminal order
  const isOrderModified = $derived(activity ? 'order_modified' in activity.activity_type : false);

  // Handlers
  function handleClose() {
    open = false;
    onClose?.();
  }

  // Format tick to price
  function formatTickPrice(tick: number): string {
    const price = tickToPrice(tick, spot.baseTokenDecimals, spot.quoteTokenDecimals);
    return formatSigFig(price, 5, { subscriptZeros: true });
  }

  // Format token amount
  function formatAmount(value: bigint, isBase: boolean): string {
    const decimals = isBase ? (token0?.decimals ?? 8) : (token1?.decimals ?? 8);
    return formatToken({
      value,
      unitName: decimals,
      displayDecimals: 6,
      commas: true,
    });
  }

  // Get token symbol
  function getTokenSymbol(isBase: boolean): string {
    return isBase ? (token0?.displaySymbol ?? 'BASE') : (token1?.displaySymbol ?? 'QUOTE');
  }

  // Derive status label from activity_type (single source of truth)
  const statusLabel = $derived.by(() => {
    if (!activity) return '';
    const t = activity.activity_type;
    if ('order_filled' in t) return 'Filled';
    if ('order_partial' in t) return 'Partial';
    if ('order_cancelled' in t) return 'Cancelled';
    if ('order_modified' in t) return 'Modified';
    if ('trigger_fired' in t) return 'Triggered';
    if ('trigger_cancelled' in t) return 'Cancelled';
    if ('trigger_failed' in t) return 'Failed';
    return '';
  });

  // Format trigger type (needs side for correct label)
  function formatTriggerType(side: any, type: any): string {
    return getTriggerLabel(side, type);
  }

  // Format a millisecond timestamp to date+time string
  function formatTimestamp(ms: bigint): string {
    const date = new Date(Number(ms));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
</script>

<Modal bind:open onClose={handleClose} title="Activity Details" size="sm" compactHeader={true}>
  {#snippet children()}
    {#if activity}
      <div class="modal-body">
        <!-- Header: Type badge + Activity ID + Timestamp -->
        <div class="activity-header">
          <div class="header-left">
            <ActivityTypeBadge type={activity.activity_type} />
            <span class="activity-id">#{activityIdDisplay}</span>
          </div>
          <span class="activity-timestamp">{timestampFormatted}</span>
        </div>

        <!-- Type-specific detail panel -->
        <div class="modal-panel">
          {#if orderDetails}
            <!-- Order Activity Panel -->
            {@const isBuy = 'buy' in orderDetails.side}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Order ID</span>
              <span class="modal-detail-value">#{orderDetails.order_id}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Side</span>
              <span class="modal-detail-value {isBuy ? 'text-bullish' : 'text-bearish'}">
                {isBuy ? 'Buy' : 'Sell'}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Price</span>
              <span class="modal-detail-value">{formatTickPrice(orderDetails.tick)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Input Spent</span>
              <span class="modal-detail-value">
                {formatAmount(orderDetails.input_spent, !isBuy)} {getTokenSymbol(!isBuy)}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Output Received</span>
              <span class="modal-detail-value">
                {formatAmount(orderDetails.output_received, isBuy)} {getTokenSymbol(isBuy)}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Locked Input</span>
              <span class="modal-detail-value">
                {formatAmount(orderDetails.locked_input, !isBuy)} {getTokenSymbol(!isBuy)}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">{isOrderModified ? 'Operation Fee' : 'Fees Paid'}</span>
              <span class="modal-detail-value">
                {formatAmount(orderDetails.fees_paid, !isBuy)} {getTokenSymbol(!isBuy)}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Status</span>
              <span class="modal-detail-value">{statusLabel}</span>
            </div>
            {#if orderDetails.immediate_or_cancel}
              <div class="modal-detail-row">
                <span class="modal-detail-label">Order Type</span>
                <span class="modal-detail-value">IOC</span>
              </div>
            {/if}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Created</span>
              <span class="modal-detail-value">{formatTimestamp(orderDetails.created_at_ms)}</span>
            </div>

          {:else if triggerDetails}
            <!-- Trigger Activity Panel -->
            {@const isBuy = 'buy' in triggerDetails.side}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Trigger ID</span>
              <span class="modal-detail-value">#{triggerDetails.trigger_id}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Type</span>
              <span class="modal-detail-value">{formatTriggerType(triggerDetails.side, triggerDetails.trigger_type)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Side</span>
              <span class="modal-detail-value {isBuy ? 'text-bullish' : 'text-bearish'}">
                {isBuy ? 'Buy' : 'Sell'}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Trigger Price</span>
              <span class="modal-detail-value">{formatTickPrice(triggerDetails.trigger_tick)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Limit Price</span>
              <span class="modal-detail-value">{formatTickPrice(triggerDetails.limit_tick)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Amount</span>
              <span class="modal-detail-value">
                {formatAmount(triggerDetails.input_amount, !isBuy)} {getTokenSymbol(!isBuy)}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Status</span>
              <span class="modal-detail-value">{statusLabel}</span>
            </div>
            {#if triggerDetails.immediate_or_cancel}
              <div class="modal-detail-row">
                <span class="modal-detail-label">Order Type</span>
                <span class="modal-detail-value">IOC</span>
              </div>
            {/if}
            {#if triggerDetails.resulting_order_id.length > 0}
              <div class="modal-detail-row">
                <span class="modal-detail-label">Order Created</span>
                <span class="modal-detail-value">#{triggerDetails.resulting_order_id[0]}</span>
              </div>
            {/if}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Created</span>
              <span class="modal-detail-value">{formatTimestamp(triggerDetails.created_at_ms)}</span>
            </div>

          {:else if liquidityDetails}
            <!-- Liquidity Activity Panel -->
            <div class="modal-detail-row">
              <span class="modal-detail-label">Position ID</span>
              <span class="modal-detail-value">#{liquidityDetails.position_id}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Fee Tier</span>
              <span class="modal-detail-value">{formatPipsAsPercent(liquidityDetails.fee_pips)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Tick Range</span>
              <span class="modal-detail-value">
                {liquidityDetails.tick_lower} - {liquidityDetails.tick_upper}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Price at Event</span>
              <span class="modal-detail-value">{formatTickPrice(liquidityDetails.tick_at_event)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Liquidity Delta</span>
              <span class="modal-detail-value">{liquidityDetails.liquidity_delta.toLocaleString()}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">{token0?.displaySymbol ?? 'Base'} Amount</span>
              <span class="modal-detail-value">{formatAmount(liquidityDetails.amount_base, true)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">{token1?.displaySymbol ?? 'Quote'} Amount</span>
              <span class="modal-detail-value">{formatAmount(liquidityDetails.amount_quote, false)}</span>
            </div>

          {:else if transferDetails}
            <!-- Transfer Activity Panel -->
            {@const isInbound = 'inbound' in transferDetails.direction}
            {@const isBase = 'base' in transferDetails.token}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Direction</span>
              <span class="modal-detail-value {isInbound ? 'text-bullish' : ''}">
                {isInbound ? 'Deposit' : 'Withdraw'}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Token</span>
              <span class="modal-detail-value">{getTokenSymbol(isBase)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Amount</span>
              <span class="modal-detail-value">{formatAmount(transferDetails.amount, isBase)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Ledger Fee</span>
              <span class="modal-detail-value">{formatAmount(transferDetails.ledger_fee, isBase)}</span>
            </div>
            {#if transferDetails.block_index.length > 0}
              <div class="modal-detail-row">
                <span class="modal-detail-label">Block Index</span>
                <span class="modal-detail-value">#{transferDetails.block_index[0]}</span>
              </div>
            {/if}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Ledger</span>
              <span class="modal-detail-value mono">{transferDetails.ledger_principal.toText()}</span>
            </div>

          {:else if penaltyDetails}
            <!-- Penalty Activity Panel -->
            {@const isBase = 'base' in penaltyDetails.token}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Token</span>
              <span class="modal-detail-value">{getTokenSymbol(isBase)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Penalty Amount</span>
              <span class="modal-detail-value text-bearish">
                {formatAmount(penaltyDetails.penalty_amount, isBase)}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Tick Before</span>
              <span class="modal-detail-value">{penaltyDetails.tick_before}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Tick After</span>
              <span class="modal-detail-value">{penaltyDetails.tick_after}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Tick Bounds</span>
              <span class="modal-detail-value">
                {penaltyDetails.bound_lower} - {penaltyDetails.bound_upper}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Order ID</span>
              <span class="modal-detail-value">#{penaltyDetails.order_id}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Pool Fee Tier</span>
              <span class="modal-detail-value">{formatPipsAsPercent(penaltyDetails.pool_fee_pips)}</span>
            </div>

          {:else if positionTransferDetails}
            <!-- Position Transfer Activity Panel -->
            {@const isSent = 'sent' in positionTransferDetails.direction}
            <div class="modal-detail-row">
              <span class="modal-detail-label">Direction</span>
              <span class="modal-detail-value {isSent ? 'text-bearish' : 'text-bullish'}">
                {isSent ? 'Sent' : 'Received'}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Position ID</span>
              <span class="modal-detail-value">#{positionTransferDetails.position_id}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Counterparty</span>
              <span class="modal-detail-value mono">{positionTransferDetails.counterparty.toText()}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Fee Tier</span>
              <span class="modal-detail-value">{formatPipsAsPercent(positionTransferDetails.fee_pips)}</span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Tick Range</span>
              <span class="modal-detail-value">
                {positionTransferDetails.tick_lower} - {positionTransferDetails.tick_upper}
              </span>
            </div>
            <div class="modal-detail-row">
              <span class="modal-detail-label">Liquidity</span>
              <span class="modal-detail-value">{positionTransferDetails.liquidity.toLocaleString()}</span>
            </div>
          {/if}
        </div>

        <!-- Footer: USD value at time of event -->
        <div class="activity-footer">
          <span class="footer-label">Value at Event</span>
          <span class="footer-value">{usdFormatted}</span>
        </div>
      </div>
    {:else}
      <div class="modal-empty">
        <p>No activity selected</p>
      </div>
    {/if}
  {/snippet}
</Modal>

<style>
  /* Header layout */
  .activity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .activity-id {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  .activity-timestamp {
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }

  /* Footer layout */
  .activity-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    margin-top: 0.75rem;
  }

  .footer-label {
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }

  .footer-value {
    font-size: 0.875rem;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  /* Color utilities */
  .text-bullish {
    color: var(--color-bullish);
  }

  .text-bearish {
    color: var(--color-bearish);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    word-break: break-all;
  }
</style>
