// Autor: OpenTab tim
//
// API klijent za povezivanje mobilne aplikacije sa stolom preko QR koda.

export type MobileTableSession = {
  id: string;
  membershipId: string;
  status: 'active' | 'waiting_payment' | 'closed' | 'cancelled';
  openedAt: string;
  joinedAt: string;
  venue: {
    id: string;
    name: string;
    address?: string | null;
  };
  sector: {
    id: string;
    name: string;
    emoji?: string | null;
  };
  table: {
    id: string;
    number: string;
    label: string;
    code: string;
    capacity: number;
    status: string;
  };
  guest: {
    id?: string | null;
    displayName: string;
    type: 'registered' | 'anonymous';
  };
};

export type MobileTableSessionResponse = {
  active: boolean;
  session: MobileTableSession | null;
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

async function mobileTableRequest<T>(path: string, options: { method?: string; body?: unknown; token: string }) {
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

export function mobileGetTableSession(token: string) {
  return mobileTableRequest<MobileTableSessionResponse>('/mobile/tables/session/', { token });
}

export function mobileScanTable(token: string, code: string) {
  return mobileTableRequest<MobileTableSessionResponse>('/mobile/tables/scan/', {
    method: 'POST',
    token,
    body: { code },
  });
}

export function mobileLeaveTableSession(token: string) {
  return mobileTableRequest<{ ok: boolean; active: boolean }>('/mobile/tables/session/leave/', {
    method: 'POST',
    token,
    body: {},
  });
}
