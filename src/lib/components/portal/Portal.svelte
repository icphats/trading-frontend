<script lang="ts">
  /**
   * @deprecated Use the `portal` action from `$lib/components/portal/portal.action` instead.
   *
   * This component-based portal approach breaks Svelte transitions because it uses
   * mount() to create a separate component tree. The action-based approach preserves
   * transitions by moving DOM nodes while keeping them in Svelte's component tree.
   *
   * Migration example:
   *
   * BEFORE (broken transitions):
   * ```svelte
   * <Portal>
   *   <div transition:fade>Content</div>
   * </Portal>
   * ```
   *
   * AFTER (working transitions):
   * Use the portal action with use:portal={'#portal-root'} on a div
   * that wraps transition elements.
   */

  import { portal } from "$lib/state/portal/portal.state.svelte";
  import { mount, unmount } from "svelte";
  import { onDestroy } from "svelte";
  import PortalTarget from "./PortalTarget.svelte";

  interface Props {
    children?: any;
  }

  let { children }: Props = $props();

  let portalId = crypto.randomUUID();
  let container: HTMLDivElement | null = null;
  let mountedComponent: Record<string, any> | null = null;

  // Log deprecation warning in development
  if (typeof window !== "undefined" && import.meta.env?.DEV) {
    console.warn(
      "[Portal] This component is deprecated. Use the `portal` action from `$lib/components/portal/portal.action` instead. " +
      "The action-based approach preserves Svelte transitions."
    );
  }

  $effect(() => {
    // SSR safety check
    if (typeof window === "undefined") return;

    const root = portal.getPortalRoot();
    if (!root) return;

    // Create container element
    container = document.createElement("div");
    container.setAttribute("data-portal-id", portalId);
    container.setAttribute("data-portal", "true");

    // Copy theme class from document element to portal container
    const htmlElement = document.documentElement;
    if (htmlElement.classList.contains("dark")) {
      container.classList.add("dark");
    }

    root.appendChild(container);

    // Mount the PortalTarget component with the children snippet
    mountedComponent = mount(PortalTarget, {
      target: container,
      props: {
        children
      }
    });

    // Register cleanup
    portal.mount(portalId, () => {
      cleanup();
    });

    // Watch for theme changes
    const themeObserver = new MutationObserver(() => {
      if (container) {
        if (htmlElement.classList.contains("dark")) {
          container.classList.add("dark");
        } else {
          container.classList.remove("dark");
        }
      }
    });

    themeObserver.observe(htmlElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      themeObserver.disconnect();
      cleanup();
    };
  });

  function cleanup() {
    if (mountedComponent) {
      unmount(mountedComponent);
      mountedComponent = null;
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    portal.unmount(portalId);
  }

  onDestroy(() => {
    cleanup();
  });
</script>

<!-- No DOM output - content is rendered directly in portal root -->
