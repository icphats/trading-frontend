/**
 * Color utility functions for converting between different color formats
 */

/**
 * Convert OKLch color to hex format
 * @param L - Lightness (0-1)
 * @param C - Chroma (0-0.4+)
 * @param H - Hue (0-360)
 * @returns Hex color string
 */
export function oklchToHex(L: number, C: number, H: number): string {
  // Convert to OKLab
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);

  // OKLab to linear RGB
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b_ = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  // Apply gamma correction (linear to sRGB)
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b_ = b_ > 0.0031308 ? 1.055 * Math.pow(b_, 1 / 2.4) - 0.055 : 12.92 * b_;

  // Clamp to 0-1 range
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  b_ = Math.max(0, Math.min(1, b_));

  // Convert to hex
  const rHex = Math.round(r * 255)
    .toString(16)
    .padStart(2, "0");
  const gHex = Math.round(g * 255)
    .toString(16)
    .padStart(2, "0");
  const bHex = Math.round(b_ * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Parse oklch() CSS string and convert to hex
 * Handles browser variations: spaces, %, deg, none, / alpha
 * @param oklchString - CSS oklch() string
 * @returns Hex color string or null if parsing fails
 */
export function parseOklchToHex(oklchString: string): string | null {
  // Flexible regex: optional spaces, optional % on L, optional deg on H, optional / alpha
  const match = oklchString.match(
    /oklch\(\s*([\d.]+)%?\s+([\d.]+|none)\s+([\d.]+|none)(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)/
  );
  if (!match) return null;

  const L = match[1] === 'none' ? 0 : parseFloat(match[1]);
  const C = match[2] === 'none' ? 0 : parseFloat(match[2]);
  const H = match[3] === 'none' ? 0 : parseFloat(match[3]);

  // If L was given as percentage (e.g. 19%), convert to 0-1 range
  const lightness = oklchString.match(/oklch\(\s*[\d.]+%/) ? L / 100 : L;

  return oklchToHex(lightness, C, H);
}

/**
 * Get CSS variable value and convert to hex if needed
 * @param variableName - CSS variable name (e.g., '--background')
 * @param element - Element to get computed style from (defaults to document.documentElement)
 * @returns Hex color string or null if variable not found
 */
export function getCSSColorValue(
  variableName: string,
  element: HTMLElement = document.documentElement
): string | null {
  const value = getComputedStyle(element).getPropertyValue(variableName).trim();

  if (!value) {
    console.warn(`CSS variable ${variableName} not found`);
    return null;
  }

  // Handle oklch() color format
  if (value.startsWith("oklch(")) {
    const parsed = parseOklchToHex(value);
    if (parsed) return parsed;
    // oklch parse failed — fall through to canvas fallback
  }

  // Handle hex and rgb() directly (lightweight-charts understands these)
  if (value.startsWith("#") || value.startsWith("rgb")) {
    return value;
  }

  // Fallback: use canvas 2D context to resolve any CSS color to hex
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.fillStyle = value;
      return ctx.fillStyle; // returns resolved hex string
    }
  } catch {
    // Ignore canvas errors
  }

  return null;
}

/**
 * Convert hex color to semi-transparent version
 * @param hex - Hex color string
 * @param alpha - Alpha value (0-255)
 * @returns Hex color with alpha channel
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");
  const alphaHex = Math.round(Math.max(0, Math.min(255, alpha)))
    .toString(16)
    .padStart(2, "0");
  return `#${cleanHex}${alphaHex}`;
}