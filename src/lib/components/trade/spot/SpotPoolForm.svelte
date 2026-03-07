<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { TokenAmountInput } from "$lib/components/ui/inputs";
  import PriceRangeInputCard from "$lib/components/liquidity/PriceRangeInputCard.svelte";
  import PriceStrategies from "$lib/components/liquidity/PriceStrategies.svelte";
  import { PriceStrategy, type PriceStrategyType } from "$lib/components/liquidity/PriceStrategies.svelte";
  import type { NormalizedToken } from "$lib/types/entity.types";
  import type { SpotMarket } from "$lib/domain/markets/state/spot-market.svelte";
  import type { PoolOverview } from "$lib/domain/orchestration";
  import { fetchPoolsOverview } from "$lib/domain/orchestration";
  import {
    tickToPrice,
    priceToTick,
    getTickSpacingForTier,
    validateAndAlignTicks,
    calculateAmountQuoteFromAmountBase,
    calculateAmountBaseFromAmountQuote,
    stringToBigInt,
    bigIntToString,
    formatFeePips,
    parseFeePips,
    MIN_FEE_PIPS,
    MAX_FEE_PIPS,
    amountToUsd,
    MIN_ORDER_USD,
  } from "$lib/domain/markets/utils";
  import { getTickBoundsForSpacing } from "$lib/domain/markets/utils/ticks";
  import { formatUSD } from "$lib/utils/format.utils";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { PERMANENT_LOCK_MS } from "$lib/constants/app.constants";
  import { entityStore } from "$lib/domain/orchestration/entity-store.svelte";
  import { untrack } from "svelte";
  import AddLiquidityConfirmModal from "$lib/components/portal/modals/specific/AddLiquidityConfirmModal.svelte";
  import AdjustableFieldCard from "$lib/components/liquidity/shared/AdjustableFieldCard.svelte";

  // ============================================
  // Constants
  // ============================================

  const MIN_FEE_PERCENT = 0.01;
  const MAX_FEE_PERCENT = 1.00;
  const FEE_STEP = 0.01;

  // ============================================
  // Props
  // ============================================

  interface Props {
    spot: SpotMarket;
    onRangeChange?: (tickLower: number, tickUpper: number, feePips: number) => void;
    openDepositBase?: () => void;
    openDepositQuote?: () => void;
  }

  let { spot, onRangeChange, openDepositBase, openDepositQuote }: Props = $props();

  // ============================================
  // Derived Market Data
  // ============================================

  const baseToken = $derived<NormalizedToken | undefined>(
    spot.tokens?.[0] ? entityStore.getToken(spot.tokens[0].toString()) : undefined
  );
  const quoteToken = $derived<NormalizedToken | undefined>(
    spot.tokens?.[1] ? entityStore.getToken(spot.tokens[1].toString()) : undefined
  );

  const baseDecimals = $derived(baseToken?.decimals ?? 8);
  const quoteDecimals = $derived(quoteToken?.decimals ?? 8);
  const baseSymbol = $derived(baseToken?.displaySymbol ?? baseToken?.symbol ?? 'Base');
  const quoteSymbol = $derived(quoteToken?.displaySymbol ?? quoteToken?.symbol ?? 'Quote');

  const baseBalance = $derived(spot.availableBase);
  const quoteBalance = $derived(spot.availableQuote);

  // ============================================
  // Pool Overview State
  // ============================================

  let pools = $state<PoolOverview[]>([]);
  let loadingPools = $state(false);

  // ============================================
  // Form State
  // ============================================

  let selectedFeePips = $state<number>(3000);
  let customFeeMode = $state(false);
  let customFeeValue = $state('0.30');
  let tickLower = $state<number>(0);
  let tickUpper = $state<number>(0);
  let amountBaseInput = $state<string>('');
  let amountQuoteInput = $state<string>('');
  let lastEditedToken = $state<0 | 1>(0);
  let confirmModalOpen = $state(false);
  let confirmedTicks = $state<[number, number] | null>(null);
  let rangeInitialized = $state(false);
  let activeStrategy = $state<PriceStrategyType>(PriceStrategy.WIDE);

  // Starting price for brand-new pools (no existing tick reference)
  let startingPriceInput = $state<string>('0.01');

  // Lock on creation
  let lockEnabled = $state(false);
  let lockDate = $state<string>('');
  let lockPermanent = $state(false);

  const LOCK_PRESETS: { label: string; days: number }[] = [
    { label: '1m', days: 30 },
    { label: '3m', days: 90 },
    { label: '6m', days: 180 },
    { label: '1y', days: 365 },
  ];

  function toLocalDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDateLocal(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  const lockMinDate = $derived.by(() => {
    return toLocalDateString(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
  });

  const lockUntilMs = $derived.by((): bigint | undefined => {
    if (!lockEnabled) return undefined;
    if (lockPermanent) return PERMANENT_LOCK_MS;
    if (!lockDate) return undefined;
    const ms = parseDateLocal(lockDate);
    if (isNaN(ms) || ms <= Date.now() + 24 * 60 * 60 * 1000) return undefined;
    return BigInt(ms);
  });

  function applyLockPreset(days: number) {
    lockPermanent = false;
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    lockDate = toLocalDateString(d);
  }

  function toggleLockPermanent() {
    lockPermanent = !lockPermanent;
    if (lockPermanent) lockDate = '';
  }

  // ============================================
  // Pool Deriveds (after form state so selectedFeePips is declared)
  // ============================================

  // Sorted by total TVL descending (top pools first)
  const sortedPools = $derived(
    [...pools].sort((a, b) => Number((b.base_usd_e6 + b.quote_usd_e6) - (a.base_usd_e6 + a.quote_usd_e6)))
  );

  // Active (routed) pools: top N by quote liquidity, filtered by backend min threshold
  const activeFeePips = $derived.by(() => {
    const minQuote = spot.minPoolQuoteLiquidityE6;
    const maxPools = Number(spot.maxRoutePoolInputs);
    const eligible = pools
      .filter(p => p.quote_usd_e6 >= minQuote)
      .sort((a, b) => Number(b.quote_usd_e6 - a.quote_usd_e6))
      .slice(0, maxPools);
    return new Set(eligible.map(p => p.fee_pips));
  });

  // Whether the selected fee matches an existing pool
  const selectedPool = $derived(pools.find(p => p.fee_pips === selectedFeePips));

  // Whether creating a new pool (fee tier not in existing pools)
  const isNewPool = $derived(!selectedPool);

  // Whether the selected pool is actively routed
  const isSelectedPoolActive = $derived(activeFeePips.has(selectedFeePips));

  // Fetch pool overviews on mount
  $effect(() => {
    const canisterId = spot.canister_id;
    if (canisterId) {
      untrack(() => {
        fetchPools();
      });
    }
  });

  async function fetchPools() {
    if (loadingPools) return;
    loadingPools = true;
    try {
      pools = await fetchPoolsOverview(spot.canister_id);
      // Auto-select highest TVL pool if available
      if (sortedPools.length > 0 && !customFeeMode) {
        selectedFeePips = sortedPools[0].fee_pips;
      }
      // No existing pools — show custom fee input by default
      if (pools.length === 0) {
        customFeeMode = true;
      }
    } catch {
      // Silent — pool overview is informational
    } finally {
      loadingPools = false;
    }
  }

  // ============================================
  // Derived Values
  // ============================================

  const tickSpacing = $derived(getTickSpacingForTier(selectedFeePips));

  // Starting price → tick (for new pools with no reference)
  const startingPriceParsed = $derived(parseFloat(startingPriceInput));
  const startingTick = $derived.by((): number | null => {
    if (!startingPriceInput || isNaN(startingPriceParsed) || startingPriceParsed <= 0) return null;
    return priceToTick(startingPriceParsed, baseDecimals, quoteDecimals, tickSpacing);
  });

  // Whether the user needs to provide a starting price (no existing tick source)
  const externalTick = $derived(selectedPool?.tick ?? spot.referenceTick ?? null);
  const needsStartingPrice = $derived(externalTick === null);

  // Priority: pool-specific tick > market reference tick > user-provided starting price > null
  const currentTick = $derived(externalTick ?? startingTick);
  const currentPrice = $derived(
    currentTick !== null ? tickToPrice(currentTick, baseDecimals, quoteDecimals) : 0
  );

  // One-sided liquidity detection (null tick = new pool, both tokens accepted)
  const depositBaseDisabled = $derived(currentTick !== null && currentTick >= tickUpper);
  const depositQuoteDisabled = $derived(currentTick !== null && currentTick <= tickLower);

  // Price display for range inputs
  const minPrice = $derived(tickToPrice(tickLower, baseDecimals, quoteDecimals));
  const maxPrice = $derived(tickToPrice(tickUpper, baseDecimals, quoteDecimals));

  // Amount as bigints for calculation
  const amountBaseBigInt = $derived(
    amountBaseInput ? stringToBigInt(amountBaseInput, baseDecimals) : 0n
  );
  const amountQuoteBigInt = $derived(
    amountQuoteInput ? stringToBigInt(amountQuoteInput, quoteDecimals) : 0n
  );

  // Validation
  const hasValidRange = $derived(tickLower < tickUpper);
  const hasValidAmount = $derived(amountBaseBigInt > 0n || amountQuoteBigInt > 0n);
  const insufficientBase = $derived(amountBaseBigInt > baseBalance);
  const insufficientQuote = $derived(amountQuoteBigInt > quoteBalance);
  const hasError = $derived(insufficientBase || insufficientQuote);

  // Minimum USD validation (combined value of both tokens must be >= $1)
  const combinedUsd = $derived.by(() => {
    const baseUsd = amountToUsd(amountBaseInput, baseToken?.priceUsd) ?? 0;
    const quoteUsd = amountToUsd(amountQuoteInput, quoteToken?.priceUsd) ?? 0;
    return baseUsd + quoteUsd;
  });
  const belowMinUsd = $derived(hasValidAmount && combinedUsd > 0 && combinedUsd < MIN_ORDER_USD);

  // New pool would need to compete for a top-3 routing slot
  const poolLimitReached = $derived(isNewPool && activeFeePips.size >= Number(spot.maxRoutePoolInputs));

  const needsStartingPriceInput = $derived(needsStartingPrice && startingTick === null);

  const canSubmit = $derived(
    hasValidRange &&
    hasValidAmount &&
    !hasError &&
    !poolLimitReached &&
    !needsStartingPriceInput &&
    !belowMinUsd
  );

  const buttonLabel = $derived.by(() => {
    if (poolLimitReached) return `Max ${spot.maxRoutePoolInputs} pools reached`;
    if (needsStartingPriceInput) return 'Set starting price';
    if (insufficientBase) return `Insufficient ${baseSymbol}`;
    if (insufficientQuote) return `Insufficient ${quoteSymbol}`;
    if (!hasValidRange) return 'Set price range';
    if (!hasValidAmount) return 'Enter amount';
    if (belowMinUsd) return `Minimum $${MIN_ORDER_USD.toFixed(2)}`;
    if (isNewPool) return 'Create Pool';
    return 'Add Liquidity';
  });

  // ============================================
  // Initialize range on first tick availability
  // ============================================

  function applyStrategy(strategy: PriceStrategyType) {
    if (currentTick === null) return;
    let lowerPrice: number;
    let upperPrice: number;

    switch (strategy) {
      case PriceStrategy.STABLE:
        lowerPrice = tickToPrice(currentTick - tickSpacing * 3, baseDecimals, quoteDecimals);
        upperPrice = tickToPrice(currentTick + tickSpacing * 3, baseDecimals, quoteDecimals);
        break;
      case PriceStrategy.ONE_SIDED_LOWER:
        lowerPrice = currentPrice * 0.5;
        upperPrice = tickToPrice(currentTick - tickSpacing, baseDecimals, quoteDecimals);
        break;
      case PriceStrategy.ONE_SIDED_UPPER:
        lowerPrice = tickToPrice(currentTick + tickSpacing, baseDecimals, quoteDecimals);
        upperPrice = currentPrice * 2;
        break;
      case PriceStrategy.FULL_RANGE: {
        const bounds = getTickBoundsForSpacing(tickSpacing);
        lowerPrice = tickToPrice(bounds.min, baseDecimals, quoteDecimals);
        upperPrice = tickToPrice(bounds.max, baseDecimals, quoteDecimals);
        break;
      }
      default: // WIDE / CUSTOM
        lowerPrice = currentPrice * 0.5;
        upperPrice = currentPrice * 2;
        break;
    }

    tickLower = priceToTick(lowerPrice, baseDecimals, quoteDecimals, tickSpacing);
    tickUpper = priceToTick(upperPrice, baseDecimals, quoteDecimals, tickSpacing);
  }

  $effect(() => {
    if (currentTick !== null && !rangeInitialized) {
      applyStrategy(activeStrategy);
      rangeInitialized = true;
    }
  });

  // ============================================
  // Emit range changes to parent
  // ============================================

  $effect(() => {
    if (rangeInitialized && hasValidRange) {
      onRangeChange?.(tickLower, tickUpper, selectedFeePips);
    }
  });

  // ============================================
  // Fee Tier Handlers
  // ============================================

  function selectPool(feePips: number) {
    selectedFeePips = feePips;
    customFeeMode = false;
    customFeeValue = '';
    realignTicks(feePips);
  }

  function enterCustomFeeMode() {
    customFeeMode = true;
    customFeeValue = (selectedFeePips / 10_000).toFixed(2);
  }

  function handleCustomFeeInput(e: Event) {
    const target = e.target as HTMLInputElement;
    customFeeValue = target.value.replace(/[^0-9.]/g, '');
  }

  function commitCustomFee() {
    const pips = parseFeePips(customFeeValue);
    if (pips >= MIN_FEE_PIPS && pips <= MAX_FEE_PIPS) {
      selectedFeePips = pips;
      realignTicks(pips);
    }
  }

  function incrementCustomFee() {
    const current = parseFloat(customFeeValue || '0');
    const next = Math.min(current + FEE_STEP, MAX_FEE_PERCENT);
    customFeeValue = next.toFixed(2);
    commitCustomFee();
  }

  function decrementCustomFee() {
    const current = parseFloat(customFeeValue || '0');
    const next = Math.max(current - FEE_STEP, MIN_FEE_PERCENT);
    customFeeValue = next.toFixed(2);
    commitCustomFee();
  }

  function realignTicks(feePips: number) {
    if (!rangeInitialized) return;
    const newSpacing = getTickSpacingForTier(feePips);
    tickLower = priceToTick(minPrice, baseDecimals, quoteDecimals, newSpacing);
    tickUpper = priceToTick(maxPrice, baseDecimals, quoteDecimals, newSpacing);
    recalculateLinkedAmount();
  }

  // ============================================
  // Linked Amount Calculation
  // ============================================

  function handleAmount0Change(value: string) {
    amountBaseInput = value;
    lastEditedToken = 0;

    if (currentTick === null || !hasValidRange || depositQuoteDisabled) return;
    const amt0 = stringToBigInt(value || '0', baseDecimals);
    if (amt0 <= 0n) {
      amountQuoteInput = '';
      return;
    }

    const amt1 = calculateAmountQuoteFromAmountBase(amt0, currentTick, tickLower, tickUpper);
    if (amt1 > 0n) {
      amountQuoteInput = bigIntToString(amt1, quoteDecimals);
    } else {
      amountQuoteInput = '';
    }
  }

  function handleAmount1Change(value: string) {
    amountQuoteInput = value;
    lastEditedToken = 1;

    if (currentTick === null || !hasValidRange || depositBaseDisabled) return;
    const amt1 = stringToBigInt(value || '0', quoteDecimals);
    if (amt1 <= 0n) {
      amountBaseInput = '';
      return;
    }

    const amt0 = calculateAmountBaseFromAmountQuote(amt1, currentTick, tickLower, tickUpper);
    if (amt0 > 0n) {
      amountBaseInput = bigIntToString(amt0, baseDecimals);
    } else {
      amountBaseInput = '';
    }
  }

  function recalculateLinkedAmount() {
    if (currentTick === null || !hasValidRange) return;

    if (lastEditedToken === 0 && amountBaseBigInt > 0n && !depositQuoteDisabled) {
      const amt1 = calculateAmountQuoteFromAmountBase(amountBaseBigInt, currentTick, tickLower, tickUpper);
      amountQuoteInput = amt1 > 0n ? bigIntToString(amt1, quoteDecimals) : '';
    } else if (lastEditedToken === 1 && amountQuoteBigInt > 0n && !depositBaseDisabled) {
      const amt0 = calculateAmountBaseFromAmountQuote(amountQuoteBigInt, currentTick, tickLower, tickUpper);
      amountBaseInput = amt0 > 0n ? bigIntToString(amt0, baseDecimals) : '';
    }
  }

  // ============================================
  // Range Handlers
  // ============================================

  function handleTickLowerChange(newTick: number) {
    tickLower = newTick;
    recalculateLinkedAmount();
  }

  function handleTickUpperChange(newTick: number) {
    tickUpper = newTick;
    recalculateLinkedAmount();
  }

  function handleStrategySelect(newTickLower: number, newTickUpper: number, strategy: PriceStrategyType) {
    activeStrategy = strategy;
    tickLower = newTickLower;
    tickUpper = newTickUpper;
    recalculateLinkedAmount();
  }

  // ============================================
  // Formatting Helpers
  // ============================================

  function formatTvl(tvl: bigint): string {
    const value = Number(tvl) / 1e6;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    if (value > 0) return `$${value.toFixed(0)}`;
    return '$0';
  }

  // ============================================
  // Submit
  // ============================================

  function resetForm() {
    amountBaseInput = '';
    amountQuoteInput = '';
    startingPriceInput = '';
    rangeInitialized = false;
  }

  function handleAddLiquidity() {
    const validation = validateAndAlignTicks(tickLower, tickUpper, selectedFeePips);
    if (!validation.valid || !validation.alignedTicks) {
      toastState.show({ message: validation.error ?? 'Invalid price range', variant: 'error', duration: 3000 });
      return;
    }

    confirmedTicks = validation.alignedTicks;
    confirmModalOpen = true;
  }

  function handleConfirmSuccess() {
    resetForm();
    fetchPools();
  }
</script>

<div class="pool-form">
  <!-- Select Pool / Fee Tier -->
  <div class="section">
    <div class="section-header">
      <div class="section-header-left">
        <span class="section-label">Select Fee Tier</span>
        {#if isNewPool}
          <span class="new-pool-badge">New pool</span>
        {:else if isSelectedPoolActive}
          <span class="existing-pool-badge">Active</span>
        {:else}
          <span class="inactive-pool-badge">Not routed</span>
        {/if}
      </div>
      <button class="custom-fee-toggle" onclick={() => { if (!customFeeMode) enterCustomFeeMode(); else customFeeMode = false; }} type="button">
        {customFeeMode ? 'Pools' : 'Custom'}
      </button>
    </div>

    {#if customFeeMode}
      <AdjustableFieldCard
        value={customFeeValue}
        placeholder="0.30"
        inputSuffix="%"
        size="sm"
        onDecrement={decrementCustomFee}
        onIncrement={incrementCustomFee}
        onInput={handleCustomFeeInput}
        onBlur={commitCustomFee}
        onKeydown={(e) => { if (e.key === 'Enter') { commitCustomFee(); customFeeMode = false; } }}
      >
        {#snippet footer()}
          <span class="fee-range-hint">{MIN_FEE_PERCENT.toFixed(2)}% – {MAX_FEE_PERCENT.toFixed(2)}%</span>
        {/snippet}
      </AdjustableFieldCard>
    {:else if loadingPools}
      <div class="pools-loading">
        {#each [1, 2, 3] as _}
          <div class="pool-card skeleton"><div class="skeleton-bar"></div></div>
        {/each}
      </div>
    {:else if sortedPools.length > 0}
      <div class="pool-cards">
        {#each sortedPools as pool (pool.fee_pips)}
          {@const isActive = activeFeePips.has(pool.fee_pips)}
          <button
            class="pool-card"
            class:selected={selectedFeePips === pool.fee_pips}
            class:inactive={!isActive}
            onclick={() => selectPool(pool.fee_pips)}
            type="button"
          >
            <div class="pool-card-header">
              <span class="pool-fee">{formatFeePips(pool.fee_pips)}</span>
              <span class="pool-status-dot" class:active={isActive}></span>
            </div>
            <span class="pool-tvl">{formatTvl(pool.base_usd_e6 + pool.quote_usd_e6)}</span>
            {#if !isActive}
              <span class="pool-inactive-label">Not routed</span>
            {:else}
              <span class="pool-positions">{pool.positions.toString()} pos</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="no-pools">
        <span class="no-pools-text">No active pools — create the first one below</span>
      </div>
    {/if}

    {#if poolLimitReached}
      <div class="pool-limit-warning">
        Only the top {spot.maxRoutePoolInputs} pools by quote liquidity{#if spot.minPoolQuoteLiquidityE6 > 0n} (min {formatUSD(Number(spot.minPoolQuoteLiquidityE6) / 1_000_000, 0)}){/if} are routed. You can still add liquidity, but the pool won't earn fees until it ranks in the top {spot.maxRoutePoolInputs}.
      </div>
    {:else if !isNewPool && !isSelectedPoolActive}
      <div class="pool-limit-warning">
        This pool isn't in the top {spot.maxRoutePoolInputs} by quote liquidity{#if spot.minPoolQuoteLiquidityE6 > 0n} (min {formatUSD(Number(spot.minPoolQuoteLiquidityE6) / 1_000_000, 0)}){/if}, so it's not currently routed.
      </div>
    {/if}
  </div>

  <!-- Starting Price (new pool, no reference tick) -->
  {#if needsStartingPrice}
    <AdjustableFieldCard
      label="Starting Price"
      value={startingPriceInput}
      placeholder="0.00"
      size="sm"
      showButtons={false}
      onInput={(e) => {
        startingPriceInput = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '');
        rangeInitialized = false;
      }}
    >
      {#snippet footer()}
        <span class="starting-price-hint">{quoteSymbol} per {baseSymbol}</span>
      {/snippet}
    </AdjustableFieldCard>
  {/if}

  <!-- Price Strategies -->
  {#if currentPrice > 0}
    <PriceStrategies
      {currentPrice}
      currentTick={currentTick!}
      baseDecimals={baseDecimals}
      quoteDecimals={quoteDecimals}
      {tickSpacing}
      {minPrice}
      {maxPrice}
      onStrategySelect={handleStrategySelect}
    />
  {/if}

  <!-- Price Range -->
  <div class="price-range">
    <PriceRangeInputCard
      type="min"
      tick={tickLower}
      {currentPrice}
      baseDecimals={baseDecimals}
      quoteDecimals={quoteDecimals}
      {quoteSymbol}
      {baseSymbol}
      {tickSpacing}
      onTickChange={handleTickLowerChange}
      size="sm"
    />
    <PriceRangeInputCard
      type="max"
      tick={tickUpper}
      {currentPrice}
      baseDecimals={baseDecimals}
      quoteDecimals={quoteDecimals}
      {quoteSymbol}
      {baseSymbol}
      {tickSpacing}
      onTickChange={handleTickUpperChange}
      size="sm"
    />
  </div>

  <!-- Token Amount Inputs -->
  <div class="amounts">
    <TokenAmountInput
      label={baseSymbol}
      value={amountBaseInput}
      token={baseToken}
      balance={baseBalance}
      disabled={depositBaseDisabled}
      onValueChange={handleAmount0Change}
      size="sm"
      showBalance
      onDepositClick={openDepositBase}
    />
    <TokenAmountInput
      label={quoteSymbol}
      value={amountQuoteInput}
      token={quoteToken}
      balance={quoteBalance}
      disabled={depositQuoteDisabled}
      onValueChange={handleAmount1Change}
      size="sm"
      showBalance
      onDepositClick={openDepositQuote}
    />
  </div>

  <!-- Lock Position -->
  <div class="section">
    <div class="section-header">
      <span class="section-label">Lock Position</span>
      <button
        class="lock-toggle"
        class:active={lockEnabled}
        onclick={() => { lockEnabled = !lockEnabled; if (!lockEnabled) { lockDate = ''; lockPermanent = false; } }}
        type="button"
      >
        {lockEnabled ? 'On' : 'Off'}
      </button>
    </div>
    {#if lockEnabled}
      <!-- Date picker -->
      <input
        type="date"
        class="lock-date-input"
        class:dimmed={lockPermanent}
        bind:value={lockDate}
        min={lockMinDate}
        disabled={lockPermanent}
      />

      <!-- Quick presets -->
      <div class="lock-presets">
        {#each LOCK_PRESETS as preset}
          <button
            class="lock-preset-btn"
            class:dimmed={lockPermanent}
            onclick={() => applyLockPreset(preset.days)}
            disabled={lockPermanent}
            type="button"
          >
            {preset.label}
          </button>
        {/each}
      </div>

      <!-- Permanent toggle -->
      <button
        class="lock-permanent-toggle"
        class:active={lockPermanent}
        onclick={toggleLockPermanent}
        type="button"
      >
        <span class="lock-permanent-check">{lockPermanent ? '✓' : ''}</span>
        <span class="lock-permanent-label">Permanent</span>
      </button>

      {#if lockPermanent}
        <span class="lock-permanent-warning">Irreversible — liquidity can never be withdrawn</span>
      {:else}
        <span class="lock-hint">Prevents decreasing or closing the position until the lock expires</span>
      {/if}
    {/if}
  </div>

  <!-- Submit -->
  <div class="submit">
    <Button
      variant={canSubmit ? 'purple' : 'gray'}
      size="lg"
      fullWidth
      disabled={!canSubmit}
      onclick={handleAddLiquidity}
    >
      {buttonLabel}
    </Button>
  </div>
</div>

{#if confirmedTicks}
  <AddLiquidityConfirmModal
    bind:open={confirmModalOpen}
    {spot}
    base={baseToken}
    quote={quoteToken}
    feePips={selectedFeePips}
    tickLower={confirmedTicks[0]}
    tickUpper={confirmedTicks[1]}
    amountBase={amountBaseBigInt}
    amountQuote={amountQuoteBigInt}
    initialTick={needsStartingPrice ? startingTick ?? undefined : undefined}
    {lockUntilMs}
    {isNewPool}
    onClose={() => confirmModalOpen = false}
    onSuccess={handleConfirmSuccess}
  />
{/if}

<style>
  .pool-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
  }

  /* Pool Cards */
  .pool-cards {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .pool-cards::-webkit-scrollbar {
    display: none;
  }

  .pool-card {
    flex: 0 0 auto;
    min-width: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 6px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .pool-card:hover:not(.selected):not(.skeleton) {
    background: var(--muted);
  }

  .pool-card.selected {
    border-color: var(--ring);
  }

  .pool-card.inactive {
    opacity: 0.6;
  }

  .pool-card-header {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .pool-fee {
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
  }

  .pool-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-warning, orange);
    flex-shrink: 0;
  }

  .pool-status-dot.active {
    background: var(--color-bullish);
  }

  .pool-tvl {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .pool-positions {
    font-size: 10px;
    color: var(--muted-foreground);
    opacity: 0.7;
  }

  .pool-inactive-label {
    font-size: 10px;
    color: var(--color-warning, orange);
    font-weight: 500;
  }

  .no-pools {
    padding: 12px;
    text-align: center;
    background: var(--background);
    border: 1px dashed var(--border);
    border-radius: 10px;
  }

  .no-pools-text {
    font-size: 12px;
    color: var(--muted-foreground);
  }

  /* Loading skeleton */
  .pools-loading {
    display: flex;
    gap: 6px;
  }

  .pool-card.skeleton {
    height: 64px;
    cursor: default;
    pointer-events: none;
  }

  .skeleton-bar {
    width: 60%;
    height: 12px;
    background: var(--muted);
    border-radius: 4px;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% { opacity: 0.5; }
    50% { opacity: 0.8; }
    100% { opacity: 0.5; }
  }

  /* Custom Fee Toggle */
  .custom-fee-toggle {
    font-size: 11px;
    font-weight: 500;
    color: var(--ring);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
  }

  .custom-fee-toggle:hover {
    text-decoration: underline;
  }

  .new-pool-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: oklch(from var(--ring) l c h / 0.15);
    color: var(--ring);
  }

  .existing-pool-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: oklch(from var(--color-bullish) l c h / 0.15);
    color: var(--color-bullish);
  }

  .inactive-pool-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: oklch(from var(--color-warning, orange) l c h / 0.15);
    color: var(--color-warning, orange);
  }

  /* Fee range hint (rendered inside AdjustableFieldCard footer snippet) */
  .fee-range-hint {
    font-size: 11px;
    color: var(--muted-foreground);
  }

  /* Pool Limit Warning */
  .pool-limit-warning {
    padding: 10px 12px;
    background: oklch(from var(--color-warning, orange) l c h / 0.1);
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-warning, orange);
  }

  .price-range {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .amounts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .lock-toggle {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--background);
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .lock-toggle:hover {
    border-color: var(--muted-foreground);
  }

  .lock-toggle.active {
    background: oklch(from var(--color-red) l c h / 0.15);
    border-color: var(--color-red);
    color: var(--color-red);
  }

  .lock-date-input {
    width: 100%;
    padding: 6px 10px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--foreground);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .lock-date-input:focus {
    border-color: var(--ring);
  }

  .lock-date-input.dimmed {
    opacity: 0.4;
    pointer-events: none;
  }

  .lock-presets {
    display: flex;
    gap: 4px;
  }

  .lock-preset-btn {
    flex: 1;
    padding: 4px 0;
    font-size: 11px;
    font-weight: 500;
    color: var(--muted-foreground);
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .lock-preset-btn:hover:not(:disabled) {
    color: var(--foreground);
    border-color: var(--ring);
  }

  .lock-preset-btn.dimmed {
    opacity: 0.4;
    pointer-events: none;
  }

  .lock-permanent-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .lock-permanent-toggle:hover {
    border-color: var(--muted-foreground);
  }

  .lock-permanent-toggle.active {
    border-color: var(--color-red);
    background: oklch(from var(--color-red) l c h / 0.05);
  }

  .lock-permanent-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border: 1.5px solid var(--border);
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    color: var(--color-red);
    transition: all 0.15s ease;
  }

  .lock-permanent-toggle.active .lock-permanent-check {
    border-color: var(--color-red);
    background: oklch(from var(--color-red) l c h / 0.15);
  }

  .lock-permanent-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--foreground);
  }

  .lock-hint {
    font-size: 11px;
    color: var(--muted-foreground);
    line-height: 1.4;
  }

  .lock-permanent-warning {
    font-size: 11px;
    color: var(--color-red);
    line-height: 1.4;
    font-weight: 500;
  }

  .submit {
    margin-top: 4px;
  }

  /* Starting price hint (rendered inside AdjustableFieldCard footer snippet) */
  .starting-price-hint {
    font-size: 11px;
    color: var(--muted-foreground);
  }

</style>
