export interface MobileFriendUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  image?: string | null;
  avatarUrl?: string | null;
  mutualFriends: number;
  requestId?: string;
  requestStatus?: string;
  sentAt?: string;
  direction?: 'incoming' | 'outgoing';
}

export interface MobileFriendsSummary {
  friends: MobileFriendUser[];
  requests: MobileFriendUser[];
  sentRequests: MobileFriendUser[];
  searchResults: MobileFriendUser[];
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

async function mobileFriendsRequest<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
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

export function getMobileFriendsSummary(token: string) {
  return mobileFriendsRequest<MobileFriendsSummary>('/mobile/friends/summary/', { token });
}

export function searchMobileFriends(token: string, query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return mobileFriendsRequest<{ results: MobileFriendUser[] }>(`/mobile/friends/search/${suffix}`, { token });
}

export function sendMobileFriendRequest(token: string, receiverId: string) {
  return mobileFriendsRequest<{ ok: boolean; summary: MobileFriendsSummary }>('/mobile/friends/requests/', {
    method: 'POST',
    token,
    body: { receiverId },
  });
}

export function acceptMobileFriendRequest(token: string, requestId: string) {
  return mobileFriendsRequest<{ ok: boolean; summary: MobileFriendsSummary }>(`/mobile/friends/requests/${requestId}/accept/`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function declineMobileFriendRequest(token: string, requestId: string) {
  return mobileFriendsRequest<{ ok: boolean; summary: MobileFriendsSummary }>(`/mobile/friends/requests/${requestId}/decline/`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function removeMobileFriend(token: string, friendId: string) {
  return mobileFriendsRequest<{ ok: boolean; summary: MobileFriendsSummary }>(`/mobile/friends/${friendId}/`, {
    method: 'DELETE',
    token,
  });
}
