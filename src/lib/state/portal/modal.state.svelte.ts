import type { ModalItem } from './types';
import { portal } from './portal.state.svelte';

class ModalState {
  private modals = $state<Map<string, ModalItem>>(new Map());
  activeModal = $state<string | null>(null);

  open(config: Omit<ModalItem, 'zIndex' | 'type'> & { id: string }): void {
    const zIndex = portal.getNextZIndex('modal');
    const modal: ModalItem = {
      ...config,
      type: 'modal',
      zIndex
    };

    this.modals.set(config.id, modal);
    portal.registerLayer(modal);
    this.activeModal = config.id;
  }

  close(id?: string): void {
    const modalId = id || this.activeModal;
    if (!modalId) return;

    const modal = this.modals.get(modalId);
    if (modal?.onClose) {
      modal.onClose();
    }

    this.modals.delete(modalId);
    portal.unregisterLayer(modalId);

    if (this.activeModal === modalId) {
      // Find next modal or set to null
      const remaining = Array.from(this.modals.values())
        .sort((a, b) => b.zIndex - a.zIndex);
      this.activeModal = remaining.length > 0 ? remaining[0].id : null;
    }
  }

  closeAll(): void {
    const modals = Array.from(this.modals.entries());

    for (const [id, modal] of modals) {
      if (modal.onClose) {
        modal.onClose();
      }
      this.modals.delete(id);
      portal.unregisterLayer(id);
    }
    this.activeModal = null;
  }

  getActive(): ModalItem | undefined {
    if (!this.activeModal) return undefined;
    return this.modals.get(this.activeModal);
  }

  isOpen(id: string): boolean {
    return this.modals.has(id);
  }

  getAll(): ModalItem[] {
    return Array.from(this.modals.values())
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  getLayer(id: string) {
    return portal.getLayer(id);
  }
}

export const modalState = new ModalState();
