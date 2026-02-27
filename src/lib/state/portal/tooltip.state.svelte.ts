import type { TooltipItem } from './types';
import { portal } from './portal.state.svelte';

class TooltipState {
  private tooltips = $state<Map<string, TooltipItem>>(new Map());
  activeTooltip = $state<string | null>(null);

  show(config: Omit<TooltipItem, 'zIndex' | 'type'> & { id: string }): void {
    const zIndex = portal.getNextZIndex('tooltip');

    // Close existing tooltip if any
    if (this.activeTooltip) {
      this.hide(this.activeTooltip);
    }

    const tooltip: TooltipItem = {
      ...config,
      type: 'tooltip',
      zIndex
    };

    this.tooltips.set(config.id, tooltip);
    portal.registerLayer(tooltip);
    this.activeTooltip = config.id;
  }

  hide(id?: string): void {
    const tooltipId = id || this.activeTooltip;
    if (!tooltipId) return;

    const tooltip = this.tooltips.get(tooltipId);
    if (tooltip?.onClose) {
      tooltip.onClose();
    }

    this.tooltips.delete(tooltipId);
    portal.unregisterLayer(tooltipId);

    if (this.activeTooltip === tooltipId) {
      this.activeTooltip = null;
    }
  }

  getActive(): TooltipItem | undefined {
    if (!this.activeTooltip) return undefined;
    return this.tooltips.get(this.activeTooltip);
  }
}

export const tooltipState = new TooltipState();
