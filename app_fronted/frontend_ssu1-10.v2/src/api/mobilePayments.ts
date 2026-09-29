import type { PaymentMethod, SplitMode } from '../types';

export interface MobileBillItemOption {
  id: string;
  label: string;
  priceDelta?: number;
  group?: string;
}

export interface MobileBillItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  description: string;
  image?: string;
  category?: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  note?: string;
  status: string;
  isMine: boolean;
  selectedOptions: MobileBillItemOption[];
  createdAt: string;
}

export interface MobileBill {
  id: string;
  status: 'open' | 'partially_paid' | 'paid' | 'cancelled';
  subtotal: number;
  paidAmount: number;
  remainingAmount: number;
  participantCount: number;
  equalShareAmount: number;
  ownItemsTotal: number;
  createdAt: string;
  updatedAt: string;
  tableSession: {
    id: string;
    status: string;
  };
  venue: {
    id: string;
    name: string;
    address?: string | null;
  };
  table: {
    id: string;
    number: string;
    label: string;
    sector?: string;
  };
  items: MobileBillItem[];
}

export interface MobilePayment {
  id: string;
  billId: string;
  method: 'card' | 'cash';
  type: 'whole_bill' | 'own_items' | 'equal_split' | 'custom_amount' | 'deposit' | 'preorder';
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  amount: number;
  providerReference?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface MobileCreatePaymentPayload {
  method: PaymentMethod;
  splitMode: SplitMode;
  tipAmount: number;
}

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

async function mobilePaymentRequest<T>(path: string, options: { method?: string; body?: unknown; token: string }) {
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

export function mobileGetBill(token: string) {
  return mobilePaymentRequest<{ bill: MobileBill }>('/mobile/payments/bill/', { token });
}

export function mobileCreatePayment(token: string, payload: MobileCreatePaymentPayload) {
  return mobilePaymentRequest<{ ok: boolean; payment: MobilePayment; bill: MobileBill; message?: string }>('/mobile/payments/', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function mobileGetPayment(token: string, paymentId: string) {
  return mobilePaymentRequest<{ payment: MobilePayment }>(`/mobile/payments/${paymentId}/`, { token });
}
