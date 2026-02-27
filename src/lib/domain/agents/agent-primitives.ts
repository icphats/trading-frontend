/**
 * Agent Primitives
 *
 * 23 action implementations that call SpotMarket methods.
 * Each action checks availability, logs its intent, executes, and reports results.
 */

import type { SpotMarket } from '$lib/domain/markets/state/spot-market.svelte';
import { marketRepository } from '$lib/repositories/market.repository';
import { checkAndApprove } from '$lib/utils/allowance.utils';
import type { AgentTracker, ActionResult, ActionType, AgentConfig, AgentLogEntry } from './agent.types';
import {
  buyOrderTick, sellOrderTick, orderAmount, swapAmount, triggerAmount,
  buyTriggerTicks, sellTriggerTicks, bracketBuy, bracketSell,
  gridTicks, liquidityRange, liquidityAmounts, updateOrderTick,
  depositAmount, fmtNat, usableBudget, aboveMinimum,
} from './agent-price';

type LogFn = (entry: Omit<AgentLogEntry, 'id' | 'timestamp'>) => void;

// ============================================
// Availability Checks
// ============================================

export function getAvailableActions(tracker: AgentTracker, config: AgentConfig): ActionType[] {
  const available: ActionType[] = [];
  const hasQuote = usableBudget(tracker.availableQuote, tracker.quoteFee) > 0n;
  const hasBase = usableBudget(tracker.availableBase, tracker.baseFee) > 0n;
  const hasOrders = tracker.orders.length > 0;
  const hasTriggers = tracker.triggers.length > 0;
  const hasPositions = tracker.positions.length > 0;
  const orderSlots = tracker.orders.length < 50;
  const triggerSlots = tracker.triggers.length < 20;
  const positionSlots = tracker.positions.length < 10;

  // Orders
  if (hasQuote && orderSlots) available.push('create_buy_order');
  if (hasBase && orderSlots) available.push('create_sell_order');
  if (hasOrders) available.push('cancel_order');
  if (hasOrders) available.push('update_order');
  if (hasOrders && (hasQuote || hasBase) && orderSlots) available.push('replace_orders');
  if (hasOrders) available.push('convert_to_market');

  // Triggers
  if (hasQuote && triggerSlots) available.push('create_buy_trigger');
  if (hasBase && triggerSlots) available.push('create_sell_trigger');
  if (hasTriggers) available.push('cancel_trigger');
  if (hasTriggers && (hasQuote || hasBase) && triggerSlots) available.push('replace_triggers');

  // Strategy
  if (hasQuote && orderSlots && triggerSlots) available.push('bracket_buy');
  if (hasBase && orderSlots && triggerSlots) available.push('bracket_sell');
  if (hasQuote && orderSlots) available.push('grid_buy');
  if (hasBase && orderSlots) available.push('grid_sell');

  // Liquidity
  if ((hasBase || hasQuote) && positionSlots) available.push('add_liquidity');
  if (hasPositions && (hasBase || hasQuote)) available.push('increase_liquidity');
  if (hasPositions) available.push('decrease_liquidity');
  if (hasPositions) available.push('collect_fees');

  // Swaps
  if (hasQuote) available.push('swap_buy');
  if (hasBase) available.push('swap_sell');
  if (hasQuote || hasBase) available.push('routed_order');

  // Withdraw only when there's something to withdraw
  if (hasBase || hasQuote) available.push('withdraw');

  // Filter by enabled actions
  return available.filter(a => config.enabledActions.has(a));
}

// ============================================
// Action Implementations
// ============================================

type ActionFn = (
  market: SpotMarket,
  tracker: AgentTracker,
  config: AgentConfig,
  log: LogFn,
) => Promise<ActionResult>;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const actions: Record<ActionType, ActionFn> = {

  // --- Orders ---

  async create_buy_order(market, t, _config, log) {
    const tick = buyOrderTick(t.tick!);
    const amount = orderAmount('buy', t);
    log({ type: 'prompt', text: `place buy order at tick ${tick}` });
    log({ type: 'action', text: `createOrders([], [#buy ${tick} ${fmtNat(amount)}], [])` });
    const start = performance.now();
    try {
      const result = await market.createOrders([], [{ side: { buy: null }, limit_tick: tick, input_amount: amount, immediate_or_cancel: false }], []);
      const orderId = result.order_results[0] && 'ok' in result.order_results[0].result ? result.order_results[0].result.ok.order_id : '?';
      log({ type: 'success', text: `order_id: ${orderId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async create_sell_order(market, t, _config, log) {
    const tick = sellOrderTick(t.tick!);
    const amount = orderAmount('sell', t);
    log({ type: 'prompt', text: `place sell order at tick ${tick}` });
    log({ type: 'action', text: `createOrders([], [#sell ${tick} ${fmtNat(amount)}], [])` });
    const start = performance.now();
    try {
      const result = await market.createOrders([], [{ side: { sell: null }, limit_tick: tick, input_amount: amount, immediate_or_cancel: false }], []);
      const orderId = result.order_results[0] && 'ok' in result.order_results[0].result ? result.order_results[0].result.ok.order_id : '?';
      log({ type: 'success', text: `order_id: ${orderId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async cancel_order(market, t, _config, log) {
    const order = pickRandom(t.orders);
    log({ type: 'prompt', text: `cancel order #${order.id}` });
    log({ type: 'action', text: `cancelOrder(${order.id})` });
    const start = performance.now();
    try {
      await market.cancelOrder(order.id);
      log({ type: 'success', text: `cancelled order #${order.id}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async update_order(market, t, _config, log) {
    const order = pickRandom(t.orders);
    const newTick = updateOrderTick(t.tick!);
    const newAmount = orderAmount('buy' in order.side ? 'buy' : 'sell', t);
    log({ type: 'prompt', text: `update order #${order.id} → tick ${newTick}` });
    log({ type: 'action', text: `updateOrder(${order.id}, ${newTick}, ${fmtNat(newAmount)})` });
    const start = performance.now();
    try {
      const result = await market.updateOrder(order.id, newTick, newAmount);
      log({ type: 'success', text: `order_id: ${result.order_id} replaced: ${result.wasReplaced}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async replace_orders(market, t, _config, log) {
    // Cancel one random order + create a new one in single call
    const order = pickRandom(t.orders);
    const side: 'buy' | 'sell' = 'buy' in order.side ? 'buy' : 'sell';
    const newTick = side === 'buy' ? buyOrderTick(t.tick!) : sellOrderTick(t.tick!);
    const newAmount = orderAmount(side, t);
    const sideVariant = side === 'buy' ? { buy: null } : { sell: null };
    log({ type: 'prompt', text: `replace order #${order.id} with new ${side} at ${newTick}` });
    log({ type: 'action', text: `createOrders([${order.id}], [#${side} ${newTick} ${fmtNat(newAmount)}], [])` });
    const start = performance.now();
    try {
      const result = await market.createOrders(
        [order.id],
        [{ side: sideVariant, limit_tick: newTick, input_amount: newAmount, immediate_or_cancel: false }],
        []
      );
      const orderId = result.order_results[0] && 'ok' in result.order_results[0].result ? result.order_results[0].result.ok.order_id : '?';
      log({ type: 'success', text: `replaced → order_id: ${orderId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async convert_to_market(market, t, _config, log) {
    const order = pickRandom(t.orders);
    const side = 'buy' in order.side ? { buy: null } : { sell: null };
    const sideStr = 'buy' in order.side ? 'buy' : 'sell';
    log({ type: 'prompt', text: `convert order #${order.id} to market` });
    const start = performance.now();
    try {
      // Quote first to get pool_swaps + book_order
      log({ type: 'action', text: `quoteOrder(#${sideStr}, ${fmtNat(order.amount)}, ${t.tick!})` });
      const quote = await market.quoteOrder(side, order.amount, t.tick!);
      log({ type: 'result', text: `quote ready, output: ${fmtNat(quote.output_amount)}` });
      const bookOrders = quote.book_order.length > 0
        ? [{ ...quote.book_order[0]!, immediate_or_cancel: true }]
        : [];
      log({ type: 'action', text: `createOrders([${order.id}], bookOrders, poolSwaps)` });
      const result = await market.createOrders([order.id], bookOrders, quote.pool_swaps);
      log({ type: 'success', text: `executed (cancelled #${order.id})`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  // --- Triggers ---

  async create_buy_trigger(market, t, _config, log) {
    const { triggerTick, limitTick } = buyTriggerTicks(t.tick!);
    const amount = triggerAmount('buy', t);
    log({ type: 'prompt', text: `create buy trigger at ${triggerTick} → limit ${limitTick}` });
    log({ type: 'action', text: `createTriggers([], [#buy ${triggerTick} ${fmtNat(amount)} ${limitTick}])` });
    const start = performance.now();
    try {
      const result = await market.createTriggers([], [{ side: { buy: null }, trigger_tick: triggerTick, input_amount: amount, limit_tick: limitTick, immediate_or_cancel: false, reference_tick: t.tick! }]);
      const triggerId = result.results[0] && 'ok' in result.results[0].result ? result.results[0].result.ok.trigger_id : '?';
      log({ type: 'success', text: `trigger_id: ${triggerId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async create_sell_trigger(market, t, _config, log) {
    const { triggerTick, limitTick } = sellTriggerTicks(t.tick!);
    const amount = triggerAmount('sell', t);
    log({ type: 'prompt', text: `create sell trigger at ${triggerTick} → limit ${limitTick}` });
    log({ type: 'action', text: `createTriggers([], [#sell ${triggerTick} ${fmtNat(amount)} ${limitTick}])` });
    const start = performance.now();
    try {
      const result = await market.createTriggers([], [{ side: { sell: null }, trigger_tick: triggerTick, input_amount: amount, limit_tick: limitTick, immediate_or_cancel: false, reference_tick: t.tick! }]);
      const triggerId = result.results[0] && 'ok' in result.results[0].result ? result.results[0].result.ok.trigger_id : '?';
      log({ type: 'success', text: `trigger_id: ${triggerId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async cancel_trigger(market, t, _config, log) {
    const trigger = pickRandom(t.triggers);
    log({ type: 'prompt', text: `cancel trigger #${trigger.id}` });
    log({ type: 'action', text: `cancelTrigger(${trigger.id})` });
    const start = performance.now();
    try {
      await market.cancelTrigger(trigger.id);
      log({ type: 'success', text: `cancelled trigger #${trigger.id}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async replace_triggers(market, t, _config, log) {
    const trigger = pickRandom(t.triggers);
    const side: 'buy' | 'sell' = 'buy' in trigger.side ? 'buy' : 'sell';
    const ticks = side === 'buy' ? buyTriggerTicks(t.tick!) : sellTriggerTicks(t.tick!);
    const amount = triggerAmount(side, t);
    const sideVariant = side === 'buy' ? { buy: null } : { sell: null };
    log({ type: 'prompt', text: `replace trigger #${trigger.id}` });
    log({ type: 'action', text: `createTriggers([${trigger.id}], [#${side} ${ticks.triggerTick} ${fmtNat(amount)} ${ticks.limitTick}])` });
    const start = performance.now();
    try {
      const result = await market.createTriggers([trigger.id], [{ side: sideVariant, trigger_tick: ticks.triggerTick, input_amount: amount, limit_tick: ticks.limitTick, immediate_or_cancel: false, reference_tick: t.tick! }]);
      const triggerId = result.results[0] && 'ok' in result.results[0].result ? result.results[0].result.ok.trigger_id : '?';
      log({ type: 'success', text: `new trigger_id: ${triggerId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  // --- Strategy ---

  async bracket_buy(market, t, _config, log) {
    const { orderTick, triggerTick, limitTick } = bracketBuy(t.tick!);
    const amount = orderAmount('buy', t);
    const trigAmt = triggerAmount('sell', t);
    log({ type: 'prompt', text: `bracket buy: order at ${orderTick} + stop-loss at ${triggerTick}` });
    const start = performance.now();
    try {
      log({ type: 'action', text: `createOrders([], [#buy ${orderTick} ${fmtNat(amount)}], [])` });
      const orderResult = await market.createOrders([], [{ side: { buy: null }, limit_tick: orderTick, input_amount: amount, immediate_or_cancel: false }], []);
      const orderId = orderResult.order_results[0] && 'ok' in orderResult.order_results[0].result ? orderResult.order_results[0].result.ok.order_id : '?';
      log({ type: 'result', text: `order_id: ${orderId}` });
      log({ type: 'action', text: `createTriggers([], [#sell ${triggerTick} ${fmtNat(trigAmt)} ${limitTick}])` });
      const trigResult = await market.createTriggers([], [{ side: { sell: null }, trigger_tick: triggerTick, input_amount: trigAmt, limit_tick: limitTick, immediate_or_cancel: false, reference_tick: t.tick! }]);
      const trigId = trigResult.results[0] && 'ok' in trigResult.results[0].result ? trigResult.results[0].result.ok.trigger_id : '?';
      log({ type: 'success', text: `bracket done  order: ${orderId}  trigger: ${trigId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async bracket_sell(market, t, _config, log) {
    const { orderTick, triggerTick, limitTick } = bracketSell(t.tick!);
    const amount = orderAmount('sell', t);
    const trigAmt = triggerAmount('buy', t);
    log({ type: 'prompt', text: `bracket sell: order at ${orderTick} + stop-buy at ${triggerTick}` });
    const start = performance.now();
    try {
      log({ type: 'action', text: `createOrders([], [#sell ${orderTick} ${fmtNat(amount)}], [])` });
      const orderResult = await market.createOrders([], [{ side: { sell: null }, limit_tick: orderTick, input_amount: amount, immediate_or_cancel: false }], []);
      const orderId = orderResult.order_results[0] && 'ok' in orderResult.order_results[0].result ? orderResult.order_results[0].result.ok.order_id : '?';
      log({ type: 'result', text: `order_id: ${orderId}` });
      log({ type: 'action', text: `createTriggers([], [#buy ${triggerTick} ${fmtNat(trigAmt)} ${limitTick}])` });
      const trigResult = await market.createTriggers([], [{ side: { buy: null }, trigger_tick: triggerTick, input_amount: trigAmt, limit_tick: limitTick, immediate_or_cancel: false, reference_tick: t.tick! }]);
      const trigId = trigResult.results[0] && 'ok' in trigResult.results[0].result ? trigResult.results[0].result.ok.trigger_id : '?';
      log({ type: 'success', text: `bracket done  order: ${orderId}  trigger: ${trigId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async grid_buy(market, t, _config, log) {
    const count = Math.floor(Math.random() * 3) + 3;
    const ticks = gridTicks(t.tick!, 'buy', count);
    log({ type: 'prompt', text: `grid buy: ${count} orders below market` });
    const start = performance.now();
    try {
      // Build all book orders and submit in single batch
      const bookOrders = ticks.map(tick => ({
        side: { buy: null } as const,
        limit_tick: tick,
        input_amount: orderAmount('buy', t),
        immediate_or_cancel: false,
      }));
      log({ type: 'action', text: `createOrders([], ${count} buy orders, [])` });
      const result = await market.createOrders([], bookOrders, []);
      const ids = result.order_results
        .filter(r => 'ok' in r.result)
        .map(r => ('ok' in r.result ? r.result.ok.order_id : 0n));
      log({ type: 'success', text: `grid placed [${ids.join(', ')}]`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async grid_sell(market, t, _config, log) {
    const count = Math.floor(Math.random() * 3) + 3;
    const ticks = gridTicks(t.tick!, 'sell', count);
    log({ type: 'prompt', text: `grid sell: ${count} orders above market` });
    const start = performance.now();
    try {
      // Build all book orders and submit in single batch
      const bookOrders = ticks.map(tick => ({
        side: { sell: null } as const,
        limit_tick: tick,
        input_amount: orderAmount('sell', t),
        immediate_or_cancel: false,
      }));
      log({ type: 'action', text: `createOrders([], ${count} sell orders, [])` });
      const result = await market.createOrders([], bookOrders, []);
      const ids = result.order_results
        .filter(r => 'ok' in r.result)
        .map(r => ('ok' in r.result ? r.result.ok.order_id : 0n));
      log({ type: 'success', text: `grid placed [${ids.join(', ')}]`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  // --- Liquidity ---

  async add_liquidity(_market, t, _config, log) {
    const range = liquidityRange(t.tick!, t.feePips);
    const amounts = liquidityAmounts(t);
    log({ type: 'prompt', text: `add liquidity [${range.tickLower}, ${range.tickUpper}]` });
    log({ type: 'action', text: `addSpotLiquidity(${t.feePips}, ${range.tickLower}, ${range.tickUpper}, ${fmtNat(amounts.amount0)}, ${fmtNat(amounts.amount1)})` });
    const start = performance.now();
    try {
      const result = await marketRepository.addSpotLiquidity(
        t.canisterId, t.feePips, range.tickLower, range.tickUpper,
        amounts.amount0, amounts.amount1,
      );
      if ('ok' in result) {
        log({ type: 'success', text: `position_id: ${result.ok.position_id}`, durationMs: performance.now() - start });
        return { success: true };
      }
      const err = typeof result.err === 'string' ? result.err : JSON.stringify(result.err);
      log({ type: 'error', text: err, durationMs: performance.now() - start });
      return { success: false, error: err };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async increase_liquidity(_market, t, _config, log) {
    const pos = pickRandom(t.positions);
    const amounts = liquidityAmounts(t);
    log({ type: 'prompt', text: `increase liquidity on position #${pos.position_id}` });
    log({ type: 'action', text: `increaseSpotLiquidity(${pos.position_id}, ${fmtNat(amounts.amount0)}, ${fmtNat(amounts.amount1)})` });
    const start = performance.now();
    try {
      const result = await marketRepository.increaseSpotLiquidity(
        t.canisterId, pos.position_id, amounts.amount0, amounts.amount1,
      );
      if ('ok' in result) {
        log({ type: 'success', text: `liquidity increased on #${pos.position_id}`, durationMs: performance.now() - start });
        return { success: true };
      }
      const err = typeof result.err === 'string' ? result.err : JSON.stringify(result.err);
      log({ type: 'error', text: err, durationMs: performance.now() - start });
      return { success: false, error: err };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async decrease_liquidity(_market, t, _config, log) {
    const pos = pickRandom(t.positions);
    // Remove 10-80% of liquidity
    const pct = 0.1 + Math.random() * 0.7;
    const delta = BigInt(Math.floor(Number(pos.liquidity) * pct));
    log({ type: 'prompt', text: `decrease liquidity on position #${pos.position_id} by ${(pct * 100).toFixed(0)}%` });
    log({ type: 'action', text: `decreaseSpotLiquidity(${pos.position_id}, ${fmtNat(delta)})` });
    const start = performance.now();
    try {
      const result = await marketRepository.decreaseSpotLiquidity(t.canisterId, pos.position_id, delta);
      if ('ok' in result) {
        log({ type: 'success', text: `removed ${fmtNat(result.ok.amount0)} base + ${fmtNat(result.ok.amount1)} quote`, durationMs: performance.now() - start });
        return { success: true };
      }
      const err = typeof result.err === 'string' ? result.err : JSON.stringify(result.err);
      log({ type: 'error', text: err, durationMs: performance.now() - start });
      return { success: false, error: err };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async collect_fees(_market, t, _config, log) {
    const pos = pickRandom(t.positions);
    log({ type: 'prompt', text: `collect fees from position #${pos.position_id}` });
    log({ type: 'action', text: `collectSpotFees(${pos.position_id})` });
    const start = performance.now();
    try {
      const result = await marketRepository.collectSpotFees(t.canisterId, pos.position_id);
      if ('ok' in result) {
        log({ type: 'success', text: `collected fees on #${pos.position_id}`, durationMs: performance.now() - start });
        return { success: true };
      }
      const err = typeof result.err === 'string' ? result.err : JSON.stringify(result.err);
      log({ type: 'error', text: err, durationMs: performance.now() - start });
      return { success: false, error: err };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  // --- Swaps ---

  async swap_buy(market, t, _config, log) {
    const amount = swapAmount('buy', t);
    const limitTick = t.tick! + 500;
    log({ type: 'prompt', text: `swap buy ${fmtNat(amount)} quote` });
    const start = performance.now();
    try {
      log({ type: 'action', text: `quoteOrder(#buy, ${fmtNat(amount)}, ${limitTick})` });
      const quote = await market.quoteOrder({ buy: null }, amount, limitTick);
      log({ type: 'result', text: `output: ${fmtNat(quote.output_amount)}  impact: ${quote.price_impact_bps}bps` });
      const bookOrders = quote.book_order.length > 0
        ? [{ ...quote.book_order[0]!, immediate_or_cancel: true }]
        : [];
      log({ type: 'action', text: `createOrders([], bookOrders, poolSwaps)` });
      const result = await market.createOrders([], bookOrders, quote.pool_swaps);
      const orderId = result.order_results[0] && 'ok' in result.order_results[0].result ? result.order_results[0].result.ok.order_id : '?';
      log({ type: 'success', text: `filled order_id: ${orderId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async swap_sell(market, t, _config, log) {
    const amount = swapAmount('sell', t);
    const limitTick = t.tick! - 500;
    log({ type: 'prompt', text: `swap sell ${fmtNat(amount)} base` });
    const start = performance.now();
    try {
      log({ type: 'action', text: `quoteOrder(#sell, ${fmtNat(amount)}, ${limitTick})` });
      const quote = await market.quoteOrder({ sell: null }, amount, limitTick);
      log({ type: 'result', text: `output: ${fmtNat(quote.output_amount)}  impact: ${quote.price_impact_bps}bps` });
      const bookOrders = quote.book_order.length > 0
        ? [{ ...quote.book_order[0]!, immediate_or_cancel: true }]
        : [];
      log({ type: 'action', text: `createOrders([], bookOrders, poolSwaps)` });
      const result = await market.createOrders([], bookOrders, quote.pool_swaps);
      const orderId = result.order_results[0] && 'ok' in result.order_results[0].result ? result.order_results[0].result.ok.order_id : '?';
      log({ type: 'success', text: `filled order_id: ${orderId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async routed_order(market, t, _config, log) {
    const isBuy = Math.random() > 0.5;
    const side = isBuy ? 'buy' : 'sell';
    const sideVariant = isBuy ? { buy: null } : { sell: null };
    const amount = orderAmount(side, t);
    const tick = isBuy ? buyOrderTick(t.tick!) : sellOrderTick(t.tick!);
    log({ type: 'prompt', text: `routed ${side} order at ${tick}` });
    const start = performance.now();
    try {
      log({ type: 'action', text: `quoteOrder(#${side}, ${fmtNat(amount)}, ${tick})` });
      const quote = await market.quoteOrder(sideVariant, amount, tick);
      log({ type: 'result', text: `quote ready  output: ${fmtNat(quote.output_amount)}` });
      // GTC limit order: use book_order from quote (with IOC=false) + pool_swaps
      const bookOrders = quote.book_order.length > 0
        ? [{ ...quote.book_order[0]!, immediate_or_cancel: false }]
        : [];
      log({ type: 'action', text: `createOrders([], bookOrders, poolSwaps)` });
      const result = await market.createOrders([], bookOrders, quote.pool_swaps);
      const orderId = result.order_results[0] && 'ok' in result.order_results[0].result ? result.order_results[0].result.ok.order_id : '?';
      log({ type: 'success', text: `order_id: ${orderId}`, durationMs: performance.now() - start });
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  // --- Deposit / Withdraw ---

  async deposit(market, t, _config, log) {
    // Deposit both base and quote if low
    const minBase = 10n ** BigInt(t.baseDecimals) * 100n; // ~100 units
    const minQuote = 10n ** BigInt(t.quoteDecimals) * 100n;
    const start = performance.now();
    try {
      if (t.availableBase < minBase) {
        const amount = depositAmount('base', t);
        log({ type: 'prompt', text: `deposit base (low balance)` });
        log({ type: 'action', text: `deposit(#base, ${fmtNat(amount)})` });
        await market.deposit({ base: null }, amount);
        log({ type: 'success', text: `deposited base`, durationMs: performance.now() - start });
      }
      if (t.availableQuote < minQuote) {
        const amount = depositAmount('quote', t);
        log({ type: 'prompt', text: `deposit quote (low balance)` });
        log({ type: 'action', text: `deposit(#quote, ${fmtNat(amount)})` });
        await market.deposit({ quote: null }, amount);
        log({ type: 'success', text: `deposited quote`, durationMs: performance.now() - start });
      }
      if (t.availableBase >= minBase && t.availableQuote >= minQuote) {
        log({ type: 'info', text: `balances sufficient, skipping deposit` });
      }
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },

  async withdraw(market, t, _config, log) {
    // Withdraw a small percentage of available balance
    const pct = 0.05 + Math.random() * 0.15;
    const start = performance.now();
    try {
      if (t.availableBase > 0n) {
        const amount = BigInt(Math.floor(Number(t.availableBase) * pct));
        if (amount > t.baseFee * 10n) {
          log({ type: 'prompt', text: `withdraw ${(pct * 100).toFixed(0)}% base` });
          log({ type: 'action', text: `withdraw(#base, ${fmtNat(amount)})` });
          await market.withdraw({ base: null }, amount);
          log({ type: 'success', text: `withdrawn base`, durationMs: performance.now() - start });
        }
      }
      return { success: true };
    } catch (e: any) {
      log({ type: 'error', text: e.message, durationMs: performance.now() - start });
      return { success: false, error: e.message };
    }
  },
};

export function getActionFn(action: ActionType): ActionFn {
  return actions[action];
}

/**
 * Auto-deposit base and/or quote when trading balance is insufficient.
 * Called reactively by the engine on INSUFFICIENT_BALANCE errors.
 * Returns true if any deposit was made.
 */
export async function autoDeposit(
  market: SpotMarket,
  tracker: AgentTracker,
  log: LogFn,
): Promise<boolean> {
  let deposited = false;
  const start = performance.now();
  const baseLedger = market.tokens?.[0]?.toString();
  const quoteLedger = market.tokens?.[1]?.toString();
  const spender = market.canister_id;

  try {
    if (baseLedger) {
      log({ type: 'action', text: `checking ICRC-2 approval for base token...` });
      await checkAndApprove(baseLedger, spender);
    }
    const baseAmt = depositAmount('base', tracker);
    log({ type: 'action', text: `deposit(#base, ${fmtNat(baseAmt)})` });
    await market.deposit({ base: null }, baseAmt);
    log({ type: 'success', text: `deposited base`, durationMs: performance.now() - start });
    deposited = true;
  } catch (e: any) {
    log({ type: 'error', text: `base deposit failed: ${e.message}`, durationMs: performance.now() - start });
  }
  try {
    if (quoteLedger) {
      log({ type: 'action', text: `checking ICRC-2 approval for quote token...` });
      await checkAndApprove(quoteLedger, spender);
    }
    const quoteAmt = depositAmount('quote', tracker);
    log({ type: 'action', text: `deposit(#quote, ${fmtNat(quoteAmt)})` });
    await market.deposit({ quote: null }, quoteAmt);
    log({ type: 'success', text: `deposited quote`, durationMs: performance.now() - start });
    deposited = true;
  } catch (e: any) {
    log({ type: 'error', text: `quote deposit failed: ${e.message}`, durationMs: performance.now() - start });
  }
  return deposited;
}
