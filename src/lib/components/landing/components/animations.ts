/**
 * Animation utilities for landing page.
 * CSS-based animations inspired by Uniswap's framer-motion approach.
 */

// Staggered delay calculator for child elements
export function staggerDelay(index: number, baseDelay = 0, stagger = 0.1): number {
  return baseDelay + (index * stagger);
}

// Generate inline style for rise-in animation
export function riseInStyle(delay = 0, duration = 1000): string {
  return `
    animation: riseIn ${duration}ms cubic-bezier(0.19, 1, 0.22, 1) ${delay * 1000}ms forwards;
    opacity: 0;
  `;
}

// Generate inline style for fade-in animation
export function fadeInStyle(delay = 0, duration = 600): string {
  return `
    animation: fadeIn ${duration}ms ease-out ${delay * 1000}ms forwards;
    opacity: 0;
  `;
}

// Generate inline style for scale-in animation
export function scaleInStyle(delay = 0, duration = 500): string {
  return `
    animation: scaleIn ${duration}ms cubic-bezier(0.19, 1, 0.22, 1) ${delay * 1000}ms forwards;
    opacity: 0;
    transform: scale(0.95);
  `;
}

// CSS keyframes to inject (call once on mount)
export const animationKeyframes = `
  @keyframes riseIn {
    0% {
      opacity: 0;
      transform: translateY(40px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(-4px);
      opacity: 0.5;
    }
    50% {
      transform: translateY(4px);
      opacity: 1;
    }
  }
`;

// Inject keyframes into document head (idempotent)
export function injectAnimationKeyframes(): void {
  if (typeof document === 'undefined') return;

  const existingStyle = document.getElementById('landing-animations');
  if (existingStyle) return;

  const style = document.createElement('style');
  style.id = 'landing-animations';
  style.textContent = animationKeyframes;
  document.head.appendChild(style);
}

// Cleanup keyframes on unmount
export function removeAnimationKeyframes(): void {
  if (typeof document === 'undefined') return;

  const style = document.getElementById('landing-animations');
  if (style) style.remove();
}
