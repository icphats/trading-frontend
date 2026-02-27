/**
 * Column Presets for Trading Tables
 *
 * Provides standardized column configurations for consistent table layouts.
 * Use these presets with HeaderCell and TableCell components via spread syntax.
 *
 * IMPORTANT: Always use the same preset for both HeaderCell and TableCell
 * to ensure alignment stays in sync.
 *
 * @example
 * ```svelte
 * <HeaderCell {...columns.side} compact>Side</HeaderCell>
 * <TableCell {...columns.side} compact><SideBadge side={order.side} /></TableCell>
 * ```
 */

type Alignment = 'left' | 'center' | 'right';

interface ColumnPreset {
  /** Column width in pixels */
  width?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Whether column should grow to fill available space */
  grow?: boolean;
  /** Content alignment */
  align: Alignment;
}

// ============================================================================
// Base Column Definitions (private - use table-specific configs below)
// ============================================================================

const baseColumns = {
  // Categorical columns (centered, badge styling)
  side: { width: 60, align: 'center' as Alignment },
  type: { width: 85, align: 'center' as Alignment },
  status: { width: 80, align: 'center' as Alignment },

  // Numeric columns (right-aligned)
  amount: { width: 100, align: 'right' as Alignment },
  price: { width: 90, align: 'right' as Alignment },
  triggerPrice: { width: 90, align: 'right' as Alignment },
  limitPrice: { width: 90, align: 'right' as Alignment },
  percentage: { width: 80, align: 'right' as Alignment },
  usd: { width: 90, align: 'right' as Alignment },
  output: { width: 90, align: 'right' as Alignment },
  time: { width: 140, align: 'right' as Alignment },
  tokenAmount: { minWidth: 100, align: 'right' as Alignment },
} as const satisfies Record<string, ColumnPreset>;

// ============================================================================
// Table-Specific Column Configurations
// ============================================================================

/**
 * SpotOpenOrders table columns
 * Layout: Type(Side) | Price | Amount | Filled | Time(grow)
 */
export const openOrderColumns = {
  type: baseColumns.side,  // 'type' column displays SideBadge
  price: baseColumns.price,
  amount: baseColumns.amount,
  filled: baseColumns.percentage,
  time: { ...baseColumns.time, grow: true },
} as const satisfies Record<string, ColumnPreset>;

/**
 * SpotTriggers table columns
 * Layout: Trigger(TP/SL) | Type(Side) | TriggerPrice | LimitPrice | Amount | Status(grow)
 */
export const triggerColumns = {
  trigger: baseColumns.type,       // 'trigger' column displays TypeBadge (TP/SL)
  type: baseColumns.side,          // 'type' column displays SideBadge (Buy/Sell)
  triggerPrice: baseColumns.triggerPrice,
  limitPrice: baseColumns.limitPrice,
  amount: baseColumns.amount,
  status: { ...baseColumns.status, grow: true },
} as const satisfies Record<string, ColumnPreset>;

/**
 * SpotTransactions table columns
 * Layout: Side(grow) | Price(grow) | Token0(grow) | Token1(grow) | USD(grow) | Time(grow)
 * All columns grow equally for fluid layout
 */
export const transactionColumns = {
  side: { ...baseColumns.side, grow: true },
  price: { ...baseColumns.price, grow: true },
  token0: { ...baseColumns.tokenAmount, grow: true },
  token1: { ...baseColumns.tokenAmount, grow: true },
  usd: { ...baseColumns.usd, grow: true },
  time: { ...baseColumns.time, grow: true },
} as const satisfies Record<string, ColumnPreset>;

export type ColumnType = keyof typeof baseColumns;
