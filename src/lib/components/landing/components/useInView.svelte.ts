/**
 * Intersection Observer utility for triggering animations when elements scroll into view.
 * Svelte 5 runes-based implementation.
 */

export function createInViewObserver(threshold = 0.1) {
  let inView = $state(false);
  let element: HTMLElement | null = null;
  let observer: IntersectionObserver | null = null;

  function observe(node: HTMLElement) {
    element = node;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            inView = true;
            // Once in view, stop observing (animation only triggers once)
            observer?.unobserve(node);
          }
        });
      },
      { threshold }
    );

    observer.observe(node);

    return {
      destroy() {
        observer?.disconnect();
      }
    };
  }

  return {
    get inView() { return inView; },
    observe
  };
}
