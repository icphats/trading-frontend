// =============================================================================
// Grid-based table components (for data tables with consistent column alignment)
// =============================================================================
export {
  GridTable,
  GridHeader,
  GridRow,
  GridCell,
  gridPresets,
  type GridPreset,
} from "./grid";

// =============================================================================
// Flex-based table components (for simple lists, legacy support)
// =============================================================================
export { default as DataTable } from "./DataTable.svelte";
export { default as TableCell } from "./TableCell.svelte";
export { default as HeaderCell } from "./HeaderCell.svelte";

// Column configurations for flex-based tables
export {
  openOrderColumns,
  triggerColumns,
  transactionColumns,
  type ColumnType,
} from "./columns";

// =============================================================================
// Badge components (re-exported from ui/badges)
// =============================================================================
export {
  ActivityTypeBadge,
  DeltaArrow,
  SideBadge,
  StatusBadge,
  TypeBadge,
} from "$lib/components/ui/badges";
