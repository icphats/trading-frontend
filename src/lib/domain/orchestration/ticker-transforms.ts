/**
 * Ticker Transforms
 *
 * Pure transform functions for the TickerService.
 *
 * Two concerns:
 * 1. Per-canister transforms: IndexerData → market/pool upserts (1:1, no aggregation)
 * 2. Per-token aggregation: MarketTokenContributions → TokenUpsert
 *    (TVL-weighted price from base-side, summed volume/TVL from both sides)
 *
 * Matches the indexer's aggregation logic in pagination.mo exactly.
 */

import type { IndexerData } from 'declarations/spot/spot.did';
import type { TokenUpsert, MarketUpsert, PoolUpsert } from '$lib/types/entity.types';
import { bpsToPercent, tickToPrice } from '$lib/domain/markets/utils/math';

// ============================================
// Per-canister upserts (market + pools only)
// ============================================

export interface TickerUpserts {
  market: MarketUpsert;
  pools: PoolUpsert[];
}

/**
 * Convert IndexerData from a spot canister into market and pool upserts.
 * Token data is handled separately via contributions + aggregation.
 */
export function indexerDataToUpserts(
  spotCanisterId: string,
  data: IndexerData,
): TickerUpserts {
  const td = data.token_data;
  const priceChange24h = bpsToPercent(td.price_change_bps[0]);

  const market: MarketUpsert = {
    canisterId: spotCanisterId,
    volume24h: td.volume_24h_usd_e6,
    tvl: data.base_tvl_usd_e6 + data.quote_tvl_usd_e6,
    priceChange24h,
    lastTradePrice: td.current_price_usd_e12,
    source: 'canister',
  };

  const pools: PoolUpsert[] = data.pool_data.map((p) => ({
    poolId: `${spotCanisterId}:${p.fee_pips}`,
    spotCanisterId,
    feePips: p.fee_pips,
    tvl: p.tvl_usd_e6,
    volume24h: p.volume_24h_usd_e6,
    volume7d: p.volume_7d_usd_e6,
    fees24h: p.fees_24h_usd_e6,
    apr: bpsToPercent(p.apr_bps),
    source: 'canister' as const,
  }));

  return { market, pools };
}

// ============================================
// Token contribution types + aggregation
// ============================================

/**
 * Per-market contribution for a token.
 * Created by the ticker service when a canister is fetched
 * and a registered token references that canister.
 */
export interface MarketTokenContribution {
  tokenCanisterId: string;
  spotCanisterId: string;
  role: 'base' | 'quote';
  /** Market volume in USD E6 — counts for both sides of the pair */
  volume24hE6: bigint;
  volume7dE6: bigint;
  volume30dE6: bigint;
  /** base_tvl_usd_e6 for base role, quote_tvl_usd_e6 for quote role */
  tvlE6: bigint;
  /** Only meaningful for base role (0n for quote) */
  priceUsdE12: bigint;
  /** Only meaningful for base role (0n for quote) */
  priceChangeBps24h: bigint;
}

/**
 * Create a token contribution from canister data.
 *
 * For base role: extracts price, price change, base_tvl, and market volume.
 * For quote role: extracts quote_tvl and market volume only.
 */
export function createTokenContribution(
  spotCanisterId: string,
  tokenCanisterId: string,
  role: 'base' | 'quote',
  data: IndexerData,
): MarketTokenContribution {
  const td = data.token_data;

  if (role === 'base') {
    return {
      tokenCanisterId,
      spotCanisterId,
      role: 'base',
      volume24hE6: td.volume_24h_usd_e6,
      volume7dE6: td.volume_7d_usd_e6,
      volume30dE6: td.volume_30d_usd_e6,
      tvlE6: data.base_tvl_usd_e6,
      priceUsdE12: td.current_price_usd_e12,
      priceChangeBps24h: td.price_change_bps[0],
    };
  } else {
    return {
      tokenCanisterId,
      spotCanisterId,
      role: 'quote',
      volume24hE6: td.volume_24h_usd_e6,
      volume7dE6: td.volume_7d_usd_e6,
      volume30dE6: td.volume_30d_usd_e6,
      tvlE6: data.quote_tvl_usd_e6,
      priceUsdE12: 0n,
      priceChangeBps24h: 0n,
    };
  }
}

// ============================================
// Price derivation from tick + quote USD
// ============================================

/**
 * Derive a base token's USD price from the pool's last trade tick
 * and the quote token's frontend USD price.
 *
 * This ensures both sides of a trading pair use the same USD reference rate,
 * eliminating inconsistencies between the canister's on-chain oracle rate
 * (5-min stale) and the frontend's fresher Coinbase/oracle price.
 *
 * @param tick - Reference tick (book mid > pool median > lastTradeTick)
 * @param baseDecimals - Base token decimals
 * @param quoteDecimals - Quote token decimals
 * @param quoteTokenPriceUsdE12 - Quote token's USD price in E12 from entity store
 * @returns Base token USD price in E12
 */
export function deriveBasePriceUsdE12(
  tick: number,
  baseDecimals: number,
  quoteDecimals: number,
  quoteTokenPriceUsdE12: bigint,
): bigint {
  // tickToPrice returns human-readable native rate (quote per base)
  const nativePrice = tickToPrice(tick, baseDecimals, quoteDecimals);
  // Multiply by quote USD (already E12) to get base USD in E12
  return BigInt(Math.round(nativePrice * Number(quoteTokenPriceUsdE12)));
}

/**
 * Aggregate contributions for a single token into a TokenUpsert.
 *
 * Matches the indexer's aggregation logic (pagination.mo):
 * - Price: TVL-weighted average across base-side markets
 * - Price change: TVL-weighted average across base-side markets
 * - Volume: sum across ALL markets (base + quote)
 * - TVL: sum across ALL markets (base_tvl from base, quote_tvl from quote)
 */
export function aggregateTokenContributions(
  contributions: MarketTokenContribution[],
): TokenUpsert {
  if (contributions.length === 0) {
    throw new Error('Cannot aggregate empty contributions');
  }

  const tokenCanisterId = contributions[0].tokenCanisterId;

  // Accumulators (sum across all markets)
  let totalVolume24h = 0n;
  let totalVolume7d = 0n;
  let totalVolume30d = 0n;
  let totalTvl = 0n;

  // TVL-weighted price (base-side only)
  let priceWeightedSum = 0n;
  let priceWeightTotal = 0n;
  let changeWeightedSum = 0n;

  for (const c of contributions) {
    totalVolume24h += c.volume24hE6;
    totalVolume7d += c.volume7dE6;
    totalVolume30d += c.volume30dE6;
    totalTvl += c.tvlE6;

    if (c.role === 'base') {
      const baseTvl = c.tvlE6;
      priceWeightedSum += c.priceUsdE12 * baseTvl;
      priceWeightTotal += baseTvl;
      changeWeightedSum += c.priceChangeBps24h * baseTvl;
    }
  }

  // Weighted average price (0 if token only appears as quote)
  const weightedPrice = priceWeightTotal > 0n
    ? priceWeightedSum / priceWeightTotal
    : 0n;

  const weightedChangeBps = priceWeightTotal > 0n
    ? changeWeightedSum / priceWeightTotal
    : 0n;

  return {
    canisterId: tokenCanisterId,
    priceUsd: weightedPrice,
    priceSource: 'oracle',
    priceChange24h: bpsToPercent(weightedChangeBps),
    volume24h: totalVolume24h,
    volume7d: totalVolume7d,
    volume30d: totalVolume30d,
    tvl: totalTvl,
    source: 'canister',
  };
}
