/**
 * Agent Price Helpers
 *
 * Ported from test-harness/src/simulator/behaviors/price.ts
 * Tick↔price conversion, random amount generation, tick alignment.
 */

import type { AgentTracker } from './agent.types';

// ============================================
// Utilities
// ============================================

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(minUsd: number, maxUsd: number, decimals: number, priceUsd: number): bigint {
  const safePriceUsd = Math.max(priceUsd, 1e-12);
  const usd = minUsd + Math.random() * (maxUsd - minUsd);
  const units = (usd / safePriceUsd) * 10 ** decimals;
  return BigInt(Math.max(1, Math.floor(units)));
}

// ============================================
// Price from Tick
// ============================================

export function basePriceUsd(tick: number, baseDecimals: number, quoteDecimals: number, symbol: string): number {
  const logPrice = tick * Math.log(1.0001)
    + Math.log(10) * (baseDecimals - quoteDecimals);
  const priceHuman = Math.exp(logPrice);
  const quoteUsd = symbol.endsWith('/ICP') ? 3.0 : 1.0;
  const result = priceHuman * quoteUsd;
  if (!isFinite(result) || result <= 0) return 1.0;
  return result;
}

function quoteUsdMultiplier(symbol: string): number {
  return symbol.endsWith('/ICP') ? 3.0 : 1.0;
}

// ============================================
// Order Tick Generation
// ============================================

export function buyOrderTick(currentTick: number): number {
  if (Math.random() < 0.3) return currentTick + randInt(0, 200);
  return currentTick - randInt(10, 500);
}

export function sellOrderTick(currentTick: number): number {
  if (Math.random() < 0.3) return currentTick - randInt(0, 200);
  return currentTick + randInt(10, 500);
}

// ============================================
// Amount Generation
// ============================================

export function orderAmount(
  side: 'buy' | 'sell',
  t: AgentTracker,
): bigint {
  const priceUsd = basePriceUsd(t.tick!, t.baseDecimals, t.quoteDecimals, t.symbol);
  const quoteUsd = quoteUsdMultiplier(t.symbol);
  if (side === 'buy') {
    return randAmount(20, 200, t.quoteDecimals, quoteUsd);
  } else {
    return randAmount(20, 200, t.baseDecimals, priceUsd);
  }
}

export function swapAmount(
  side: 'buy' | 'sell',
  t: AgentTracker,
): bigint {
  return orderAmount(side, t);
}

export function triggerAmount(
  side: 'buy' | 'sell',
  t: AgentTracker,
): bigint {
  return orderAmount(side, t);
}

export function depositAmount(
  token: 'base' | 'quote',
  t: AgentTracker,
): bigint {
  const priceUsd = basePriceUsd(t.tick!, t.baseDecimals, t.quoteDecimals, t.symbol);
  if (token === 'base') {
    return randAmount(5000, 20000, t.baseDecimals, priceUsd);
  } else {
    const quoteUsd = quoteUsdMultiplier(t.symbol);
    return randAmount(5000, 20000, t.quoteDecimals, quoteUsd);
  }
}

// ============================================
// Trigger Ticks
// ============================================

export function buyTriggerTicks(currentTick: number): { triggerTick: number; limitTick: number } {
  const offset = randInt(20, 200);
  return {
    triggerTick: currentTick + offset,
    limitTick: currentTick + offset + randInt(20, 100),
  };
}

export function sellTriggerTicks(currentTick: number): { triggerTick: number; limitTick: number } {
  const offset = randInt(20, 200);
  return {
    triggerTick: currentTick - offset,
    limitTick: currentTick - offset - randInt(20, 100),
  };
}

// ============================================
// Bracket Orders
// ============================================

export function bracketBuy(currentTick: number): { orderTick: number; triggerTick: number; limitTick: number } {
  const orderTick = currentTick + randInt(0, 100);
  const stopOffset = randInt(30, 150);
  return {
    orderTick,
    triggerTick: currentTick - stopOffset,
    limitTick: currentTick - stopOffset - randInt(20, 80),
  };
}

export function bracketSell(currentTick: number): { orderTick: number; triggerTick: number; limitTick: number } {
  const orderTick = currentTick - randInt(0, 100);
  const stopOffset = randInt(30, 150);
  return {
    orderTick,
    triggerTick: currentTick + stopOffset,
    limitTick: currentTick + stopOffset + randInt(20, 80),
  };
}

// ============================================
// Grid Orders
// ============================================

export function gridTicks(currentTick: number, side: 'buy' | 'sell', count: number = 3): number[] {
  const spacing = randInt(20, 80);
  const ticks: number[] = [];
  for (let i = 1; i <= count; i++) {
    ticks.push(side === 'buy' ? currentTick - spacing * i : currentTick + spacing * i);
  }
  return ticks;
}

// ============================================
// Liquidity
// ============================================

/** Align tick down (toward -∞) to nearest multiple of spacing */
function alignDown(tick: number, spacing: number): number {
  return Math.floor(tick / spacing) * spacing;
}

/** Align tick up (toward +∞) to nearest multiple of spacing */
function alignUp(tick: number, spacing: number): number {
  return Math.ceil(tick / spacing) * spacing;
}

export function tickSpacingFromFeePips(feePips: number): number {
  switch (feePips) {
    case 100: return 1;
    case 500: return 10;
    case 3000: return 60;
    case 10000: return 200;
    default: return 60;
  }
}

export function liquidityRange(currentTick: number, feePips: number): { tickLower: number; tickUpper: number } {
  const spacing = tickSpacingFromFeePips(feePips);
  const halfWidth = randInt(100, 1000);
  const rawLower = currentTick - halfWidth;
  const rawUpper = currentTick + halfWidth;
  const tickLower = alignDown(rawLower, spacing);
  const tickUpper = alignUp(rawUpper, spacing);
  return { tickLower, tickUpper: Math.max(tickUpper, tickLower + spacing) };
}

export function liquidityAmounts(t: AgentTracker): { amount0: bigint; amount1: bigint } {
  const priceUsd = basePriceUsd(t.tick!, t.baseDecimals, t.quoteDecimals, t.symbol);
  const quoteUsd = quoteUsdMultiplier(t.symbol);
  return {
    amount0: randAmount(50, 500, t.baseDecimals, priceUsd),
    amount1: randAmount(50, 500, t.quoteDecimals, quoteUsd),
  };
}

// ============================================
// Update Order
// ============================================

export function updateOrderTick(currentTick: number): number {
  return currentTick + randInt(-50, 50);
}

// ============================================
// Balance Guards
// ============================================

export function usableBudget(available: bigint, fee: bigint): bigint {
  return available > fee * 2n ? available - fee * 2n : 0n;
}

export function aboveMinimum(amount: bigint, fee: bigint): boolean {
  return amount > fee * 10n;
}

// ============================================
// Format Helpers
// ============================================

export function fmtNat(n: bigint | number): string {
  return n.toLocaleString('en-US').replace(/,/g, '_');
}
