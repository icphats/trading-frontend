/**
 * Agent Auto-Trader Types
 *
 * Action enum, configuration, log entries, and default weights
 * for the random-walk auto-trader engine.
 */

// ============================================
// Action Types
// ============================================

export type ActionType =
  | 'create_buy_order'
  | 'create_sell_order'
  | 'cancel_order'
  | 'update_order'
  | 'replace_orders'
  | 'convert_to_market'
  | 'create_buy_trigger'
  | 'create_sell_trigger'
  | 'cancel_trigger'
  | 'replace_triggers'
  | 'bracket_buy'
  | 'bracket_sell'
  | 'grid_buy'
  | 'grid_sell'
  | 'add_liquidity'
  | 'increase_liquidity'
  | 'decrease_liquidity'
  | 'collect_fees'
  | 'swap_buy'
  | 'swap_sell'
  | 'routed_order'
  | 'deposit'
  | 'withdraw';

export const ALL_ACTIONS: ActionType[] = [
  'create_buy_order',
  'create_sell_order',
  'cancel_order',
  'update_order',
  'replace_orders',
  'convert_to_market',
  'create_buy_trigger',
  'create_sell_trigger',
  'cancel_trigger',
  'replace_triggers',
  'bracket_buy',
  'bracket_sell',
  'grid_buy',
  'grid_sell',
  'add_liquidity',
  'increase_liquidity',
  'decrease_liquidity',
  'collect_fees',
  'swap_buy',
  'swap_sell',
  'routed_order',
  'deposit',
  'withdraw',
];

export type ActionCategory = 'order' | 'trigger' | 'strategy' | 'liquidity' | 'swap';

export interface ActionMeta {
  id: ActionType;
  category: ActionCategory;
  label: string;
}

export const ACTION_META: Record<ActionType, ActionMeta> = {
  create_buy_order:   { id: 'create_buy_order',   category: 'order',     label: 'Create Buy Order' },
  create_sell_order:  { id: 'create_sell_order',  category: 'order',     label: 'Create Sell Order' },
  cancel_order:       { id: 'cancel_order',       category: 'order',     label: 'Cancel Order' },
  update_order:       { id: 'update_order',       category: 'order',     label: 'Update Order' },
  replace_orders:     { id: 'replace_orders',     category: 'order',     label: 'Replace Orders' },
  convert_to_market:  { id: 'convert_to_market',  category: 'order',     label: 'Convert to Market' },
  create_buy_trigger: { id: 'create_buy_trigger', category: 'trigger',   label: 'Create Buy Trigger' },
  create_sell_trigger:{ id: 'create_sell_trigger',category: 'trigger',   label: 'Create Sell Trigger' },
  cancel_trigger:     { id: 'cancel_trigger',     category: 'trigger',   label: 'Cancel Trigger' },
  replace_triggers:   { id: 'replace_triggers',   category: 'trigger',   label: 'Replace Trigger' },
  bracket_buy:        { id: 'bracket_buy',        category: 'strategy',  label: 'Bracket Buy' },
  bracket_sell:       { id: 'bracket_sell',       category: 'strategy',  label: 'Bracket Sell' },
  grid_buy:           { id: 'grid_buy',           category: 'strategy',  label: 'Grid Buy' },
  grid_sell:          { id: 'grid_sell',          category: 'strategy',  label: 'Grid Sell' },
  add_liquidity:      { id: 'add_liquidity',      category: 'liquidity', label: 'Add Liquidity' },
  increase_liquidity: { id: 'increase_liquidity', category: 'liquidity', label: 'Increase Liquidity' },
  decrease_liquidity: { id: 'decrease_liquidity', category: 'liquidity', label: 'Decrease Liquidity' },
  collect_fees:       { id: 'collect_fees',       category: 'liquidity', label: 'Collect Fees' },
  swap_buy:           { id: 'swap_buy',           category: 'swap',      label: 'Swap Buy' },
  swap_sell:          { id: 'swap_sell',          category: 'swap',      label: 'Swap Sell' },
  routed_order:       { id: 'routed_order',       category: 'swap',      label: 'Routed Order' },
  deposit:            { id: 'deposit',            category: 'swap',      label: 'Deposit' },
  withdraw:           { id: 'withdraw',           category: 'swap',      label: 'Withdraw' },
};

export const CATEGORIES: ActionCategory[] = ['order', 'trigger', 'strategy', 'liquidity', 'swap'];

// ============================================
// Default Weights (from test-harness)
// ============================================

export const DEFAULT_WEIGHTS: Record<ActionType, number> = {
  create_buy_order: 15,
  create_sell_order: 15,
  cancel_order: 8,
  update_order: 4,
  replace_orders: 10,
  convert_to_market: 3,
  create_buy_trigger: 8,
  create_sell_trigger: 8,
  cancel_trigger: 5,
  replace_triggers: 5,
  bracket_buy: 6,
  bracket_sell: 6,
  grid_buy: 10,
  grid_sell: 10,
  add_liquidity: 6,
  increase_liquidity: 4,
  decrease_liquidity: 4,
  collect_fees: 3,
  swap_buy: 6,
  swap_sell: 15,
  routed_order: 15,
  deposit: 0,
  withdraw: 0,
};

// ============================================
// Configuration
// ============================================

export interface AgentConfig {
  marketId: string;
  delayMs: number;
  jitterMs: number;
  weights: Record<ActionType, number>;
  enabledActions: Set<ActionType>;
  amountRangeUsd: [number, number];
  autoDeposit: boolean;
  dryRun: boolean;
}

export function defaultConfig(): AgentConfig {
  return {
    marketId: '',
    delayMs: 3000,
    jitterMs: 1000,
    weights: { ...DEFAULT_WEIGHTS },
    enabledActions: new Set(ALL_ACTIONS),
    amountRangeUsd: [20, 200],
    autoDeposit: true,
    dryRun: false,
  };
}

// ============================================
// Log Entries
// ============================================

export type LogType = 'prompt' | 'action' | 'result' | 'success' | 'error' | 'info';

export interface AgentLogEntry {
  id: number;
  timestamp: number;
  type: LogType;
  text: string;
  actionType?: ActionType;
  durationMs?: number;
}

// ============================================
// Tracker (snapshot of market state for decisions)
// ============================================

export interface AgentTracker {
  tick: number | null;
  availableBase: bigint;
  availableQuote: bigint;
  orders: { id: bigint; side: { buy: null } | { sell: null }; tick: number; amount: bigint }[];
  triggers: { id: bigint; side: { buy: null } | { sell: null }; trigger_tick: number; limit_tick: number; amount: bigint }[];
  positions: { position_id: bigint; tick_lower: number; tick_upper: number; liquidity: bigint }[];
  baseDecimals: number;
  quoteDecimals: number;
  baseFee: bigint;
  quoteFee: bigint;
  feePips: number;
  tickSpacing: number;
  canisterId: string;
  symbol: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

// ============================================
// Weighted Random Selection
// ============================================

export function weightedRandom(
  available: ActionType[],
  weights: Record<ActionType, number>,
): ActionType {
  let total = 0;
  for (const a of available) total += weights[a];
  if (total === 0) return available[Math.floor(Math.random() * available.length)];

  let r = Math.random() * total;
  for (const a of available) {
    r -= weights[a];
    if (r <= 0) return a;
  }
  return available[available.length - 1];
}
