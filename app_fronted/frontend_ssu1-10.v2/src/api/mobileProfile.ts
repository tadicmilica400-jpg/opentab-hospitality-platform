import type { MobileUser } from './mobileAuth';
import type { MobileFriendsSummary } from './mobileFriends';

export interface MobileProfileStats {
  rewardPoints: number;
  friendsCount: number;
  requestsCount: number;
  reservationsCount: number;
  ordersCount: number;
  paidAmount: number;
}

export interface MobileProfileResponse {
  user: MobileUser;
  isAnonymous?: boolean;
  stats: MobileProfileStats;
  friendsSummary: MobileFriendsSummary;
}

export interface MobileProfileUpdatePayload {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';

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

async function mobileProfileRequest<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const headers = new Headers();
  const hasBody = options.body !== undefined;

  if (hasBody) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

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

export function getMobileProfile(token: string) {
  return mobileProfileRequest<MobileProfileResponse>('/mobile/profile/', { token });
}

export function updateMobileProfile(token: string, payload: MobileProfileUpdatePayload) {
  return mobileProfileRequest<MobileProfileResponse>('/mobile/profile/update/', {
    method: 'PATCH',
    token,
    body: payload,
  });
}
