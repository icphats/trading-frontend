export function focusTrap(node: HTMLElement) {
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== "Tab") return;

    const focusables = node.querySelectorAll<HTMLElement>(focusableSelector);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  node.addEventListener("keydown", handleKeydown);

  // Focus first element on mount
  const focusables = node.querySelectorAll<HTMLElement>(focusableSelector);
  const firstFocusable = focusables[0];
  firstFocusable?.focus();

  return {
    destroy() {
      node.removeEventListener("keydown", handleKeydown);
    }
  };
}