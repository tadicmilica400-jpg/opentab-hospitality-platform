import type { CartItem, ReservationDraft } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';

export interface MobileReservationZone {
  key: string;
  label: string;
  description?: string;
}

export interface MobileReservationDefaults {
  venue: {
    id: string;
    name: string;
    address: string;
  } | null;
  user?: {
    id: string;
    name: string;
    phone: string;
  };
  depositAmount: number;
  zones?: MobileReservationZone[];
}

export interface MobileReservationTable {
  id: string;
  number: string;
  label: string;
  capacity: number;
  sector: {
    id: string;
    name: string;
    emoji?: string | null;
  };
  venue: {
    id: string;
    name: string;
    address: string;
  };
}

export interface MobileReservationPayment {
  id: string;
  reservationId: string;
  method: 'card' | 'cash';
  type: 'deposit' | 'preorder';
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  amount: number;
  providerReference?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface MobileReservation {
  id: string;
  guestId: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'no_show' | 'completed';
  numberOfPeople: number;
  startsAt: string;
  endsAt: string;
  date: string;
  dateLabel: string;
  time: string;
  endsAtLabel: string;
  depositAmount: number;
  cancellationDeadline?: string | null;
  createdAt: string;
  updatedAt: string;
  table: MobileReservationTable;
  preorder?: {
    id?: string | number;
    items: CartItem[];
    total: number;
    stage: string;
    status: string;
  } | null;
  payment?: MobileReservationPayment | null;
}

export interface CreateMobileReservationResponse {
  ok: boolean;
  message: string;
  reservation: MobileReservation;
}

function joinUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function getErrorMessage(responseBody: unknown, statusCode: number) {
  if (typeof responseBody === 'string' && responseBody.trim()) {
    const normalizedBody = responseBody.trim().toLowerCase();

    if (normalizedBody.includes('<!doctype html') || normalizedBody.includes('<html')) {
      return 'Server je vratio grešku. Proveri Django terminal.';
    }

    return responseBody;
  }

  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as Record<string, unknown>;

    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.message === 'string') return body.message;
  }

  return `API greška: ${statusCode}`;
}

async function mobileReservationRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string; timeoutMs?: number } = {},
) {
  const headers = new Headers();
  const hasBody = options.body !== undefined;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  if (hasBody) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  try {
    const response = await fetch(joinUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const responseBody = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      throw new Error(getErrorMessage(responseBody, response.status));
    }

    return responseBody as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Server predugo odgovara. Proverite vezu i pokušajte ponovo.');
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mapPreorderItem(item: CartItem) {
  return {
    menuItemId: item.menuItem.id,
    qty: item.qty,
    quantity: item.qty,
    note: item.note,
    selectedOptions: item.selectedOptions.map((option) => ({ id: option.id })),
  };
}

export function getMobileReservationDefaults(token: string) {
  return mobileReservationRequest<MobileReservationDefaults>('/mobile/reservations/defaults/', { token });
}

export function createMobileReservation(token: string, reservation: ReservationDraft) {
  return mobileReservationRequest<CreateMobileReservationResponse>('/mobile/reservations/', {
    method: 'POST',
    token,
    body: {
      date: reservation.date,
      dateLabel: reservation.dateLabel,
      time: reservation.time,
      guests: reservation.guests,
      zone: reservation.zone,
      name: reservation.name,
      phone: reservation.phone,
      note: reservation.note,
      preorder: reservation.preorder.map(mapPreorderItem),
    },
    timeoutMs: 20000,
  });
}

export function getMobileReservations(token: string) {
  return mobileReservationRequest<{ reservations: MobileReservation[] }>('/mobile/reservations/', { token });
}

export function cancelMobileReservation(token: string, reservationId: string) {
  return mobileReservationRequest<{ ok: boolean; message: string; reservation: MobileReservation }>(`/mobile/reservations/${reservationId}/cancel/`, {
    method: 'POST',
    token,
    body: {},
  });
}
