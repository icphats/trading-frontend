let scrollLockCount = 0;
let scrollbarWidth = 0;
let originalPaddingRight = '';
let originalOverflow = '';

export function lockScroll() {
  if (scrollLockCount === 0) {
    // Calculate scrollbar width
    scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Store original styles
    originalPaddingRight = document.body.style.paddingRight;
    originalOverflow = document.body.style.overflow;

    // Apply scroll lock
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount++;
}

export function unlockScroll() {
  scrollLockCount--;
  if (scrollLockCount === 0) {
    // Restore original styles
    document.body.style.paddingRight = originalPaddingRight;
    document.body.style.overflow = originalOverflow;
  }
  // Prevent negative count
  if (scrollLockCount < 0) {
    scrollLockCount = 0;
  }
}