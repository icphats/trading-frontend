import type { OrderView } from 'declarations/spot/spot.did';
import { tickToPrice } from '$lib/domain/markets/utils/math';

export interface PriceLine {
  type: "TRIGGER_BUY" | "TRIGGER_SELL" | "LIMIT_BUY" | "LIMIT_SELL" | "LIQUIDATION";
  price: number;
  key: string; // Unique identifier for deduplication
  amount?: bigint; // Optional: remaining/locked amount for display
}

const SCALE = 100_000_000;
const DEFAULT_BULLISH = "#10b981";
const DEFAULT_BEARISH = "#ef4444";

// Derive limit order lines from userinfo.orders
export function deriveLimitOrderLines(userinfo: any): PriceLine[] {
  if (!userinfo?.orders) return [];

  return userinfo.orders
    .filter((order: any) => order.limit_price && order.limit_price !== 0n)
    .map((order: any, index: number) => {
      const orderType: "LIMIT_BUY" | "LIMIT_SELL" = "long" in order.side ? "LIMIT_BUY" : "LIMIT_SELL";
      return {
        type: orderType,
        price: Number(order.limit_price) / SCALE,
        key: `limit-${order.side}-${Number(order.limit_price)}-${index}`,
      };
    });
}

// Derive liquidation price line
export function deriveLiquidationLine(userinfo: any): PriceLine[] {
  if (!userinfo?.liquidation_price) return [];

  const price = Number(userinfo.liquidation_price) / SCALE;
  if (price === 0) return [];

  return [{
    type: "LIQUIDATION" as const,
    price,
    key: `liquidation-${price}`,
  }];
}

// Color configuration for each line type
export function getLineColor(type: PriceLine["type"], themeColors: { bullish?: string; bearish?: string }): string {
  const bullish = themeColors.bullish ?? DEFAULT_BULLISH;
  const bearish = themeColors.bearish ?? DEFAULT_BEARISH;
  switch (type) {
    case "TRIGGER_BUY": return bullish;
    case "TRIGGER_SELL": return bearish;
    case "LIMIT_BUY": return bullish;
    case "LIMIT_SELL": return bearish;
    case "LIQUIDATION": return "#FF6B00"; // Distinct orange for liquidation
    default: return "#6b7280";
  }
}

// User-friendly label for each line type
export function getLineLabel(type: PriceLine["type"]): string {
  switch (type) {
    case "TRIGGER_BUY": return "Buy";
    case "TRIGGER_SELL": return "Sell";
    case "LIMIT_BUY": return "Buy";
    case "LIMIT_SELL": return "Sell";
    case "LIQUIDATION": return "Liquidation";
    default: return "";
  }
}

// Derive spot limit order lines from userOrders
export function deriveSpotLimitOrderLines(
  userOrders: OrderView[],
  baseDecimals: number = 8,
  quoteDecimals: number = 8,
): PriceLine[] {
  if (!userOrders || userOrders.length === 0) return [];

  return userOrders
    // Filter for active orders only (pending or partial)
    .filter((order) => 'pending' in order.status || 'partial' in order.status)
    .map((order) => {
      const orderType: "LIMIT_BUY" | "LIMIT_SELL" = 'buy' in order.side ? "LIMIT_BUY" : "LIMIT_SELL";
      const price = tickToPrice(order.tick, baseDecimals, quoteDecimals);
      // Remaining = base_amount - base_filled
      const remaining = order.base_amount - order.base_filled;

      return {
        type: orderType,
        price,
        key: `limit-${order.order_id}-${order.tick}`,
        amount: remaining, // Include remaining amount for display
      };
    });
}

// Derive trigger order lines from userTriggers
export function deriveSpotTriggerOrderLines(
  userTriggers: any[],
  baseDecimals: number = 8,
  quoteDecimals: number = 8,
): PriceLine[] {
  if (!userTriggers || userTriggers.length === 0) return [];

  return userTriggers
    // Filter for active triggers only
    .filter((trigger) => 'active' in trigger.status)
    .map((trigger) => {
      // Color by side (buy=bullish, sell=bearish)
      const type: "TRIGGER_BUY" | "TRIGGER_SELL" = 'buy' in trigger.side ? "TRIGGER_BUY" : "TRIGGER_SELL";

      // Convert trigger tick to price (same as limit orders)
      const price = tickToPrice(trigger.trigger_tick, baseDecimals, quoteDecimals);

      return {
        type,
        price,
        key: `trigger-${trigger.trigger_id}-${trigger.trigger_tick}`,
      };
    });
}
