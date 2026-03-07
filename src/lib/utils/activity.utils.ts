/**
 * Activity Utilities
 *
 * Utility functions for normalizing and displaying unified activity feed data.
 * Transforms backend ActivityView into display-ready formats.
 */

import type {
  ActivityView,
  ActivityType,
  ActivityDetails,
  OrderActivityDetails,
  TriggerActivityDetails,
  LiquidityActivityDetails,
  TransferActivityDetails,
  PositionTransferActivityDetails,
  BatchActivityDetails,
} from '$lib/actors/services/spot.service';
import { getTriggerLabel } from '$lib/utils/trigger.utils';
import { tickToPrice } from '$lib/domain/markets/utils/math';

// ============================================================================
// TYPES
// ============================================================================

export type ActivityCategory = 'order' | 'trigger' | 'lp' | 'transfer';

export interface NormalizedActivity {
  id: bigint;
  timestamp: bigint;
  type: ActivityType;
  typeLabel: string;
  typeCategory: ActivityCategory;
  description: string;
  amount: bigint;
  amountToken: 'base' | 'quote';
  usdValue: number;
  raw: ActivityView;
}

export interface TokenContext {
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
  quoteDecimals: number;
}

// ============================================================================
// TYPE LABEL MAPPING
// ============================================================================

/**
 * Maps ActivityType variant to a short display label
 */
export function getActivityTypeLabel(type: ActivityType): string {
  if ('swap' in type) return 'Swap';
  if ('order_filled' in type) return 'Filled';
  if ('order_partial' in type) return 'Partial';
  if ('order_cancelled' in type) return 'Cancelled';
  if ('order_modified' in type) return 'Modified';
  if ('trigger_fired' in type) return 'Triggered';
  if ('trigger_cancelled' in type) return 'Cancelled';
  if ('order_batch' in type) return 'Batch Order';
  if ('trigger_batch' in type) return 'Batch Trigger';
  if ('lp_opened' in type) return 'LP Open';
  if ('lp_increased' in type) return 'LP Increase';
  if ('lp_decreased' in type) return 'LP Decrease';
  if ('lp_closed' in type) return 'LP Close';
  if ('lp_fees_collected' in type) return 'Fees';
  if ('lp_locked' in type) return 'LP Lock';
  if ('lp_transferred' in type) return 'LP Transfer';
  if ('transfer_in' in type) return 'Deposit';
  if ('transfer_out' in type) return 'Withdraw';
  return 'Unknown';
}

// ============================================================================
// CATEGORY MAPPING
// ============================================================================

/**
 * Maps ActivityType variant to a category for color coding
 */
export function getActivityCategory(type: ActivityType): ActivityCategory {
  if ('swap' in type) return 'order';
  if ('order_filled' in type) return 'order';
  if ('order_partial' in type) return 'order';
  if ('order_cancelled' in type) return 'order';
  if ('order_modified' in type) return 'order';
  if ('trigger_fired' in type) return 'trigger';
  if ('trigger_cancelled' in type) return 'trigger';
  if ('order_batch' in type) return 'order';
  if ('trigger_batch' in type) return 'trigger';
  if ('lp_opened' in type) return 'lp';
  if ('lp_increased' in type) return 'lp';
  if ('lp_decreased' in type) return 'lp';
  if ('lp_closed' in type) return 'lp';
  if ('lp_fees_collected' in type) return 'lp';
  if ('lp_locked' in type) return 'lp';
  if ('lp_transferred' in type) return 'lp';
  if ('transfer_in' in type) return 'transfer';
  if ('transfer_out' in type) return 'transfer';
  return 'order';
}

// ============================================================================
// DESCRIPTION GENERATION
// ============================================================================

/**
 * Generates a human-readable description based on activity type and details
 */
export function getActivityDescription(
  activity: ActivityView,
  tokens: TokenContext
): string {
  const { details } = activity;

  // Order activities (including swap)
  if ('order' in details) {
    const order = details.order;
    const side = 'buy' in order.side ? 'Buy' : 'Sell';
    if ('swap' in activity.activity_type) return `${side} swap`;
    if ('order_modified' in activity.activity_type) return `${side} #${order.order_id} modified`;
    return `${side} #${order.order_id}`;
  }

  // Trigger activities
  if ('trigger' in details) {
    const trigger = details.trigger;
    return `${getTriggerLabel(trigger.side, trigger.trigger_type)} #${trigger.trigger_id}`;
  }

  // Liquidity activities
  if ('liquidity' in details) {
    const lp = details.liquidity;
    const feePct = (lp.fee_pips / 10000).toFixed(2);
    return `${feePct}% pool #${lp.position_id}`;
  }

  // Transfer activities
  if ('transfer' in details) {
    const transfer = details.transfer;
    const tokenSymbol = 'base' in transfer.token ? tokens.baseSymbol : tokens.quoteSymbol;
    return tokenSymbol;
  }

  // Position transfer activities
  if ('position_transfer' in details) {
    const pt = details.position_transfer;
    const dir = 'sent' in pt.direction ? 'Sent' : 'Received';
    return `${dir} #${pt.position_id}`;
  }

  // Batch activities
  if ('batch' in details) {
    const batch = details.batch;
    const count = batch.item_count;
    if ('order_batch' in activity.activity_type) {
      const swaps = batch.swap_count;
      return swaps > 0 ? `${count} orders + ${swaps} swaps` : `${count} orders`;
    }
    return `${count} triggers`;
  }

  return '';
}

// ============================================================================
// AMOUNT EXTRACTION
// ============================================================================

/**
 * Extracts the primary amount and token type from activity details
 */
export function getActivityAmount(
  activity: ActivityView
): { amount: bigint; token: 'base' | 'quote' } {
  const { details } = activity;

  if ('order' in details) {
    const order = details.order;
    // For orders, show input spent
    const isBuy = 'buy' in order.side;
    return {
      amount: order.input_spent,
      token: isBuy ? 'quote' : 'base',
    };
  }

  if ('trigger' in details) {
    const trigger = details.trigger;
    const isBuy = 'buy' in trigger.side;
    return {
      amount: trigger.input_amount,
      token: isBuy ? 'quote' : 'base',
    };
  }

  if ('liquidity' in details) {
    const lp = details.liquidity;
    // Show base amount as primary
    return {
      amount: lp.amount_base,
      token: 'base',
    };
  }

  if ('transfer' in details) {
    const transfer = details.transfer;
    return {
      amount: transfer.amount,
      token: 'base' in transfer.token ? 'base' : 'quote',
    };
  }

  if ('position_transfer' in details) {
    return {
      amount: details.position_transfer.liquidity,
      token: 'base' as const,
    };
  }

  if ('batch' in details) {
    return {
      amount: details.batch.op_fee_amount,
      token: 'base' in details.batch.op_fee_token ? 'base' : 'quote',
    };
  }

  return { amount: 0n, token: 'base' };
}

// ============================================================================
// STATUS EXTRACTION
// ============================================================================

// ============================================================================
// USD VALUE COMPUTATION
// ============================================================================

/**
 * Computes the actual USD value of an activity using quote_usd_e12 rate.
 * For quote-denominated amounts: direct conversion via rate.
 * For base-denominated amounts: converts to quote using tick price, then to USD.
 */
export function computeActivityUsdValue(activity: ActivityView, tokens: TokenContext): number {
  const rate = Number(activity.quote_usd_e12);
  if (rate === 0) return 0;

  const quoteScale = 10 ** tokens.quoteDecimals;
  const baseScale = 10 ** tokens.baseDecimals;
  const E12 = 1e12;

  function quoteToUsd(quoteAmount: bigint): number {
    return Number(quoteAmount) * rate / (quoteScale * E12);
  }

  function baseToUsd(baseAmount: bigint, tick: number): number {
    const price = tickToPrice(tick, tokens.baseDecimals, tokens.quoteDecimals);
    return Number(baseAmount) * price * rate / (baseScale * E12);
  }

  const { details } = activity;

  if ('order' in details) {
    const order = details.order;
    const isBuy = 'buy' in order.side;
    // Buy: input_spent is quote. Sell: output_received is quote.
    const quoteAmount = isBuy ? order.input_spent : order.output_received;
    return quoteToUsd(quoteAmount);
  }

  if ('trigger' in details) {
    const trigger = details.trigger;
    const isBuy = 'buy' in trigger.side;
    if (isBuy) return quoteToUsd(trigger.input_amount);
    // Sell: input is base, convert via trigger tick
    return baseToUsd(trigger.input_amount, trigger.trigger_tick);
  }

  if ('liquidity' in details) {
    const lp = details.liquidity;
    // Quote portion directly + base portion via tick at event
    const quoteUsd = quoteToUsd(lp.amount_quote);
    const baseUsd = baseToUsd(lp.amount_base, lp.tick_at_event);
    return quoteUsd + baseUsd;
  }

  if ('transfer' in details) {
    const transfer = details.transfer;
    const tokenDecimals = 'base' in transfer.token ? tokens.baseDecimals : tokens.quoteDecimals;
    const scale = 10 ** tokenDecimals;
    return Number(transfer.amount) * Number(transfer.token_price_usd_e12) / (scale * E12);
  }

  if ('batch' in details) {
    const batch = details.batch;
    const baseUsd = Number(batch.total_base_locked) * Number(batch.base_price_usd_e12) / (10 ** tokens.baseDecimals * E12);
    const quoteUsd = Number(batch.total_quote_locked) * Number(batch.quote_price_usd_e12) / (10 ** tokens.quoteDecimals * E12);
    return baseUsd + quoteUsd;
  }

  return 0;
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Transforms ActivityView into a normalized row format for table display
 */
export function normalizeActivity(
  activity: ActivityView,
  tokens: TokenContext
): NormalizedActivity {
  const { amount, token } = getActivityAmount(activity);

  return {
    id: activity.activity_id,
    timestamp: activity.timestamp_ms,
    type: activity.activity_type,
    typeLabel: getActivityTypeLabel(activity.activity_type),
    typeCategory: getActivityCategory(activity.activity_type),
    description: getActivityDescription(activity, tokens),
    amount,
    amountToken: token,
    usdValue: computeActivityUsdValue(activity, tokens),
    raw: activity,
  };
}

// ============================================================================
// DETAIL HELPERS
// ============================================================================

/**
 * Extracts order details from activity
 */
export function getOrderDetails(activity: ActivityView): OrderActivityDetails | null {
  if ('order' in activity.details) {
    return activity.details.order;
  }
  return null;
}

/**
 * Extracts trigger details from activity
 */
export function getTriggerDetails(activity: ActivityView): TriggerActivityDetails | null {
  if ('trigger' in activity.details) {
    return activity.details.trigger;
  }
  return null;
}

/**
 * Extracts liquidity details from activity
 */
export function getLiquidityDetails(activity: ActivityView): LiquidityActivityDetails | null {
  if ('liquidity' in activity.details) {
    return activity.details.liquidity;
  }
  return null;
}

/**
 * Extracts transfer details from activity
 */
export function getTransferDetails(activity: ActivityView): TransferActivityDetails | null {
  if ('transfer' in activity.details) {
    return activity.details.transfer;
  }
  return null;
}

/**
 * Extracts position transfer details from activity
 */
export function getPositionTransferDetails(activity: ActivityView): PositionTransferActivityDetails | null {
  if ('position_transfer' in activity.details) {
    return activity.details.position_transfer;
  }
  return null;
}

/**
 * Extracts batch details from activity
 */
export function getBatchDetails(activity: ActivityView): BatchActivityDetails | null {
  if ('batch' in activity.details) {
    return activity.details.batch;
  }
  return null;
}
