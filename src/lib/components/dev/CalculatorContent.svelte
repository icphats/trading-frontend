<script lang="ts">
  // Constants
  const CYCLES_PER_ICP = 2_972_100_000_000n; // 2.9721 trillion cycles
  const ICP_PRICE_USD = 4.2;
  const THOUSAND_MULTIPLIER = 1000n;

  // State
  let inputValue: string = $state("");
  let countValue: string = $state("1");
  let usdCost: string = $state("$0.00");

  // Calculate USD cost from instruction count
  const calculateUSD = (): void => {
    if (!inputValue || inputValue === "") {
      usdCost = "$0.00";
      return;
    }

    try {
      // Remove any non-numeric characters except dots from both inputs
      const cleanedInput = inputValue.replace(/[^0-9.]/g, "");
      const cleanedCount = countValue.replace(/[^0-9.]/g, "") || "1";

      // Parse as float first to handle decimals
      const parsedNumber = parseFloat(cleanedInput);
      const parsedCount = parseFloat(cleanedCount);

      if (isNaN(parsedNumber) || isNaN(parsedCount)) {
        usdCost = "$0.00";
        return;
      }

      // Convert to actual instruction count (input is in thousands)
      // So 1000 input = 1,000,000 actual instructions
      // Then multiply by count
      const actualInstructions = BigInt(Math.floor(parsedNumber * 1000 * parsedCount));

      // Calculate: instructions -> cycles -> ICP -> USD
      // Instructions are equivalent to cycles in ICP
      const icpAmount = Number(actualInstructions) / Number(CYCLES_PER_ICP);
      const usdAmount = icpAmount * ICP_PRICE_USD;

      // Format USD with appropriate precision
      if (usdAmount < 0.000001) {
        usdCost = "$0.00";
      } else if (usdAmount < 0.01) {
        usdCost = `$${usdAmount.toFixed(8)}`;
      } else if (usdAmount < 1) {
        usdCost = `$${usdAmount.toFixed(4)}`;
      } else if (usdAmount < 1000) {
        usdCost = `$${usdAmount.toFixed(2)}`;
      } else {
        usdCost = `$${usdAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } catch (error) {
      usdCost = "$0.00";
    }
  };

  // Handle input change
  const handleInput = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    inputValue = target.value;
    calculateUSD();
  };

  // Handle count change
  const handleCountInput = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    countValue = target.value;
    calculateUSD();
  };
</script>

<div class="space-y-4">
  <!-- Info -->
  <div class="text-xs text-muted-foreground space-y-1">
    <p>1 ICP = 2.9721T cycles</p>
    <p>ICP Price = $4.20 USD</p>
    <p class="font-medium">Enter instructions in thousands (K)</p>
  </div>

  <!-- Instructions Input -->
  <div class="space-y-2">
    <label for="instruction-input" class="text-sm font-medium text-foreground"> Instructions (in thousands) </label>
    <input
      id="instruction-input"
      type="text"
      value={inputValue}
      oninput={handleInput}
      placeholder="e.g., 1000 = 1M instructions"
      class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
    />
  </div>

  <!-- Count/Multiplier Input -->
  <div class="space-y-2">
    <label for="count-input" class="text-sm font-medium text-foreground"> Count / Multiplier </label>
    <input
      id="count-input"
      type="text"
      value={countValue}
      oninput={handleCountInput}
      placeholder="e.g., 1440 for minutes in a day"
      class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
    />
    {#if inputValue && countValue}
      <p class="text-xs text-muted-foreground">
        Total: {(parseFloat(inputValue.replace(/[^0-9.]/g, "") || "0") * 1000 * parseFloat(countValue.replace(/[^0-9.]/g, "") || "1")).toLocaleString()} instructions
      </p>
    {/if}
  </div>

  <!-- Result -->
  <div class="p-3 bg-muted/50 rounded-md">
    <p class="text-xs text-muted-foreground mb-1">Estimated Cost</p>
    <p class="text-xl font-bold text-foreground">{usdCost}</p>
  </div>

  <!-- Quick Reference -->
  <div class="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
    <p>• 1K = 1,000 instructions</p>
    <p>• 1000K = 1M instructions</p>
    <p>• 1000000K = 1B instructions</p>
  </div>
</div>
