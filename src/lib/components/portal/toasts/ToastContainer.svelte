<script lang="ts">
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import Toast from "./Toast.svelte";

  const TOAST_GAP = 72;

  let toasts = $derived(toastState.getAll());

  // Group toasts by position and compute stack offsets
  let toastsWithOffset = $derived.by(() => {
    const positionCounts = new Map<string, number>();
    return toasts.map(toast => {
      const pos = toast.toastPosition || 'bottom-right';
      const index = positionCounts.get(pos) || 0;
      positionCounts.set(pos, index + 1);
      return { toast, stackOffset: index * TOAST_GAP };
    });
  });
</script>

{#each toastsWithOffset as { toast, stackOffset } (toast.id)}
  <Toast
    message={toast.message}
    type={toast.variant}
    duration={toast.duration}
    position={toast.toastPosition}
    zIndex={toast.zIndex}
    data={toast.data}
    {stackOffset}
    onClose={() => toastState.close(toast.id)}
  />
{/each}
