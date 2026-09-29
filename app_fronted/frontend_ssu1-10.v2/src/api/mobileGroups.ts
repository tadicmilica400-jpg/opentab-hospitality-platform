export interface MobileGroupMember {
  membershipId: string;
  id: string;
  name: string;
  username: string;
  email?: string;
  image?: string | null;
  avatarUrl?: string | null;
  status: 'active' | 'invited' | 'accepted' | 'rejected' | 'left';
  rawStatus?: string;
  invitedAt?: string;
  joinedAt?: string | null;
  leftAt?: string | null;
}

export interface MobileGroupInvite {
  inviteId: string;
  groupId: string;
  tableSessionId: string;
  tableLabel: string;
  name: string;
  username: string;
  ownerGuestId: string;
  createdAt: string;
  invitedAt: string;
}

export interface MobileGroupFriend {
  id: string;
  name: string;
  username: string;
  email?: string;
  image?: string | null;
  avatarUrl?: string | null;
  mutualFriends: number;
}

export interface MobileGroup {
  id: string;
  ownerGuestId: string;
  tableSessionId: string;
  tableLabel: string;
  status: 'active' | 'closed';
  createdAt: string;
  members: MobileGroupMember[];
}

export interface MobileGroupSummary {
  hasActiveTableSession: boolean;
  tableSessionId: string | null;
  tableLabel: string | null;
  group: MobileGroup | null;
  invites: MobileGroupInvite[];
  availableFriends: MobileGroupFriend[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';

function joinUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function getErrorMessage(responseBody: unknown, statusCode: number) {
  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as Record<string, unknown>;

    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.message === 'string') return body.message;
  }

  if (typeof responseBody === 'string' && responseBody.trim()) {
    const normalizedBody = responseBody.trim().toLowerCase();

    if (normalizedBody.includes('<!doctype html') || normalizedBody.includes('<html')) {
      return 'Server je vratio grešku. Proveri Django terminal.';
    }

    return responseBody.trim();
  }

  return `API greška: ${statusCode}`;
}

async function mobileGroupRequest<T>(path: string, options: { method?: string; body?: unknown; token: string }) {
  const headers = new Headers();
  const hasBody = options.body !== undefined;

  if (hasBody) headers.set('Content-Type', 'application/json');
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

export function getMobileGroupSummary(token: string) {
  return mobileGroupRequest<MobileGroupSummary>('/mobile/groups/summary/', { token });
}

export function createMobileGroup(token: string) {
  return mobileGroupRequest<{ ok: boolean; summary: MobileGroupSummary }>('/mobile/groups/', {
    method: 'POST',
    token,
    body: {},
  });
}

export function inviteMobileGroupFriend(token: string, friendId: string) {
  return mobileGroupRequest<{ ok: boolean; summary: MobileGroupSummary }>('/mobile/groups/invite/', {
    method: 'POST',
    token,
    body: { friendId },
  });
}

export function acceptMobileGroupInvite(token: string, inviteId: string) {
  return mobileGroupRequest<{ ok: boolean; summary: MobileGroupSummary }>(`/mobile/groups/invites/${inviteId}/accept/`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function declineMobileGroupInvite(token: string, inviteId: string) {
  return mobileGroupRequest<{ ok: boolean; summary: MobileGroupSummary }>(`/mobile/groups/invites/${inviteId}/decline/`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function leaveMobileGroup(token: string) {
  return mobileGroupRequest<{ ok: boolean; summary: MobileGroupSummary }>('/mobile/groups/leave/', {
    method: 'POST',
    token,
    body: {},
  });
}
