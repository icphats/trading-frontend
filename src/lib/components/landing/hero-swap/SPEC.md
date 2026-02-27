# Quote Explorer Widget - Implementation Specification

> A read-only quote explorer showcasing the multi-venue (CLOB+AMM) quoting system on the landing page.

## Overview

Classic swap interface paired with a mini orderbook. The familiar input/output layout is instantly recognizable, while the orderbook and venue badges communicate the hybrid CLOB+AMM architecture.

---

## Visual Layout

```
Desktop (>=768px):
┌──────────────────────────────────────┬──────────────┐
│ ┌──────────────────────────────────┐ │  MINI        │
│ │ 100           [PARTY ▾]         │ │  ORDERBOOK   │
│ │ ~$12.50                         │ │              │
│ └──────────────────────────────────┘ │              │
│              ↓                       │              │
│ ┌──────────────────────────────────┐ │              │
│ │ 125.24        [ICP ▾]           │ │              │
│ │ ~$125.24                        │ │              │
│ └──────────────────────────────────┘ │              │
│ [Book 60%] [Pool 40%]  <0.01%  [→]  │              │
└──────────────────────────────────────┴──────────────┘
```

---

## Component Structure

```
src/lib/components/landing/hero-swap/
├── HeroSwapWidget.svelte          # Main container (swap card + venue strip + confirmation modal)
├── MiniOrderBook.svelte           # Compact orderbook display
├── MarketSelectionModal.svelte    # Market picker
├── quoteExplorer.state.svelte.ts  # Reactive state management
├── index.ts                       # Public exports
└── SPEC.md                        # This file
```

---

## Component Specifications

### 1. HeroSwapWidget.svelte

**Purpose**: Root container with classic swap form and venue badges.

**Layout (top to bottom)**:
1. **Swap card** — Two `TokenAmountInput` fields with clickable token pills (opens `TokenSelectionModal`) and arrow divider
2. **Bottom strip** — Venue badges (one per venue, styled like TypeBadge) + price impact text + action button placeholder
3. **MiniOrderBook** — side-by-side on desktop

**Token Selection**: Each `TokenAmountInput` has a clickable token pill (chevron indicator). Clicking opens `TokenSelectionModal` filtered to tokens that have a live market against the other side's current token. Selecting a token finds the matching market and auto-determines buy/sell side.

### 2. quoteExplorer.state.svelte.ts

**Purpose**: Centralized reactive state for the quote explorer.

**Key Features**:
- `autoPopulateInput()` — targets ~$100 USD worth of input token on market load
- `switchMarket()` — clears state, reinitializes, auto-populates
- `setSide()` — re-auto-populates for new input token
- `getCounterpartTokens()` — returns tokens with live markets against a given token
- `findMarketByTokens()` — finds market matching two tokens in either order
- `switchMarketByTokenPair()` — switches market and auto-determines side from token pair
- Debounced quote calculation with request sequencing

### 3. MiniOrderBook.svelte

**Purpose**: Compact live orderbook visualization. Unchanged.

---

### 4. Swap Confirmation

Uses the shared `ConfirmationModal` component (confirmation-gated form pattern from mutation lifecycle canon). HeroSwapWidget builds `orderDetail` from the quote state and passes `onConfirm` → `executeSlowSwap()`. Modal closes on confirm, async toast handles loading/success/error.

**Detail rows**: Spend, Receive, Min. received, Price impact.

---

## Reused Components

| Component | Source | Usage |
|-----------|--------|-------|
| `TokenAmountInput` | `$lib/components/ui/inputs/TokenAmountInput.svelte` | Input/output amount fields with clickable token pills |
| `TokenSelectionModal` | `$lib/components/portal/modals/specific/TokenSelectionModal.svelte` | Token picker (filtered to valid counterparts) |
| `ConfirmationModal` | `$lib/components/portal/modals/specific/ConfirmationModal.svelte` | Swap confirmation with async toast |
