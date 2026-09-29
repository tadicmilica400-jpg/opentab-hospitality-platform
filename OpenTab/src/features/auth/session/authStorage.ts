// Autori: Milica Tadić ([student ID omitted], SSU11), Boško Trifunović ([student ID omitted], SSU16-19)
export type AuthRole = "owner" | "waiter" | "guest";

export type AuthVenue = {
  id: string;
  name: string;
  address?: string | null;
  description?: string | null;
  floor?: string | null;
  active?: boolean | number;
};

export type AuthUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  username: string;
  role: AuthRole;
  status: string;
  image?: string | null;
  venue?: AuthVenue | null;
};

export type AuthSession = {
  token: string;
  expires_at: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "opentab.auth.session";

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isExpired(expiresAt: string) {
  const expiresAtMs = Date.parse(expiresAt);

  return Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now();
}

export function getStoredAuthSession(): AuthSession | null {
  if (!isBrowserStorageAvailable()) {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession) as AuthSession;

    if (!parsedSession.token || !parsedSession.expires_at || !parsedSession.user) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    if (isExpired(parsedSession.expires_at)) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsedSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  if (isBrowserStorageAvailable()) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }
}

export function clearAuthSession() {
  if (isBrowserStorageAvailable()) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function getAuthToken() {
  return getStoredAuthSession()?.token ?? null;
}
