import type { Snippet } from "svelte";

export type DropdownOption<T = string> = {
  value: T;
  label: string;
  icon?: Snippet;
  disabled?: boolean;
};
