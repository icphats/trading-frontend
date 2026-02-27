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
  PenaltyActivityDetails,
  PositionTransferActivityDetails,
} from '$lib/actors/services/spot.service';
import { getTriggerLabel } from '$lib/utils/trigger.utils';
import { tickToPrice } from '$lib/domain/markets/utils/math';

// ============================================================================
// TYPES
// ============================================================================

export type ActivityCategory = 'order' | 'trigger' | 'lp' | 'transfer' | 'penalty';

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
  if ('order_filled' in type) return 'Filled';
  if ('order_partial' in type) return 'Partial';
  if ('order_cancelled' in type) return 'Cancelled';
  if ('trigger_fired' in type) return 'Triggered';
  if ('trigger_cancelled' in type) return 'Cancelled';
  if ('trigger_failed' in type) return 'Failed';
  if ('lp_opened' in type) return 'LP Open';
  if ('lp_increased' in type) return 'LP Increase';
  if ('lp_decreased' in type) return 'LP Decrease';
  if ('lp_closed' in type) return 'LP Close';
  if ('lp_fees_collected' in type) return 'Fees';
  if ('lp_locked' in type) return 'LP Lock';
  if ('transfer_in' in type) return 'Deposit';
  if ('transfer_out' in type) return 'Withdraw';
  if ('transfer_in_failed' in type) return 'Deposit Failed';
  if ('transfer_out_failed' in type) return 'Withdraw Failed';
  if ('circuit_breaker_penalty' in type) return 'Penalty';
  if ('order_modified' in type) return 'Modified';
  if ('lp_transferred' in type) return 'LP Transfer';
  return 'Unknown';
}

// ============================================================================
// CATEGORY MAPPING
// ============================================================================

/**
 * Maps ActivityType variant to a category for color coding
 */
export function getActivityCategory(type: ActivityType): ActivityCategory {
  if ('order_filled' in type) return 'order';
  if ('order_partial' in type) return 'order';
  if ('order_cancelled' in type) return 'order';
  if ('trigger_fired' in type) return 'trigger';
  if ('trigger_cancelled' in type) return 'trigger';
  if ('trigger_failed' in type) return 'trigger';
  if ('lp_opened' in type) return 'lp';
  if ('lp_increased' in type) return 'lp';
  if ('lp_decreased' in type) return 'lp';
  if ('lp_closed' in type) return 'lp';
  if ('lp_fees_collected' in type) return 'lp';
  if ('lp_locked' in type) return 'lp';
  if ('transfer_in' in type) return 'transfer';
  if ('transfer_out' in type) return 'transfer';
  if ('transfer_in_failed' in type) return 'transfer';
  if ('transfer_out_failed' in type) return 'transfer';
  if ('circuit_breaker_penalty' in type) return 'penalty';
  if ('order_modified' in type) return 'order';
  if ('lp_transferred' in type) return 'lp';
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

  // Order activities
  if ('order' in details) {
    const order = details.order;
    const side = 'buy' in order.side ? 'Buy' : 'Sell';
    const isModified = 'order_modified' in activity.activity_type;
    return isModified
      ? `${side} #${order.order_id} modified`
      : `${side} #${order.order_id}`;
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

  // Penalty activities
  if ('penalty' in details) {
    const penalty = details.penalty;
    const tokenSymbol = 'base' in penalty.token ? tokens.baseSymbol : tokens.quoteSymbol;
    return `${tokenSymbol} penalty`;
  }

  // Position transfer activities
  if ('position_transfer' in details) {
    const pt = details.position_transfer;
    const dir = 'sent' in pt.direction ? 'Sent' : 'Received';
    return `${dir} #${pt.position_id}`;
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

  if ('penalty' in details) {
    const penalty = details.penalty;
    return {
      amount: penalty.penalty_amount,
      token: 'base' in penalty.token ? 'base' : 'quote',
    };
  }

  if ('position_transfer' in details) {
    return {
      amount: details.position_transfer.liquidity,
      token: 'base' as const,
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
    if ('quote' in transfer.token) return quoteToUsd(transfer.amount);
    // Base transfer — no tick available, can't convert
    return 0;
  }

  if ('penalty' in details) {
    const penalty = details.penalty;
    if ('quote' in penalty.token) return quoteToUsd(penalty.penalty_amount);
    // Base penalty — use tick_before as reference price
    return baseToUsd(penalty.penalty_amount, penalty.tick_before);
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
 * Extracts penalty details from activity
 */
export function getPenaltyDetails(activity: ActivityView): PenaltyActivityDetails | null {
  if ('penalty' in activity.details) {
    return activity.details.penalty;
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
