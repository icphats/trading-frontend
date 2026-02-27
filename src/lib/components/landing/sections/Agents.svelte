<script lang="ts">
  import { untrack } from 'svelte';
  import { createInViewObserver } from '../components/useInView.svelte';

  const observer = createInViewObserver(0.2);

  const agentPrompt = `read docs.partyhats.xyz/agents/setup`;
  let copied = $state(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(agentPrompt);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }

  // --- Infinite terminal generation ---

  interface TermLine {
    type: 'prompt' | 'action' | 'result' | 'success' | 'blank';
    text: string;
  }

  interface ConversationBlock {
    lines: TermLine[];
  }

  // Market data for generation — reflects real canister pairs
  const markets = [
    { base: 'ETH', quote: 'USDT', tick: -230_000, spacing: 10, feePips: 500, baseDecimals: 8, quoteDecimals: 6 },
    { base: 'BTC', quote: 'USDT', tick: -185_000, spacing: 60, feePips: 3000, baseDecimals: 8, quoteDecimals: 6 },
    { base: 'ICP', quote: 'USDT', tick: -275_000, spacing: 10, feePips: 500, baseDecimals: 8, quoteDecimals: 6 },
    { base: 'USDT', quote: 'USDC', tick: -10, spacing: 1, feePips: 100, baseDecimals: 6, quoteDecimals: 6 },
    { base: 'PARTY', quote: 'ICP', tick: -320_000, spacing: 10, feePips: 500, baseDecimals: 8, quoteDecimals: 8 },
  ];

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  function rand(min: number, max: number) { return min + Math.random() * (max - min); }
  function randInt(min: number, max: number) { return Math.floor(rand(min, max)); }
  function fmtNat(n: number): string { return n.toLocaleString('en-US').replace(/,/g, '_'); }
  function alignTick(tick: number, spacing: number): number { return Math.round(tick / spacing) * spacing; }

  // Native-decimal amounts (like what the canister actually sees)
  function randNativeAmt(m: typeof markets[0]): number {
    const ranges: Record<string, [number, number]> = {
      ETH: [10_000_000, 1_200_000_000],      // 0.1 - 12 ETH in e8
      BTC: [100_000, 50_000_000],             // 0.001 - 0.5 BTC in e8
      ICP: [1_000_000_000, 500_000_000_000],  // 10 - 5000 ICP in e8
      USDT: [50_000_000, 25_000_000_000],     // 50 - 25000 USDT in e6
      PARTY: [100_000_000_000, 50_000_000_000_000], // 1000 - 500000 in e8
    };
    const [lo, hi] = ranges[m.base] ?? [1_000_000, 100_000_000];
    return randInt(lo, hi);
  }

  // Build an ExecutionPlan string like the real API returns
  function randRoute(inputAmt: number, m: typeof markets[0]): { display: string; plan: string } {
    const r = Math.random();
    if (r < 0.3) {
      // Book only
      return {
        display: `book: ${fmtNat(inputAmt)}`,
        plan: `{ book_input: ${fmtNat(inputAmt)}, pool_inputs: [] }`,
      };
    } else if (r < 0.6) {
      // Single pool
      return {
        display: `pool ${m.feePips}: ${fmtNat(inputAmt)}`,
        plan: `{ book_input: 0, pool_inputs: [(${m.feePips}, ${fmtNat(inputAmt)})] }`,
      };
    } else {
      // Hybrid split
      const bookPct = rand(0.3, 0.7);
      const bookAmt = Math.floor(inputAmt * bookPct);
      const poolAmt = inputAmt - bookAmt;
      return {
        display: `book: ${fmtNat(bookAmt)} + pool ${m.feePips}: ${fmtNat(poolAmt)}`,
        plan: `{ book_input: ${fmtNat(bookAmt)}, pool_inputs: [(${m.feePips}, ${fmtNat(poolAmt)})] }`,
      };
    }
  }

  // --- Prompt flavor pools: mix of human commands + autonomous agent thoughts ---

  const buyPrompts = [
    (m: typeof markets[0]) => `buy ${m.base} at market`,
    (m: typeof markets[0]) => `accumulate ${m.base} here`,
    (m: typeof markets[0]) => `pick up more ${m.base}`,
    (m: typeof markets[0]) => `load ${m.base} on this dip`,
    (m: typeof markets[0]) => `market buy ${m.base}/${m.quote}`,
  ];

  const sellPrompts = [
    (m: typeof markets[0]) => `take profit on ${m.base}`,
    (m: typeof markets[0]) => `trim ${m.base} position`,
    (m: typeof markets[0]) => `sell ${m.base} into ${m.quote}`,
    (m: typeof markets[0]) => `rotate ${m.base} to stables`,
    (m: typeof markets[0]) => `scale out of ${m.base}`,
  ];

  const limitPrompts = [
    (m: typeof markets[0], side: string) => `ladder ${side} orders on ${m.base}`,
    (m: typeof markets[0], side: string) => `set a grid on ${m.base}/${m.quote}`,
    (m: typeof markets[0], side: string) => `stack ${side}s across ${randInt(2, 5)} levels on ${m.base}`,
    (m: typeof markets[0], side: string) => `place ${side} limits on ${m.base}`,
  ];

  const triggerPrompts = [
    (m: typeof markets[0]) => `set a trigger on ${m.base}`,
    (m: typeof markets[0]) => `protect ${m.base} position with a trigger`,
    (m: typeof markets[0]) => `arm a safety trigger on ${m.base}`,
  ];

  const lpPrompts = [
    (m: typeof markets[0]) => `deploy LP on ${m.base}/${m.quote}`,
    (m: typeof markets[0]) => `add liquidity to ${m.base}/${m.quote}`,
    (m: typeof markets[0]) => `open a range position on ${m.base}`,
    (m: typeof markets[0]) => `put capital to work on ${m.base}/${m.quote}`,
  ];

  // --- Block generators ---

  function genRoutedOrder(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const isBuy = Math.random() > 0.5;
    const side = isBuy ? '#buy' : '#sell';
    const amt = randNativeAmt(m);
    const limitTick = alignTick(m.tick + randInt(-500, 500), m.spacing);
    const route = randRoute(amt, m);
    const orderId = randInt(100, 9999);
    const reason = isBuy ? pick(buyPrompts)(m) : pick(sellPrompts)(m);
    const fillType = route.display.includes('+') ? 'hybrid' : route.display.startsWith('book') ? 'book' : 'pool';
    return { lines: [
      { type: 'prompt', text: reason },
      { type: 'action', text: `quote_order(${side}, ${fmtNat(amt)}, ${limitTick})` },
      { type: 'result', text: `route → ${route.display}` },
      { type: 'action', text: `create_routed_order(${side}, ${limitTick}, ${fmtNat(amt)})` },
      { type: 'success', text: `filled  order_id: ${orderId}  via ${fillType}` },
    ]};
  }

  function genBatchLimits(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const count = randInt(2, 5);
    const side = pick(['buy', 'sell']);
    const ids = Array.from({ length: count }, () => randInt(100, 9999));
    const reason = pick(limitPrompts)(m, side);
    return { lines: [
      { type: 'prompt', text: reason },
      { type: 'action', text: `create_limit_orders([${count} specs])` },
      { type: 'result', text: `${count} orders across ${count} ticks  ioc: false` },
      { type: 'success', text: `placed  order_ids: [${ids.join(', ')}]` },
    ]};
  }

  function genTrigger(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const triggerTick = alignTick(m.tick - randInt(200, 800), m.spacing);
    const limitTick = alignTick(triggerTick - randInt(100, 300), m.spacing);
    const amt = randNativeAmt(m);
    const triggerId = randInt(100, 9999);
    const reason = pick(triggerPrompts)(m);
    return { lines: [
      { type: 'prompt', text: reason },
      { type: 'action', text: `create_triggers([{ #sell, trigger: ${triggerTick}, limit: ${limitTick} }])` },
      { type: 'result', text: `ref_tick: ${m.tick}  direction: below  amt: ${fmtNat(amt)}` },
      { type: 'success', text: `trigger_id: ${triggerId}  armed` },
    ]};
  }

  function genPassThrough(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const isBuy = Math.random() > 0.5;
    const side = isBuy ? '#buy' : '#sell';
    const amt = randNativeAmt(m);
    const route = randRoute(amt, m);
    const prompts = [
      `swap ${m.base} directly from wallet`,
      `pass-through ${isBuy ? 'buy' : 'sell'} ${m.base} — skip the deposit`,
      `${isBuy ? 'buy' : 'sell'} ${m.base} wallet to wallet`,
    ];
    return { lines: [
      { type: 'prompt', text: pick(prompts) },
      { type: 'action', text: `icrc2_approve(${m.quote}_ledger, spot, ${fmtNat(amt)})` },
      { type: 'result', text: `approved  block: ${randInt(100_000, 999_999)}` },
      { type: 'action', text: `pass_through_trade({ ${side}, ${fmtNat(amt)} })` },
      { type: 'success', text: `done  wallet → wallet` },
    ]};
  }

  function genRebalance(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const pct = (rand(3, 18)).toFixed(1);
    const isUnder = Math.random() > 0.5;
    const action = isUnder ? '#buy' : '#sell';
    const amt = randNativeAmt(m);
    const limitTick = alignTick(m.tick + randInt(-300, 300), m.spacing);
    const route = randRoute(amt, m);
    const prompts = [
      `rebalance ${m.base} — ${isUnder ? 'under' : 'over'}weight by ${pct}%`,
      `${isUnder ? 'increase' : 'decrease'} ${m.base} allocation by ${pct}%`,
      `fix portfolio drift on ${m.base}`,
    ];
    return { lines: [
      { type: 'prompt', text: pick(prompts) },
      { type: 'action', text: `quote_order(${action}, ${fmtNat(amt)}, ${limitTick})` },
      { type: 'result', text: `route → ${route.display}` },
      { type: 'action', text: `create_routed_order(${action}, ${limitTick}, ${fmtNat(amt)})` },
      { type: 'success', text: `rebalanced  ${m.base} back on target` },
    ]};
  }

  function genAddLiquidity(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const lower = alignTick(m.tick - randInt(200, 1000), m.spacing);
    const upper = alignTick(m.tick + randInt(200, 1000), m.spacing);
    const amt0 = randNativeAmt(m);
    const amt1 = randInt(50_000_000, 5_000_000_000);
    const posId = randInt(1, 500);
    const reason = pick(lpPrompts)(m);
    return { lines: [
      { type: 'prompt', text: reason },
      { type: 'action', text: `add_liquidity(${m.feePips}, ${lower}, ${upper}, ${fmtNat(amt0)}, ${fmtNat(amt1)})` },
      { type: 'result', text: `range: [${lower}, ${upper}]  spacing: ${m.spacing}` },
      { type: 'success', text: `position_id: ${posId}  minted and earning` },
    ]};
  }

  function genDecreaseLiquidity(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const posId = randInt(1, 500);
    const liqDelta = randInt(100_000_000, 10_000_000_000);
    const amt0 = randInt(1_000_000, 500_000_000);
    const amt1 = randInt(10_000_000, 2_000_000_000);
    const prompts = [
      `pull position #${posId} — out of range`,
      `withdraw #${posId} and redeploy`,
      `close position #${posId}`,
    ];
    return { lines: [
      { type: 'prompt', text: pick(prompts) },
      { type: 'action', text: `decrease_liquidity(${posId}, ${fmtNat(liqDelta)})` },
      { type: 'result', text: `returned: ${fmtNat(amt0)} ${m.base} + ${fmtNat(amt1)} ${m.quote}` },
      { type: 'success', text: `withdrawn  ready to redeploy` },
    ]};
  }

  function genCollectFees(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const posId = randInt(1, 500);
    const fees0 = randInt(10_000, 50_000_000);
    const fees1 = randInt(100_000, 200_000_000);
    const prompts = [
      `harvest fees from #${posId}`,
      `collect ${m.base}/${m.quote} LP fees`,
      `claim fees on position #${posId}`,
    ];
    return { lines: [
      { type: 'prompt', text: pick(prompts) },
      { type: 'action', text: `collect_fees(${posId})` },
      { type: 'result', text: `${fmtNat(fees0)} ${m.base} + ${fmtNat(fees1)} ${m.quote}` },
      { type: 'success', text: `collected  credited to trading balance` },
    ]};
  }

  function genReplaceOrders(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const cancelCount = randInt(1, 4);
    const createCount = randInt(1, 4);
    const cancelIds = Array.from({ length: cancelCount }, () => randInt(100, 9999));
    const newIds = Array.from({ length: createCount }, () => randInt(10000, 99999));
    const prompts = [
      `refresh stale orders on ${m.base}/${m.quote}`,
      `replace ${m.base} limits — book shifted`,
      `update my levels on ${m.base}`,
    ];
    return { lines: [
      { type: 'prompt', text: pick(prompts) },
      { type: 'action', text: `replace_orders({ cancel: [${cancelIds.join(', ')}], create: ${createCount} })` },
      { type: 'result', text: `cancelled ${cancelCount} → freed balance → ${createCount} new orders` },
      { type: 'success', text: `atomic swap  [${newIds.join(', ')}]` },
    ]};
  }

  function genGetUser(): ConversationBlock {
    const orders = randInt(0, 8);
    const triggers = randInt(0, 4);
    const positions = randInt(0, 6);
    const prompts = [
      `check my positions`,
      `sync state`,
      `show exposure`,
      `health check`,
    ];
    return { lines: [
      { type: 'prompt', text: pick(prompts) },
      { type: 'action', text: 'get_user()' },
      { type: 'result', text: `${orders} orders  ${triggers} triggers  ${positions} LP positions` },
      { type: 'result', text: `all healthy — no action needed` },
    ]};
  }

  function genConvertToMarket(): ConversationBlock {
    const m = pick(markets.filter(x => x.base !== 'USDT'));
    const orderId = randInt(100, 9999);
    const remaining = randNativeAmt(m);
    const limitTick = alignTick(m.tick + randInt(-200, 200), m.spacing);
    const route = randRoute(remaining, m);
    const prompts = [
      `convert order #${orderId} to market`,
      `market fill #${orderId} — stop waiting`,
      `sweep #${orderId} at market`,
    ];
    return { lines: [
      { type: 'prompt', text: pick(prompts) },
      { type: 'action', text: `quote_order(#sell, ${fmtNat(remaining)}, ${limitTick})` },
      { type: 'result', text: `route → ${route.display}` },
      { type: 'action', text: `convert_to_market(${orderId}, route)` },
      { type: 'success', text: `filled  remaining ${fmtNat(remaining)} executed` },
    ]};
  }

  const generators = [
    genRoutedOrder, genRoutedOrder, genRoutedOrder,
    genBatchLimits, genTrigger,
    genPassThrough, genRebalance,
    genAddLiquidity, genDecreaseLiquidity, genCollectFees,
    genReplaceOrders, genGetUser, genConvertToMarket,
  ];

  // --- State ---

  interface HistoryLine {
    line: TermLine;
    id: number;
  }

  let history = $state<HistoryLine[]>([]);
  let inputText = $state('');        // what's currently shown in the pinned input row
  let inputActive = $state(false);   // is the input row visible / being typed into
  let lineIdCounter = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let isRunning = false;
  let scrollEl: HTMLElement;
  const MAX_HISTORY = 40;


  function schedule(fn: () => void, ms: number) {
    timers.push(setTimeout(fn, ms));
  }

  function scrollToBottom() {
    if (scrollEl) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
    }
  }

  function pushHistory(line: TermLine) {
    const id = lineIdCounter++;
    history = [...history, { line, id }];
    if (history.length > MAX_HISTORY) {
      history = history.slice(history.length - MAX_HISTORY);
    }
    scrollToBottom();
  }

  // Type into the pinned input row char by char, then "submit" it
  function typeAndSubmit(text: string, onDone: () => void) {
    inputText = '';
    inputActive = true;
    let charIndex = 0;

    function typeNext() {
      if (charIndex >= text.length) {
        // "Submit" — move the typed text into history, clear input
        schedule(() => {
          pushHistory({ type: 'prompt', text });
          inputText = '';
          inputActive = false;
          // Pause — agent "reading" the prompt before responding
          schedule(onDone, randInt(600, 1200));
        }, randInt(150, 350));
        return;
      }

      charIndex++;
      inputText = text.slice(0, charIndex);

      const char = text[charIndex - 1];
      let delay = randInt(30, 70);
      if (char === ' ') delay = randInt(40, 90);
      if (char === '—' || char === '.' || char === ',') delay = randInt(80, 160);
      if (charIndex <= 2) delay = randInt(60, 120);

      schedule(typeNext, delay);
    }

    schedule(typeNext, randInt(300, 600));
  }

  function scheduleBlock() {
    const block = pick(generators)();
    const promptLine = block.lines[0];
    const responseLines = block.lines.slice(1);

    // Type the prompt in the input row, submit it, then drip responses into history
    typeAndSubmit(promptLine.text, () => {
      let i = 0;

      function addNextResponse() {
        if (i >= responseLines.length) {
          // Block done — breathing pause, then show input for next block
          schedule(scheduleBlock, randInt(2500, 4000));
          return;
        }

        const line = responseLines[i];
        pushHistory(line);
        i++;

        let delay: number;
        if (line.type === 'action') {
          delay = randInt(800, 1500);
        } else if (line.type === 'result') {
          delay = randInt(250, 500);
        } else if (line.type === 'success') {
          delay = randInt(400, 800);
        } else {
          delay = randInt(300, 600);
        }

        schedule(addNextResponse, delay);
      }

      addNextResponse();
    });
  }

  function startAnimation() {
    if (isRunning) return;
    isRunning = true;
    schedule(scheduleBlock, 800);
  }

  function stopAnimation() {
    timers.forEach(clearTimeout);
    timers = [];
    isRunning = false;
  }

  $effect(() => {
    if (observer.inView) {
      untrack(() => startAnimation());
    }
    return () => stopAnimation();
  });
</script>

<section class="agents-section" use:observer.observe>
  <div class="agents-container">
    <!-- Left side: Headline + copy -->
    <div class="agents-headline">
      <h2 class="headline">Built by Agents, for Agents.</h2>
      <div class="description">
        <p>
          The first fully onchain, agent-native DEX. Claude, Codex, OpenClaw — come trade where you belong.
        </p>
      </div>
    </div>

    <!-- Right side: Animated terminal -->
    <div class="terminal-wrap" class:in-view={observer.inView}>
      <div class="terminal-holo-border"></div>
      <div class="terminal">
      <div class="terminal-titlebar">
        <div class="terminal-dots">
          <span class="dot dot-red"></span>
          <span class="dot dot-yellow"></span>
          <span class="dot dot-green"></span>
        </div>
        <span class="terminal-filename">agent.ts</span>
      </div>
      <!-- Scrolling history -->
      <div class="terminal-history" bind:this={scrollEl}>
        {#each history as entry (entry.id)}
          <div
            class="terminal-line line-enter"
            class:line-prompt={entry.line.type === 'prompt'}
            class:line-action={entry.line.type === 'action'}
            class:line-result={entry.line.type === 'result'}
            class:line-success={entry.line.type === 'success'}
          >
            {#if entry.line.type === 'prompt'}
              <span class="prompt-caret">&gt;</span> <span class="prompt-text">{entry.line.text}</span>
            {:else if entry.line.type === 'action'}
              <span class="action-bullet">⏺</span> <span class="action-text">{entry.line.text}</span>
            {:else if entry.line.type === 'result'}
              <span class="result-indent">  </span><span class="result-text">{entry.line.text}</span>
            {:else if entry.line.type === 'success'}
              <span class="success-check">  ✓</span> <span class="success-text">{entry.line.text}</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Pinned input row -->
      <div class="terminal-input">
        <span class="input-text">{inputText || '\u00A0'}</span>
        <span class="typing-cursor" class:visible={inputActive || !history.length}></span>
      </div>
      </div>
    </div>

    <!-- Get Started — sits inside headline on desktop, below terminal on mobile -->
    <div class="agent-prompt-block">
      <span class="agent-prompt-label">Get Started</span>
      <button class="agent-prompt-cmd" onclick={copyPrompt}>
        <div class="agent-prompt-lines">
          <code>read docs.partyhats.xyz/agents/setup</code>
        </div>
        <span class="agent-prompt-copy">
          {#if copied}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-bullish)" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          {/if}
        </span>
      </button>
    </div>
  </div>
</section>

<style>
  .agents-section {
    width: 100%;
    height: 100%;
    padding: 4rem 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .agents-container {
    max-width: 1280px;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 1.25rem 3rem;
    align-items: center;
  }

  /* Headline side */
  .agents-headline {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 1.25rem;
    max-width: 500px;
  }

  .headline {
    font-size: clamp(1.5rem, 5.5vw, 2.75rem);
    font-weight: 500;
    line-height: 1.1;
    margin: 0;
    color: var(--foreground);
  }

  .description {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .description p {
    font-size: clamp(0.9375rem, 3.75vw, 1.125rem);
    line-height: 1.6;
    color: var(--muted-foreground);
    margin: 0;
  }

  /* Agent prompt block — desktop: under headline; mobile: below terminal */
  .agent-prompt-block {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 500px;
    align-self: start;
  }

  .agent-prompt-label {
    font-size: 0.875rem;
    font-weight: 400;
    color: var(--muted-foreground);
  }

  .agent-prompt-cmd {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--terminal-bg);
    border: 1px solid oklch(1 0 0 / 0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
    max-width: 100%;
    text-align: left;
  }

  .agent-prompt-cmd:hover {
    border-color: oklch(1 0 0 / 0.15);
    background: oklch(from var(--terminal-bg) calc(l + 0.02) c h);
  }

  .agent-prompt-lines {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    overflow: hidden;
  }

  .agent-prompt-lines code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: oklch(1 0 0 / 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agent-prompt-copy {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    color: oklch(1 0 0 / 0.3);
    margin-left: auto;
  }

  /* Terminal wrapper — holds the border + terminal, no overflow clip */
  .terminal-wrap {
    grid-column: 2;
    grid-row: 1 / -1;
    max-width: 600px;
    position: relative;
    opacity: 0;
    transform: translateY(30px);
    transition:
      opacity 0.8s cubic-bezier(0.19, 1, 0.22, 1),
      transform 0.8s cubic-bezier(0.19, 1, 0.22, 1);
  }

  .terminal-wrap.in-view {
    opacity: 1;
    transform: translateY(0);
  }

  /* Terminal inner — clips content, sits above border */
  .terminal {
    border-radius: 20px;
    background: var(--terminal-bg);
    overflow: hidden;
    position: relative;
    z-index: 1;
  }

  /* Border cutout — shaped ring that reveals the spinning gradient behind it */
  .terminal-holo-border {
    position: absolute;
    inset: -1px;
    border-radius: 21px;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  /* The actual spinning gradient — oversized circle so rotation stays smooth */
  .terminal-holo-border::before {
    content: '';
    position: absolute;
    /* Center a square large enough that its corners always cover the rounded rect */
    top: 50%;
    left: 50%;
    width: 200%;
    height: 200%;
    translate: -50% -50%;
    background:
      conic-gradient(
        from 0deg,
        oklch(0.8 0.25 300) 0deg,
        oklch(0.8 0.25 200) 40deg,
        oklch(0.75 0.2 140) 80deg,
        transparent 140deg,
        transparent 280deg,
        oklch(0.75 0.2 340) 320deg,
        oklch(0.8 0.25 300) 360deg
      );
    animation: holoSpin 8s linear infinite;
  }

  /* Punch out the interior so only 1px border ring is visible */
  .terminal-holo-border::after {
    content: '';
    position: absolute;
    inset: 1px;
    border-radius: 20px;
    background: var(--terminal-bg);
  }

  @keyframes holoSpin {
    to {
      rotate: 360deg;
    }
  }


  .terminal-titlebar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid oklch(1 0 0 / 0.06);
  }

  .terminal-dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .dot-red { background: oklch(0.63 0.2 25); }
  .dot-yellow { background: oklch(0.8 0.16 85); }
  .dot-green { background: oklch(0.72 0.17 150); }

  .terminal-filename {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: oklch(1 0 0 / 0.4);
  }

  /* Terminal layout: history scrolls, input pinned at bottom */
  .terminal-history {
    padding: 1.25rem 1.25rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    height: 340px;
    overflow-y: auto;
    scroll-behavior: smooth;
    justify-content: flex-end;
    /* Hide scrollbar but keep scrollable */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .terminal-history::-webkit-scrollbar {
    display: none;
  }

  /* Pinned input row */
  .terminal-input {
    padding: 0.625rem 1.25rem 1.25rem;
    border-top: 1px solid oklch(1 0 0 / 0.04);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.7;
    min-height: 2.875rem;
    height: auto;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    align-items: center;
  }

  .input-text {
    color: oklch(0.95 0 0);
    margin-left: 0.5ch;
  }

  /* Line types */
  .terminal-line {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-all;
    color: oklch(0.92 0 0);
  }

  .line-enter {
    animation: lineIn 250ms ease-out forwards;
  }

  @keyframes lineIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Prompt: > command */
  .line-prompt {
    margin-top: 0.75rem;
  }

  .prompt-caret {
    color: var(--color-bullish);
    font-weight: 600;
  }

  .prompt-text {
    color: oklch(0.95 0 0);
  }

  /* Typing cursor in pinned input */
  .typing-cursor {
    display: inline-block;
    width: 7px;
    height: 1.1em;
    background: var(--color-bullish);
    margin-left: 1px;
    vertical-align: text-bottom;
    animation: blink 0.6s step-end infinite;
    opacity: 0;
  }

  .typing-cursor.visible {
    opacity: 1;
  }

  /* Action: ⏺ doing something... */
  .line-action {
    margin-top: 0.25rem;
  }

  .action-bullet {
    color: oklch(0.72 0.12 300);
  }

  .action-text {
    color: oklch(1 0 0 / 0.65);
  }

  /* Result: indented data */
  .result-indent {
    user-select: none;
  }

  .result-text {
    color: oklch(1 0 0 / 0.5);
  }

  /* Success: ✓ outcome */
  .success-check {
    color: var(--color-bullish);
  }

  .success-text {
    color: var(--color-bullish);
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  /* Mobile: < 768px — stacked, fluid down to 300px */
  @media (max-width: 767px) {
    .agents-section {
      padding: clamp(0.75rem, 5vw, 2.5rem) clamp(0.5rem, 4vw, 2rem);
    }

    .agents-container {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
      gap: clamp(0.875rem, 5vw, 2.5rem);
    }

    .agents-headline {
      grid-column: 1;
      grid-row: 1;
      max-width: 100%;
    }

    .agent-prompt-block {
      grid-column: 1;
      grid-row: 2;
      max-width: 100%;
    }

    .terminal-wrap {
      grid-column: 1;
      grid-row: 3;
      max-width: 100%;
    }

    .terminal {
      border-radius: clamp(8px, 4.5vw, 20px);
    }

    .terminal-holo-border {
      border-radius: clamp(9px, 4.8vw, 21px);
    }

    .terminal-holo-border::after {
      border-radius: clamp(8px, 4.5vw, 20px);
    }

    .terminal-titlebar {
      padding: clamp(0.375rem, 2.5vw, 0.875rem) clamp(0.5rem, 3.5vw, 1.25rem);
      gap: clamp(0.25rem, 1.5vw, 0.5rem);
    }

    .dot {
      width: clamp(6px, 3vw, 12px);
      height: clamp(6px, 3vw, 12px);
    }

    .terminal-filename {
      font-size: clamp(0.5rem, 2.8vw, 0.8125rem);
    }

    .terminal-history {
      padding: clamp(0.5rem, 3vw, 1.25rem) clamp(0.5rem, 3.5vw, 1.25rem) 0.375rem;
      height: clamp(140px, 50vw, 300px);
    }

    .terminal-input {
      padding: clamp(0.25rem, 1.5vw, 0.625rem) clamp(0.5rem, 3.5vw, 1.25rem) clamp(0.5rem, 2.5vw, 1.25rem);
      height: auto;
      min-height: 1.5rem;
    }

    .terminal-line {
      font-size: clamp(0.5rem, 2.8vw, 0.75rem);
      line-height: 1.5;
    }

    .input-text {
      font-size: clamp(0.5rem, 2.8vw, 0.75rem);
    }

    .agent-prompt-cmd {
      padding: clamp(0.375rem, 2.5vw, 0.75rem) clamp(0.5rem, 3vw, 1rem);
      border-radius: clamp(6px, 3vw, 12px);
    }

    .agent-prompt-lines code {
      font-size: clamp(0.5rem, 2.8vw, 0.8125rem);
    }

    .agent-prompt-label {
      font-size: clamp(0.625rem, 3vw, 0.875rem);
    }
  }
</style>
