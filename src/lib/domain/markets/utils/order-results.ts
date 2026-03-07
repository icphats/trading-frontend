import type { OrderResultItem, SwapResultItem } from '$lib/actors/services/spot.service';
import { formatApiError } from '$lib/utils/error.utils';
import { toastState } from '$lib/state/portal/toast.state.svelte';

type CreateOrdersOk = {
  order_results: OrderResultItem[];
  swap_results: SwapResultItem[];
};

/**
 * Returns the primary success message for a createOrders result.
 */
export function summarizeOrderResult(
  result: CreateOrdersOk,
  context: 'market' | 'limit'
): string {
  const bookOk = result.order_results.find(r => 'ok' in r.result);
  const swapOk = result.swap_results.find(r => 'ok' in r.result);
  const orderId = bookOk && 'ok' in bookOk.result ? bookOk.result.ok.order_id : undefined;

  if (context === 'market') {
    if (bookOk && swapOk) return 'Trade executed';
    if (swapOk) return 'Trade executed';
    if (bookOk) return `Order #${orderId} filled`;
    return 'Trade submitted';
  }

  // limit
  if (bookOk && swapOk) return `Order #${orderId} placed`;
  if (bookOk) return `Order #${orderId} placed`;
  if (swapOk) return 'Trade executed';
  return 'Order submitted';
}

/**
 * Fires individual error toasts for any failed items in a createOrders result.
 * Call this as a side effect inside the async toast success callback.
 */
export function showFailedItemToasts(result: CreateOrdersOk): void {
  for (const item of result.order_results) {
    if ('err' in item.result) {
      toastState.show({
        message: `Book order failed: ${formatApiError(item.result.err)}`,
        variant: 'error',
        duration: 6000,
      });
    }
  }
  for (const item of result.swap_results) {
    if ('err' in item.result) {
      toastState.show({
        message: `Pool swap failed: ${formatApiError(item.result.err)}`,
        variant: 'error',
        duration: 6000,
      });
    }
  }
}

/**
 * Canonical success callback for createOrders toasts.
 * Shows the primary success message and fires error toasts for any failed items.
 */
export function orderResultSuccessMessage(
  result: CreateOrdersOk,
  context: 'market' | 'limit'
): string {
  showFailedItemToasts(result);
  return summarizeOrderResult(result, context);
}
