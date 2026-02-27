/**
 * Spot Market (Uniswap V3) Math Utilities - Barrel Export
 *
 * Migrated from: /canisters/spot/utils.ts
 * Architecture: FRONTEND_ARCHITECTURE.md - Shared Services Layer
 *
 * Refactored into specialized modules:
 * - spot-market.math.ts: Core mathematical primitives (ticks, sqrt prices, liquidity)
 * - spot-market.formatting.ts: Decimal precision, validation, and display formatting
 * - spot-market.ticks.ts: Tick spacing, alignment, and validation
 * - spot-market.swaps.ts: Swap estimation and CLOB conversion utilities
 */

// Re-export all from specialized modules
export * from './math';
export * from './formatting';
export * from './ticks';
export * from './swaps';
