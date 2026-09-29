// Autor: OpenTab tim
//
// Kontekst za sesiju korisnika u mobilnoj aplikaciji.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  mobileContinueAsGuest,
  mobileGetCurrentUser,
  mobileLogin,
  mobileLogout,
  mobileRegister,
} from '../api/mobileAuth';
import type { MobileAuthSession, MobileLoginPayload, MobileRegisterPayload, MobileUser } from '../api/mobileAuth';

const MOBILE_AUTH_STORAGE_KEY = 'opentab.mobile.auth.session';

interface MobileAuthContextValue {
  session: MobileAuthSession | null;
  user: MobileUser | null;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isCheckingSession: boolean;
  login: (payload: MobileLoginPayload) => Promise<MobileAuthSession>;
  register: (payload: MobileRegisterPayload) => Promise<MobileAuthSession>;
  continueAsGuest: (displayName?: string) => Promise<MobileAuthSession>;
  logout: () => Promise<void>;
  updateSessionUser: (user: MobileUser, isAnonymous?: boolean) => void;
}

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

function isExpired(expiresAt: string) {
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now();
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function readStoredSession(): MobileAuthSession | null {
  try {
    const rawSession = localStorage.getItem(MOBILE_AUTH_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession) as MobileAuthSession;

    if (!parsedSession.token || !parsedSession.expires_at || !parsedSession.user) {
      localStorage.removeItem(MOBILE_AUTH_STORAGE_KEY);
      return null;
    }

    if (isExpired(parsedSession.expires_at)) {
      localStorage.removeItem(MOBILE_AUTH_STORAGE_KEY);
      clearLegacyProfileStorage();
      return null;
    }

    return parsedSession;
  } catch {
    localStorage.removeItem(MOBILE_AUTH_STORAGE_KEY);
    clearLegacyProfileStorage();
    return null;
  }
}

function saveStoredSession(session: MobileAuthSession) {
  localStorage.setItem(MOBILE_AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(MOBILE_AUTH_STORAGE_KEY);
}

function normalizeFullName(user: MobileUser) {
  const fullName = user.fullName || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return fullName || 'Gost';
}

function syncLegacyProfileStorage(session: MobileAuthSession) {
  const anonymous = normalizeBoolean(session.isAnonymous) || normalizeBoolean(session.user.isAnonymous);
  const fullName = normalizeFullName(session.user);

  localStorage.setItem('appMode', anonymous ? 'guest' : 'user');
  localStorage.setItem('userLoggedIn', anonymous ? 'false' : 'true');
  localStorage.setItem('userName', fullName);
  localStorage.setItem('userUsername', session.user.username || 'gost');
  localStorage.setItem('userEmail', session.user.email || '');

  if (!anonymous && !localStorage.getItem('rewardPoints')) {
    localStorage.setItem('rewardPoints', '120');
  }

  if (anonymous) {
    localStorage.removeItem('rewardPoints');
  }
}

function clearLegacyProfileStorage() {
  localStorage.setItem('userLoggedIn', 'false');
  localStorage.setItem('appMode', 'guest');
  localStorage.removeItem('userName');
  localStorage.removeItem('userUsername');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('rewardPoints');
}

function persistSession(session: MobileAuthSession) {
  saveStoredSession(session);
  syncLegacyProfileStorage(session);
}

function clearSessionState() {
  clearStoredSession();
  clearLegacyProfileStorage();
}

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MobileAuthSession | null>(() => readStoredSession());
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(readStoredSession()));

  useEffect(() => {
    let cancelled = false;
    const storedSession = readStoredSession();

    if (!storedSession) {
      setIsCheckingSession(false);
      return undefined;
    }

    async function validateStoredSession(currentSession: MobileAuthSession) {
      try {
        const response = await mobileGetCurrentUser(currentSession.token);

        if (cancelled) {
          return;
        }

        const refreshedSession: MobileAuthSession = {
          ...currentSession,
          user: response.user,
          isAnonymous: normalizeBoolean(response.isAnonymous) || normalizeBoolean(response.user.isAnonymous) || normalizeBoolean(currentSession.isAnonymous),
        };

        persistSession(refreshedSession);
        setSession(refreshedSession);
      } catch {
        if (!cancelled) {
          clearSessionState();
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    }

    void validateStoredSession(storedSession);

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: MobileLoginPayload) => {
    const nextSession = await mobileLogin(payload);
    persistSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const register = useCallback(async (payload: MobileRegisterPayload) => {
    const nextSession = await mobileRegister(payload);
    persistSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const continueAsGuest = useCallback(async (displayName?: string) => {
    const nextSession = await mobileContinueAsGuest(displayName);
    persistSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    const token = session?.token;

    try {
      await mobileLogout(token);
    } catch {
      // Lokalna odjava mora da radi i ako backend trenutno nije dostupan.
    } finally {
      clearSessionState();
      setSession(null);
    }
  }, [session?.token]);

  const updateSessionUser = useCallback((nextUser: MobileUser, nextIsAnonymous?: boolean) => {
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      const refreshedSession: MobileAuthSession = {
        ...currentSession,
        user: nextUser,
        isAnonymous: nextIsAnonymous ?? currentSession.isAnonymous,
      };

      persistSession(refreshedSession);
      return refreshedSession;
    });
  }, []);

  const value = useMemo<MobileAuthContextValue>(() => {
    const anonymous = normalizeBoolean(session?.isAnonymous) || normalizeBoolean(session?.user.isAnonymous);

    return {
      session,
      user: session?.user ?? null,
      isAnonymous: anonymous,
      isAuthenticated: Boolean(session && !anonymous),
      isCheckingSession,
      login,
      register,
      continueAsGuest,
      logout,
      updateSessionUser,
    };
  }, [continueAsGuest, isCheckingSession, login, logout, register, session, updateSessionUser]);

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function useMobileAuth() {
  const auth = useContext(MobileAuthContext);

  if (!auth) {
    throw new Error('useMobileAuth mora biti pozvan unutar MobileAuthProvider-a.');
  }

  return auth;
}
