/**
 * Grid Column Presets for Trading Tables
 *
 * Defines grid-template-columns values for each table type.
 * All columns have fixed or fractional widths - no content-based sizing.
 *
 * Column width guidelines:
 * - ID: 70px fixed
 * - Badges (Side, Type, Status): 60-80px fixed
 * - Prices: minmax(100px, 1fr)
 * - Token amounts: minmax(120px, 1fr)
 * - Timestamps: 110px fixed
 * - Market pair: 90px fixed
 * - Percentages: 70px fixed
 * - Actions: 90-150px fixed
 */

export const gridPresets = {
  /**
   * SpotTransactions - Recent trades
   * Columns: Time | Side | Price | Base | Quote | USD
   * 4 flexible columns (Price, Base, Quote, USD)
   */
  transactions: "60px 60px 1fr 1fr 1fr 1fr",

  /**
   * SpotOpenOrders - Active limit orders (single market)
   * Columns: Date | ID | Side | Price | Amount | Output | Actions
   */
  openOrders: "110px 70px 60px minmax(100px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 150px",

  /**
   * SpotTriggers - Active triggers (single market)
   * Columns: Date | ID | Type | Side | Trigger | Amount | Limit | Actions
   */
  triggers: "110px 70px 70px 60px minmax(100px, 1fr) minmax(120px, 1fr) minmax(100px, 1fr) 90px",

  /**
   * SpotActivity - Unified activity feed
   * Columns: Time | Type | Description | Amount | Value
   * 2 flexible columns (Description, Amount)
   */
  activity: "80px 90px 1fr 1fr 80px",

  /**
   * Portfolio Open Orders - with market pair column
   * Columns: Date | ID | Market | Side | Price | Amount | Output | Actions
   */
  portfolioOrders: "110px 70px 90px 60px minmax(100px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 150px",

  /**
   * Portfolio Triggers - with market pair column
   * Columns: Date | ID | Market | Type | Side | Trigger | Amount | Limit | Actions
   */
  portfolioTriggers: "110px 70px 90px 70px 60px minmax(100px, 1fr) minmax(120px, 1fr) minmax(100px, 1fr) 90px",
  /**
   * SpotPositions - LP positions (single market)
   * Columns: ID | Fee | Range | Value | Fees | APR | Status
   */
  positions: "70px 65px minmax(80px, 1.5fr) minmax(70px, 1fr) minmax(70px, 1fr) minmax(70px, 1fr) minmax(70px, 1fr)",
} as const;

export type GridPreset = keyof typeof gridPresets;
