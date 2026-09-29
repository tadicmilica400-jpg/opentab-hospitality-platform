import type { CartItem, CurrentOrder } from '../types';

export type MobileOrderResponse = {
  ok?: boolean;
  active?: boolean;
  order: CurrentOrder | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';

function joinUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function getErrorMessage(responseBody: unknown, statusCode: number) {
  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as Record<string, unknown>;

    if (typeof body.detail === 'string') {
      return body.detail;
    }

    if (typeof body.message === 'string') {
      return body.message;
    }
  }

  if (typeof responseBody === 'string' && responseBody.trim()) {
    return responseBody.trim();
  }

  return `API greška: ${statusCode}`;
}

async function mobileOrderRequest<T>(path: string, options: { method?: string; body?: unknown; token: string }) {
  const headers = new Headers();
  const hasBody = options.body !== undefined;

  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(joinUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const responseBody = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  return responseBody as T;
}

function cartItemToPayload(item: CartItem) {
  return {
    menuItemId: String(item.menuItem.id),
    qty: item.qty,
    note: item.note,
    optionIds: item.selectedOptions.map((option) => option.id),
  };
}

export function mobileCreateOrder(token: string, items: CartItem[]) {
  return mobileOrderRequest<MobileOrderResponse>('/mobile/orders/', {
    method: 'POST',
    token,
    body: {
      items: items.map(cartItemToPayload),
    },
  });
}

export function mobileGetActiveOrder(token: string) {
  return mobileOrderRequest<MobileOrderResponse>('/mobile/orders/active/', { token });
}

export function mobileGetOrder(token: string, orderId: string | number) {
  return mobileOrderRequest<{ order: CurrentOrder }>(`/mobile/orders/${orderId}/`, { token });
}

export function mobileGetOrderStatus(token: string, orderId: string | number) {
  return mobileOrderRequest<{ order: CurrentOrder }>(`/mobile/orders/${orderId}/status/`, { token });
}
