import type { WindowItem } from './types';
import { portal } from './portal.state.svelte';

class WindowState {
  private windows = $state<Map<string, WindowItem>>(new Map());

  open(config: Omit<WindowItem, 'zIndex' | 'type'> & { id: string }): void {
    const zIndex = portal.getNextZIndex('window');
    const windowItem: WindowItem = {
      ...config,
      type: 'window',
      zIndex
    };

    this.windows.set(config.id, windowItem);
    portal.registerLayer(windowItem);
  }

  close(id: string): void {
    const windowItem = this.windows.get(id);
    if (windowItem?.onClose) {
      windowItem.onClose();
    }
    this.windows.delete(id);
    portal.unregisterLayer(id);
  }

  bringToFront(id: string): void {
    const newZIndex = portal.bringToFront(id);
    if (newZIndex !== null) {
      const windowItem = this.windows.get(id);
      if (windowItem) {
        this.windows.set(id, { ...windowItem, zIndex: newZIndex });
      }
    }
  }

  get(id: string): WindowItem | undefined {
    return this.windows.get(id);
  }

  getAll(): WindowItem[] {
    return Array.from(this.windows.values())
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  getLayer(id: string) {
    return portal.getLayer(id);
  }
}

export const windowState = new WindowState();
