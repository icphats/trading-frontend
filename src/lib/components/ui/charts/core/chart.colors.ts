import { getCSSColorValue, hexWithAlpha } from '$lib/utils/color.utils';

// Theme colors used by charts
export interface ThemeColors {
  background: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  bullish: string;
  bearish: string;
  neutral: string;
  chart2: string;
  primary: string;
  volume: string;
  candleWick: string;
}

// Default fallback colors
const DEFAULT_COLORS: ThemeColors = {
  background: '#ffffff',
  foreground: '#0f0f0f',
  mutedForeground: '#6b7280',
  border: '#e5e7eb',
  bullish: '#22c55e',
  bearish: '#ef4444',
  neutral: '#6b7280',
  chart2: '#3b82f6',
  primary: '#3b82f6',
  volume: '#6b7280',
  candleWick: '#6b7280',
};

const DEFAULT_DARK_COLORS: ThemeColors = {
  background: '#0f0f0f',
  foreground: '#fafafa',
  mutedForeground: '#9ca3af',
  border: '#27272a',
  bullish: '#22c55e',
  bearish: '#ef4444',
  neutral: '#6b7280',
  chart2: '#3b82f6',
  primary: '#3b82f6',
  volume: '#6b7280',
  candleWick: '#6b7280',
};

/**
 * Extract theme colors from CSS variables
 * Returns colors for both light and dark themes
 */
export function extractThemeColors(): { light: ThemeColors; dark: ThemeColors } {
  // SSR safety check
  if (typeof document === 'undefined') {
    return { light: DEFAULT_COLORS, dark: DEFAULT_DARK_COLORS };
  }

  const root = document.documentElement;
  const currentTheme = root.classList.contains('dark') ? 'dark' : 'light';

  const themes = ['light', 'dark'] as const;
  const themeColors: { light: ThemeColors; dark: ThemeColors } = {
    light: { ...DEFAULT_COLORS },
    dark: { ...DEFAULT_DARK_COLORS },
  };

  themes.forEach((theme) => {
    // Temporarily switch theme class
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    void root.offsetHeight; // Force reflow

    themeColors[theme] = {
      background: getCSSColorValue('--background') ?? themeColors[theme].background,
      foreground: getCSSColorValue('--foreground') ?? themeColors[theme].foreground,
      mutedForeground: getCSSColorValue('--muted-foreground') ?? themeColors[theme].mutedForeground,
      border: getCSSColorValue('--border') ?? themeColors[theme].border,
      bullish: getCSSColorValue('--color-bullish') ?? themeColors[theme].bullish,
      bearish: getCSSColorValue('--color-bearish') ?? themeColors[theme].bearish,
      neutral: getCSSColorValue('--color-gray') ?? themeColors[theme].neutral,
      chart2: getCSSColorValue('--chart-2') ?? themeColors[theme].chart2,
      primary: getCSSColorValue('--primary') ?? themeColors[theme].primary,
      volume: getCSSColorValue('--color-volume') ?? themeColors[theme].volume,
      candleWick: getCSSColorValue('--color-candle-wick') ?? themeColors[theme].candleWick,
    };
  });

  // Restore original theme
  if (currentTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  return themeColors;
}

/**
 * Get current theme colors based on document state
 */
export function getCurrentThemeColors(): ThemeColors {
  if (typeof document === 'undefined') {
    return DEFAULT_COLORS;
  }

  const isDark = document.documentElement.classList.contains('dark');
  const allColors = extractThemeColors();
  return isDark ? allColors.dark : allColors.light;
}

/**
 * Get colors for explore charts (simpler, direction-based)
 * Used for token/pool detail pages
 */
export function getExploreChartColors(isPositive: boolean): {
  background: string;
  lineColor: string;
  areaTopColor: string;
  areaBottomColor: string;
  bullish: string;
  bearish: string;
  textColor: string;
  crosshairColor: string;
} {
  const colors = getCurrentThemeColors();
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return {
    background: 'transparent',
    lineColor: isPositive ? colors.bullish : colors.bearish,
    areaTopColor: isPositive ? hexWithAlpha(colors.bullish, 77) : hexWithAlpha(colors.bearish, 77),
    areaBottomColor: isPositive ? hexWithAlpha(colors.bullish, 5) : hexWithAlpha(colors.bearish, 5),
    bullish: colors.bullish,
    bearish: colors.bearish,
    textColor: colors.mutedForeground,
    crosshairColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
  };
}

/**
 * Get grid line color with transparency
 */
export function getGridLineColor(colors: ThemeColors): string {
  return hexWithAlpha(colors.border, 50);
}

/**
 * Get crosshair color with transparency
 */
export function getCrosshairColor(colors: ThemeColors): string {
  return hexWithAlpha(colors.border, 77);
}

/**
 * Get scale line color with transparency
 */
export function getScaleLineColor(colors: ThemeColors): string {
  return hexWithAlpha(colors.border, 51);
}

/**
 * Get volume bar color based on price direction
 */
export function getVolumeColor(isUp: boolean, colors: ThemeColors): string {
  return isUp ? hexWithAlpha(colors.bullish, 128) : hexWithAlpha(colors.bearish, 128);
}

// Re-export for convenience
export { hexWithAlpha } from '$lib/utils/color.utils';
