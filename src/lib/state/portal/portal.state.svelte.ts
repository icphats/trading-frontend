import type { LayerItem } from './types';
import { Z_INDEX_BASE } from './types';

class PortalState {
  isClient = $state(typeof window !== "undefined");
  portalRoot = $state<HTMLElement | null>(null);

  private mounted = new Map<string, () => void>();
  private layers = $state<Map<string, LayerItem>>(new Map());

  getPortalRoot(): HTMLElement | null {
    if (!this.isClient) return null;

    let root = document.getElementById("portal-root");

    // Error handling: create portal root if missing
    if (!root) {
      console.warn("Portal root not found, creating fallback");
      root = document.createElement("div");
      root.id = "portal-root";
      document.body.appendChild(root);
    }

    return root;
  }

  mount(id: string, cleanup?: () => void): void {
    if (cleanup) {
      this.mounted.set(id, cleanup);
    }
  }

  unmount(id: string): void {
    const cleanup = this.mounted.get(id);
    if (cleanup) {
      cleanup();
      this.mounted.delete(id);
    }
  }

  // Z-Index Management
  registerLayer(item: LayerItem): void {
    this.layers.set(item.id, item);
  }

  unregisterLayer(id: string): void {
    this.layers.delete(id);
  }

  getNextZIndex(type: 'modal' | 'tooltip' | 'window' | 'toast' | 'drawer'): number {
    const base = Z_INDEX_BASE[type];
    const existing = Array.from(this.layers.values())
      .filter(l => l.type === type)
      .map(l => l.zIndex);
    return existing.length ? Math.max(...existing) + 1 : base;
  }

  bringToFront(id: string): number | null {
    const layer = this.layers.get(id);
    if (!layer) return null;

    const newZIndex = this.getNextZIndex(layer.type);
    const updatedLayer = { ...layer, zIndex: newZIndex };
    this.layers.set(id, updatedLayer);
    return newZIndex;
  }

  getLayer(id: string): LayerItem | undefined {
    return this.layers.get(id);
  }

  getAllLayers(): LayerItem[] {
    return Array.from(this.layers.values())
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  cleanup(): void {
    // Clean up layers
    for (const [id, layer] of this.layers) {
      if (layer.onClose) {
        layer.onClose();
      }
    }
    this.layers.clear();

    // Clean up mounted portals
    for (const [, cleanup] of this.mounted) {
      cleanup();
    }
    this.mounted.clear();
  }
}

export const portal = new PortalState();