import type { ToastItem, ToastData } from './types';
import { portal } from './portal.state.svelte';

const DEFAULT_TIMEOUT = 30_000;

class ToastState {
  private toasts = $state<ToastItem[]>([]);
  private timers = new Map<string, number>();

  show(config: {
    id?: string;
    message: string;
    variant?: 'info' | 'success' | 'warning' | 'error' | 'loading';
    duration?: number;
    toastPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    onClose?: () => void;
    data?: ToastData;
    async?: false;
  }): string;

  show<T>(config: {
    id?: string;
    message?: string;
    variant?: 'info' | 'success' | 'warning' | 'error' | 'loading';
    duration?: number;
    toastPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    onClose?: () => void;
    data?: ToastData;
    async: true;
    promise: Promise<T>;
    messages: {
      loading: string;
      success: string | ((result: T) => string);
      error: string | ((error: any) => string);
    };
    maxTimeout?: number;
  }): Promise<T>;

  show<T>(config: any): string | Promise<T> {
    const id = config.id || crypto.randomUUID();
    const zIndex = portal.getNextZIndex('toast');

    // Handle async toast
    if (config.async && config.promise) {
      const toast: ToastItem = {
        id,
        type: 'toast',
        zIndex,
        message: config.messages.loading,
        variant: 'loading',
        toastPosition: config.toastPosition || 'bottom-right',
        duration: 0,
        data: config.data,
        onClose: config.onClose
      };

      this.toasts = [...this.toasts, toast];
      portal.registerLayer(toast);

      const maxTimeout = config.maxTimeout ?? DEFAULT_TIMEOUT;
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timerId = window.setTimeout(() => {
          reject(new Error('Request timed out'));
        }, maxTimeout);
        this.timers.set(`${id}_timeout`, timerId);
      });

      const raced = Promise.race([config.promise as Promise<T>, timeoutPromise]);

      // Use .then(onFulfilled, onRejected) — NOT .then().catch()
      // .catch() would also catch errors thrown inside the success handler,
      // causing both success and error toasts to fire for a single promise.
      return raced.then(
        (result: T) => {
          this.clearTimer(`${id}_timeout`);

          const successMessage = typeof config.messages.success === 'function'
            ? config.messages.success(result)
            : config.messages.success;

          const successToast: ToastItem = {
            id,
            type: 'toast',
            zIndex,
            message: successMessage,
            variant: 'success',
            toastPosition: config.toastPosition || 'bottom-right',
            duration: config.duration || 3000,
            data: config.data,
            onClose: config.onClose
          };

          this.toasts = this.toasts.map(t => t.id === id ? successToast : t);
          portal.registerLayer(successToast);

          this.scheduleDismiss(id, config.duration || 3000);

          return result;
        },
        (error: any) => {
          this.clearTimer(`${id}_timeout`);

          const errorMessage = typeof config.messages.error === 'function'
            ? config.messages.error(error)
            : config.messages.error;

          const dismissDuration = config.duration || 8000;

          const errorToast: ToastItem = {
            id,
            type: 'toast',
            zIndex,
            message: errorMessage,
            variant: 'error',
            toastPosition: config.toastPosition || 'bottom-right',
            duration: dismissDuration,
            data: config.data,
            onClose: config.onClose
          };

          this.toasts = this.toasts.map(t => t.id === id ? errorToast : t);
          portal.registerLayer(errorToast);

          this.scheduleDismiss(id, dismissDuration);

          throw error;
        }
      );
    }

    // Handle regular toast
    const toast: ToastItem = {
      id,
      type: 'toast',
      zIndex,
      message: config.message,
      variant: config.variant || 'info',
      toastPosition: config.toastPosition || 'bottom-right',
      duration: config.duration,
      data: config.data,
      onClose: config.onClose
    };

    this.toasts = [...this.toasts, toast];
    portal.registerLayer(toast);

    // Auto-dismiss after duration (default 5s, 0 = no auto-dismiss)
    if (config.duration !== 0) {
      this.scheduleDismiss(id, config.duration || 5000);
    }

    return id;
  }

  close(id: string): void {
    this.clearTimer(id);
    this.clearTimer(`${id}_timeout`);
    const toast = this.toasts.find(t => t.id === id);
    if (toast) {
      toast.onClose?.();
      this.toasts = this.toasts.filter(t => t.id !== id);
      portal.unregisterLayer(id);
    }
  }

  getAll(): ToastItem[] {
    return this.toasts;
  }

  private scheduleDismiss(id: string, duration: number): void {
    this.clearTimer(id);
    const timerId = window.setTimeout(() => {
      this.timers.delete(id);
      this.close(id);
    }, duration);
    this.timers.set(id, timerId);
  }

  private clearTimer(key: string): void {
    const timerId = this.timers.get(key);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      this.timers.delete(key);
    }
  }
}

export const toastState = new ToastState();
