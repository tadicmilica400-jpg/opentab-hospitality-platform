// Autori: Milica Tadić ([student ID omitted], SSU11), Boško Trifunović ([student ID omitted], SSU16-19)
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentUser, loginUser, logoutUser } from "./api/authApi";
import type { LoginPayload } from "./api/authApi";
import {
  clearAuthSession,
  getStoredAuthSession,
  saveAuthSession,
  type AuthSession,
  type AuthUser,
} from "./session/authStorage";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isCheckingSession: boolean;
  login: (payload: LoginPayload) => Promise<AuthSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getStoredAuthSession()));

  useEffect(() => {
    let cancelled = false;
    const storedSession = getStoredAuthSession();

    if (!storedSession) {
      setIsCheckingSession(false);
      return undefined;
    }

    const activeSession = storedSession;

    async function validateSession() {
      try {
        const response = await getCurrentUser();

        if (cancelled) {
          return;
        }

        const refreshedSession: AuthSession = {
          ...activeSession,
          user: response.user,
        };

        saveAuthSession(refreshedSession);
        setSession(refreshedSession);
      } catch {
        if (!cancelled) {
          clearAuthSession();
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const nextSession = await loginUser(payload);
    saveAuthSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Ako backend nije dostupan, lokalna odjava se i dalje mora izvršiti.
    } finally {
      clearAuthSession();
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isCheckingSession,
      login,
      logout,
    }),
    [isCheckingSession, login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("useAuth mora biti pozvan unutar AuthProvider-a.");
  }

  return auth;
}
