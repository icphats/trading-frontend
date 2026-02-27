/**
 * Portal Action - The canonical Svelte pattern for rendering content outside the DOM tree
 *
 * This action-based approach preserves Svelte transitions because:
 * 1. The element remains in Svelte's component tree (for lifecycle tracking)
 * 2. Only the DOM node's physical location changes
 * 3. Transitions are controlled by the original {#if} blocks, not mount/unmount
 *
 * Usage:
 *   <div use:portal={'#portal-root'}>Content with transitions</div>
 *   <div use:portal={document.body}>Content</div>
 *
 * @see https://svelte.dev/playground/79e33c2d7695444b994ba74255bb1387
 */

export interface PortalOptions {
  /** Target element or CSS selector. Defaults to '#portal-root' */
  target?: HTMLElement | string;
}

/**
 * Moves a DOM element to a different location in the DOM tree while preserving
 * Svelte's reactivity and transition system.
 *
 * @param node - The element to portal
 * @param options - Target element/selector, or just a string selector
 */
export function portal(
  node: HTMLElement,
  options: PortalOptions | string = {}
): { destroy: () => void; update: (newOptions: PortalOptions | string) => void } {
  let targetElement: HTMLElement | null = null;
  let originalParent: HTMLElement | null = null;
  let originalNextSibling: Node | null = null;

  function resolveTarget(opts: PortalOptions | string): HTMLElement | null {
    const target = typeof opts === "string" ? opts : opts.target ?? "#portal-root";

    if (typeof target === "string") {
      return document.querySelector<HTMLElement>(target);
    }
    return target;
  }

  function moveToPortal() {
    targetElement = resolveTarget(options);

    if (!targetElement) {
      console.warn("[portal] Target element not found, keeping element in place");
      return;
    }

    // Store original position for potential restoration
    originalParent = node.parentElement;
    originalNextSibling = node.nextSibling;

    // Copy theme class from document element
    const htmlElement = document.documentElement;
    if (htmlElement.classList.contains("dark")) {
      node.classList.add("dark");
    }

    // Move to portal target
    targetElement.appendChild(node);
  }

  // Initial move
  moveToPortal();

  // Watch for theme changes
  const themeObserver = new MutationObserver(() => {
    const htmlElement = document.documentElement;
    if (htmlElement.classList.contains("dark")) {
      node.classList.add("dark");
    } else {
      node.classList.remove("dark");
    }
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return {
    update(newOptions: PortalOptions | string) {
      const newTarget = resolveTarget(newOptions);

      // Only move if target changed
      if (newTarget && newTarget !== targetElement) {
        options = newOptions;
        targetElement = newTarget;
        targetElement.appendChild(node);
      }
    },

    destroy() {
      themeObserver.disconnect();

      // Explicitly remove the portaled node from its target container.
      // Svelte's generated cleanup looks for nodes in their original parent,
      // but portal moved them to a different DOM location. Without this,
      // destroyed components leave zombie nodes in the portal root.
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    },
  };
}
