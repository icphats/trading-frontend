/**
 * Agent Engine
 *
 * Reactive agent loop that reads from SpotMarket's existing state,
 * picks weighted-random actions, and executes them.
 * No separate polling — reads from entityStore via SpotMarket getters.
 */

import type { SpotMarket } from '$lib/domain/markets/state/spot-market.svelte';
import { entityStore } from '$lib/domain/orchestration/entity-store.svelte';
import {
  type AgentConfig, type AgentLogEntry, type AgentTracker,
  type ActionType, defaultConfig, weightedRandom,
} from './agent.types';
import { getAvailableActions, getActionFn, autoDeposit } from './agent-primitives';

const MAX_LOG = 200;

class AgentEngine {
  status = $state<'idle' | 'running' | 'paused' | 'stopping'>('idle');
  log = $state<AgentLogEntry[]>([]);
  config = $state<AgentConfig>(defaultConfig());
  tickCount = $state(0);
  errorCount = $state(0);
  lastAction = $state<string>('');

  isRunning = $derived(this.status === 'running');

  private market: SpotMarket | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private logIdCounter = 0;

  start(market: SpotMarket) {
    if (this.status === 'running') return;
    this.market = market;
    this.config.marketId = market.canister_id;
    this.status = 'running';
    this.pushLog({ type: 'info', text: `agent started on ${market.token_symbol}` });
    this.scheduleTick();
  }

  pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.pushLog({ type: 'info', text: 'agent paused' });
  }

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.pushLog({ type: 'info', text: 'agent resumed' });
    this.scheduleTick();
  }

  stop() {
    this.status = 'stopping';
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.pushLog({ type: 'info', text: 'agent stopped' });
    this.status = 'idle';
    this.market = null;
  }

  clearLog() {
    this.log = [];
    this.logIdCounter = 0;
  }

  pushLog(entry: Omit<AgentLogEntry, 'id' | 'timestamp'>) {
    const full: AgentLogEntry = {
      ...entry,
      id: this.logIdCounter++,
      timestamp: Date.now(),
    };
    this.log = [...this.log.slice(-(MAX_LOG - 1)), full];
  }

  private scheduleTick() {
    if (this.status !== 'running') return;
    const jitter = Math.random() * this.config.jitterMs;
    const delay = this.config.delayMs + jitter;
    this.loopTimer = setTimeout(() => this.tick(), delay);
  }

  private async tick() {
    if (this.status !== 'running' || !this.market) return;

    try {
      // Build tracker from market's reactive state
      const tracker = this.buildTracker(this.market);

      // Get available actions
      const available = getAvailableActions(tracker, this.config);

      if (available.length === 0) {
        // Cold start: no trading balance at all — seed with initial deposit
        if (this.config.autoDeposit && tracker.availableBase === 0n && tracker.availableQuote === 0n) {
          this.pushLog({ type: 'info', text: 'no trading balance — performing initial deposit...' });
          const logFn = (entry: Omit<AgentLogEntry, 'id' | 'timestamp'>) =>
            this.pushLog({ ...entry, actionType: 'deposit' });
          await autoDeposit(this.market, tracker, logFn);
          this.scheduleTick();
          return;
        }
        this.pushLog({ type: 'info', text: 'no available actions (insufficient balance/entities)' });
        this.scheduleTick();
        return;
      }

      // Weighted random pick
      const action = weightedRandom(available, this.config.weights);
      this.lastAction = action;
      this.tickCount++;

      if (this.config.dryRun) {
        this.pushLog({ type: 'info', text: `[DRY RUN] would execute: ${action}`, actionType: action });
        this.scheduleTick();
        return;
      }

      // Execute
      const fn = getActionFn(action);
      const logFn = (entry: Omit<AgentLogEntry, 'id' | 'timestamp'>) =>
        this.pushLog({ ...entry, actionType: action });
      const result = await fn(this.market, tracker, this.config, logFn);

      // Auto-deposit on insufficient balance, then retry
      if (!result.success && result.error?.includes('INSUFFICIENT_BALANCE') && this.config.autoDeposit) {
        this.pushLog({ type: 'info', text: `insufficient balance — auto-depositing...`, actionType: action });
        const deposited = await autoDeposit(this.market, tracker, logFn);
        if (deposited) {
          this.pushLog({ type: 'info', text: `retrying ${action}...`, actionType: action });
          const freshTracker = this.buildTracker(this.market);
          const retry = await fn(this.market, freshTracker, this.config, logFn);
          if (!retry.success) this.errorCount++;
        } else {
          this.errorCount++;
        }
      } else if (!result.success) {
        this.errorCount++;
      }
    } catch (e: any) {
      this.errorCount++;
      this.pushLog({ type: 'error', text: `tick error: ${e.message}` });
    }

    this.scheduleTick();
  }

  private buildTracker(market: SpotMarket): AgentTracker {
    const baseToken = market.tokens?.[0]?.toString() ?? '';
    const quoteToken = market.tokens?.[1]?.toString() ?? '';
    const baseTokenData = entityStore.getToken(baseToken);
    const quoteTokenData = entityStore.getToken(quoteToken);

    // Map orders to simplified format
    // OrderView has base_amount/quote_amount — input depends on side
    const orders = market.userOrders.map(o => ({
      id: o.order_id,
      side: o.side,
      tick: o.tick,
      amount: 'buy' in o.side ? o.quote_amount : o.base_amount,
    }));

    // Map triggers
    const triggers = market.userTriggers.map(tr => ({
      id: tr.trigger_id,
      side: tr.side,
      trigger_tick: tr.trigger_tick,
      limit_tick: tr.limit_tick,
      amount: tr.input_amount,
    }));

    // Map positions
    const positions = market.userPositions.map(p => ({
      position_id: p.position_id,
      tick_lower: p.tick_lower,
      tick_upper: p.tick_upper,
      liquidity: p.liquidity,
    }));

    return {
      tick: market.lastTradeTick,
      availableBase: market.availableBase,
      availableQuote: market.availableQuote,
      orders,
      triggers,
      positions,
      baseDecimals: market.baseTokenDecimals,
      quoteDecimals: market.quoteTokenDecimals,
      baseFee: baseTokenData?.fee ?? 10_000n,
      quoteFee: quoteTokenData?.fee ?? 10_000n,
      feePips: market.fee,
      tickSpacing: market.tickSpacing,
      canisterId: market.canister_id,
      symbol: market.token_symbol,
    };
  }

  // Kill switches
  async cancelAllOrders() {
    if (!this.market) return;
    const orders = this.market.userOrders;
    this.pushLog({ type: 'info', text: `cancelling ${orders.length} orders...` });
    for (const order of orders) {
      try {
        await this.market.cancelOrder(order.order_id);
        this.pushLog({ type: 'success', text: `cancelled order #${order.order_id}` });
      } catch (e: any) {
        this.pushLog({ type: 'error', text: `failed to cancel #${order.order_id}: ${e.message}` });
      }
    }
  }

  async cancelAllTriggers() {
    if (!this.market) return;
    const triggers = this.market.userTriggers;
    this.pushLog({ type: 'info', text: `cancelling ${triggers.length} triggers...` });
    for (const trigger of triggers) {
      try {
        await this.market.cancelTrigger(trigger.trigger_id);
        this.pushLog({ type: 'success', text: `cancelled trigger #${trigger.trigger_id}` });
      } catch (e: any) {
        this.pushLog({ type: 'error', text: `failed to cancel trigger #${trigger.trigger_id}: ${e.message}` });
      }
    }
  }
}

export const agentEngine = new AgentEngine();
