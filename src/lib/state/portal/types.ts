export interface BaseLayerItem {
  id: string;
  type: 'modal' | 'tooltip' | 'window' | 'toast' | 'drawer';
  zIndex: number;
  component?: any;
  props?: Record<string, any>;
  onClose?: () => void;
  onComplete?: () => void;
}

export interface ModalItem extends BaseLayerItem {
  type: 'modal';
  title?: string;
}

export interface TooltipItem extends BaseLayerItem {
  type: 'tooltip';
  content?: string;
  target?: HTMLElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface WindowItem extends BaseLayerItem {
  type: 'window';
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  title?: string;
}

export interface ToastOrderData {
  type: 'order';
  side: 'Buy' | 'Sell';
  orderType: 'market' | 'limit' | 'trigger';
  symbol: string;
  logo?: string;
  amount?: string;
  price?: string;
  priceSymbol?: string;
  orderId?: string;
}

export type ToastData = ToastOrderData;

export interface ToastItem extends BaseLayerItem {
  type: 'toast';
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'error' | 'loading';
  duration?: number;
  toastPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  data?: ToastData;
}

export interface DrawerItem extends BaseLayerItem {
  type: 'drawer';
  title?: string;
  position?: 'left' | 'right';
}

export type LayerItem = ModalItem | TooltipItem | WindowItem | ToastItem | DrawerItem;

export const Z_INDEX_BASE = {
  tooltip: 100,
  window: 150,
  drawer: 200,
  modal: 250,
  toast: 300
} as const;
