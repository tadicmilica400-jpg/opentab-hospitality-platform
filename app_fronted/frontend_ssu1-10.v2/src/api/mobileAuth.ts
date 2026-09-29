// Autor: OpenTab tim
//
// API klijent za autentifikaciju mobilne aplikacije.

export type MobileUser = {
  id: string;
  first_name: string;
  last_name: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  role: 'guest';
  status: string;
  image?: string | null;
  avatarUrl?: string | null;
  isAnonymous?: boolean;
};

export type MobileAuthSession = {
  token: string;
  expires_at: string;
  user: MobileUser;
  isAnonymous?: boolean;
};

export type MobileRegisterPayload = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
};

export type MobileLoginPayload = {
  identifier: string;
  password: string;
};

export type MobileMeResponse = {
  user: MobileUser;
  isAnonymous?: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';
const DEVICE_STORAGE_KEY = 'opentab.mobile.device.id';

function createDeviceId() {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `web-mobile-${randomPart}`;
}

export function getMobileDeviceId() {
  const storedDeviceId = localStorage.getItem(DEVICE_STORAGE_KEY);

  if (storedDeviceId) {
    return storedDeviceId;
  }

  const nextDeviceId = createDeviceId();
  localStorage.setItem(DEVICE_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
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

    if (typeof body.detail === 'string') {
      return body.detail;
    }

    if (typeof body.message === 'string') {
      return body.message;
    }

    const firstFieldError = Object.values(body).flat().find((value) => typeof value === 'string');

    if (typeof firstFieldError === 'string') {
      return firstFieldError;
    }
  }

  return `API greška: ${statusCode}`;
}

async function mobileApiRequest<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const headers = new Headers();
  const hasBody = options.body !== undefined;

  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

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

export function mobileLogin(payload: MobileLoginPayload) {
  return mobileApiRequest<MobileAuthSession>('/mobile/auth/login/', {
    method: 'POST',
    body: {
      identifier: payload.identifier,
      password: payload.password,
      device_id: getMobileDeviceId(),
    },
  });
}

export function mobileRegister(payload: MobileRegisterPayload) {
  return mobileApiRequest<MobileAuthSession>('/mobile/auth/register/', {
    method: 'POST',
    body: {
      fullName: payload.fullName,
      username: payload.username,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
      device_id: getMobileDeviceId(),
    },
  });
}

export function mobileContinueAsGuest(displayName?: string) {
  return mobileApiRequest<MobileAuthSession>('/mobile/auth/guest/', {
    method: 'POST',
    body: {
      displayName: displayName?.trim() || 'Gost',
      device_id: getMobileDeviceId(),
    },
  });
}

export function mobileGetCurrentUser(token: string) {
  return mobileApiRequest<MobileMeResponse>('/mobile/auth/me/', { token });
}

export function mobileLogout(token?: string | null) {
  return mobileApiRequest<{ ok: boolean }>('/mobile/auth/logout/', {
    method: 'POST',
    token: token ?? undefined,
    body: {},
  });
}
