import type { TriggerType, Side } from "$lib/actors/services/spot.service";

/**
 * Trigger classification based on price direction.
 *
 * The backend stores trigger_type as #above/#below (price direction).
 * We surface this directly — no SL/TP inference.
 *
 *   Buy  + above = "Buy Above"   (buy when price rises past threshold)
 *   Buy  + below = "Buy Below"   (buy when price falls past threshold)
 *   Sell + above = "Sell Above"   (sell when price rises past threshold)
 *   Sell + below = "Sell Below"   (sell when price falls past threshold)
 */
export type TriggerDirection = "Above" | "Below";

export function isAbove(triggerType: TriggerType): boolean {
  return "above" in triggerType;
}

export function getTriggerDirection(triggerType: TriggerType): TriggerDirection {
  return isAbove(triggerType) ? "Above" : "Below";
}

export function getTriggerLabel(side: Side, triggerType: TriggerType): string {
  const sideStr = "buy" in side ? "Buy" : "Sell";
  const direction = getTriggerDirection(triggerType);
  return `${sideStr} ${direction}`;
}

export function getTriggerLabelShort(triggerType: TriggerType): string {
  return isAbove(triggerType) ? "Above" : "Below";
}

/** CSS variant based on side (buy=bullish, sell=bearish) */
export function getTriggerVariant(side: Side): "buy" | "sell" {
  return "buy" in side ? "buy" : "sell";
}

/** Price direction description for info banners */
export function getTriggerDirectionText(triggerType: TriggerType, formattedPrice: string): string {
  if ("above" in triggerType) {
    return `Triggers when price rises above $${formattedPrice}`;
  }
  return `Triggers when price falls below $${formattedPrice}`;
}
