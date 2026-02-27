import type { DrawerItem } from './types';
import { portal } from './portal.state.svelte';

class DrawerState {
  private drawers = $state<Map<string, DrawerItem>>(new Map());
  activeDrawer = $state<string | null>(null);

  open(config: Omit<DrawerItem, 'zIndex' | 'type'> & { id: string }): void {
    const zIndex = portal.getNextZIndex('drawer');
    const drawer: DrawerItem = {
      ...config,
      type: 'drawer',
      zIndex
    };

    this.drawers.set(config.id, drawer);
    portal.registerLayer(drawer);
    this.activeDrawer = config.id;
  }

  close(id?: string): void {
    const drawerId = id || this.activeDrawer;
    if (!drawerId) return;

    const drawer = this.drawers.get(drawerId);
    if (drawer?.onClose) {
      drawer.onClose();
    }

    this.drawers.delete(drawerId);
    portal.unregisterLayer(drawerId);

    if (this.activeDrawer === drawerId) {
      const remaining = Array.from(this.drawers.values())
        .sort((a, b) => b.zIndex - a.zIndex);
      this.activeDrawer = remaining.length > 0 ? remaining[0].id : null;
    }
  }

  closeAll(): void {
    const drawers = Array.from(this.drawers.entries());

    for (const [id, drawer] of drawers) {
      if (drawer.onClose) {
        drawer.onClose();
      }
      this.drawers.delete(id);
      portal.unregisterLayer(id);
    }
    this.activeDrawer = null;
  }

  getActive(): DrawerItem | undefined {
    if (!this.activeDrawer) return undefined;
    return this.drawers.get(this.activeDrawer);
  }

  isOpen(id: string): boolean {
    return this.drawers.has(id);
  }

  getAll(): DrawerItem[] {
    return Array.from(this.drawers.values())
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  getLayer(id: string) {
    return portal.getLayer(id);
  }
}

export const drawerState = new DrawerState();
