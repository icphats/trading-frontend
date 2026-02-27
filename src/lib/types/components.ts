export type Size = 'xxxs' | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type LabelSize = 'md' | 'lg';

export type LogoSize = Size;

export interface Stat {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
}

// Display unit for token amounts
export type DisplayUnit = 'token' | 'usd';

// Option type for amounts in forms
export type OptionAmount = string | number | undefined;

// Token action error types for form validation
export type TokenActionErrorType =
  | 'insufficient-funds'
  | 'insufficient-funds-for-fee'
  | 'unknown-minimum-amount'
  | 'minimum-amount-not-reached'
  | 'amount-less-than-ledger-fee'
  | 'minter-info-not-certified'
  | undefined;
