import type { PriceEntry } from '$lib/repositories/cache';

const E12_SCALE = 1e12;

/**
 * Binary search for the nearest oracle rate to a given timestamp.
 * Returns the price as a decimal (divided by E12). Returns 0 if rates is empty.
 */
export function findNearestRate(rates: PriceEntry[], timestampMs: number): number {
  if (rates.length === 0) return 0;

  let lo = 0;
  let hi = rates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rates[mid][0] < timestampMs) lo = mid + 1;
    else hi = mid;
  }

  // lo is the first index where rates[lo][0] >= timestampMs
  // Pick the closer of lo and lo-1
  if (lo === 0) return rates[0][1] / E12_SCALE;
  if (lo >= rates.length) return rates[rates.length - 1][1] / E12_SCALE;

  const before = rates[lo - 1];
  const after = rates[lo];
  const closest = (timestampMs - before[0]) <= (after[0] - timestampMs) ? before : after;
  return closest[1] / E12_SCALE;
}
