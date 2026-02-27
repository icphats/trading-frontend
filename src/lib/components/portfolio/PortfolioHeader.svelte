<script lang="ts">
  import PortfolioAddressDisplay from './PortfolioAddressDisplay.svelte';
  import PortfolioTabs from './PortfolioTabs.svelte';
  import { SearchInput } from '$lib/components/ui';
  import DropdownMenu from '$lib/components/ui/dropdown/DropdownMenu.svelte';
  import { pageHeader } from '$lib/components/portfolio/page-header.svelte';

  interface Props {
    compact?: boolean;
    stuck?: boolean;
  }

  let { compact = false, stuck = false }: Props = $props();
</script>

<header class="portfolio-header" class:compact class:stuck>
  <!-- <div class="header-top">
    <PortfolioAddressDisplay {compact} />
  </div> -->
  <div class="tabs-row">
    <PortfolioTabs />
    {#if pageHeader.filterType === 'search'}
      <SearchInput
        bind:value={pageHeader.searchValue}
        placeholder={pageHeader.searchPlaceholder}
        size="sm"
        variant="inline"
      />
    {:else if pageHeader.filterType === 'dropdown' && pageHeader.showDropdown}
      <DropdownMenu
        options={pageHeader.dropdownOptions}
        value={pageHeader.dropdownMultiSelect ? undefined : pageHeader.dropdownValue}
        values={pageHeader.dropdownMultiSelect ? pageHeader.dropdownValues : undefined}
        multiSelect={pageHeader.dropdownMultiSelect}
        onValueChange={(v) => pageHeader.dropdownValue = v}
        onToggle={(v) => pageHeader.toggleDropdownValue(v)}
        align="right"
        ariaLabel={pageHeader.dropdownAriaLabel}
      >
        {#snippet trigger({ open, selectedOptions })}
          {#if pageHeader.dropdownMultiSelect}
            <span class="dropdown-trigger-label">
              {selectedOptions.length === 0 ? 'All Markets' : selectedOptions.map(o => o.label).join(', ')}
            </span>
          {:else}
            <span class="dropdown-trigger-label">
              {pageHeader.dropdownOptions.find(o => o.value === pageHeader.dropdownValue)?.label ?? 'Select'}
            </span>
          {/if}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="trigger-chevron"
            class:rotated={open}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        {/snippet}
      </DropdownMenu>
    {/if}
  </div>
</header>

<style>
  .portfolio-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--background);
    margin-bottom: 16px;
    padding: 16px 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
    transition: gap 0.2s ease, box-shadow 0.2s ease;
  }

  .portfolio-header.stuck {
    box-shadow: 0 1px 0 0 var(--border);
  }

  .portfolio-header.compact {
    gap: 12px;
  }

  .tabs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 40px;
  }

  .dropdown-trigger-label {
    font-size: 0.75rem;
    font-weight: 500;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger-chevron {
    transition: transform 200ms ease-out;
    flex-shrink: 0;
  }

  .trigger-chevron.rotated {
    transform: rotate(180deg);
  }
</style>
