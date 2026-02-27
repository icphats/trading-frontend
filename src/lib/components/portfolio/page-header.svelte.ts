import type { DropdownOption } from '$lib/components/ui/dropdown/types';

class PortfolioPageHeader {
  mode = $state<'overview' | 'tokens' | 'pools' | 'orders' | 'triggers' | 'nfts'>('overview');

  // Aggregate header data
  sectionLabel = $state('');
  totalValue = $state(0);
  change24h = $state(0);
  change24hPercent = $state(0);
  count = $state(0);
  countLabel = $state('');
  showValue = $state(true);
  loadingText = $state('');

  // Filter type
  filterType = $state<'none' | 'search' | 'dropdown'>('none');

  // Search filter state
  searchValue = $state('');
  searchPlaceholder = $state('Search');

  // Dropdown filter state
  dropdownValue = $state('');
  dropdownValues = $state<string[]>([]);
  dropdownOptions = $state<DropdownOption<string>[]>([]);
  dropdownAriaLabel = $state('Filter');
  dropdownMultiSelect = $state(false);
  showDropdown = $state(false);

  /** Reset all filter and header state. Called by each tab before configuring its own. */
  reset() {
    this.sectionLabel = '';
    this.totalValue = 0;
    this.change24h = 0;
    this.change24hPercent = 0;
    this.count = 0;
    this.countLabel = '';
    this.showValue = true;
    this.loadingText = '';
    this.filterType = 'none';
    this.searchValue = '';
    this.searchPlaceholder = 'Search';
    this.dropdownValue = '';
    this.dropdownValues = [];
    this.dropdownOptions = [];
    this.dropdownAriaLabel = 'Filter';
    this.dropdownMultiSelect = false;
    this.showDropdown = false;
  }

  toggleDropdownValue(value: string) {
    if (this.dropdownValues.includes(value)) {
      this.dropdownValues = this.dropdownValues.filter(v => v !== value);
    } else {
      this.dropdownValues = [...this.dropdownValues, value];
    }
  }
}

export const pageHeader = new PortfolioPageHeader();
