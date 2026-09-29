// Autor: Ivana Mušikić ([student ID omitted]) - SSU1-5
//
// Kontekst za aktivnu sesiju stola u mobilnoj aplikaciji.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  mobileGetTableSession,
  mobileLeaveTableSession,
  mobileScanTable,
} from '../api/mobileTableSession';
import type { MobileTableSession } from '../api/mobileTableSession';
import { useMobileAuth } from './MobileAuthContext';

interface TableSessionContextValue {
  tableSession: MobileTableSession | null;
  hasActiveTableSession: boolean;
  isCheckingTableSession: boolean;
  connectTable: (code: string) => Promise<MobileTableSession>;
  refreshTableSession: () => Promise<MobileTableSession | null>;
  leaveTableSession: () => Promise<void>;
}

const TableSessionContext = createContext<TableSessionContextValue | null>(null);
const TABLE_SESSION_REFRESH_INTERVAL_MS = 10_000;

function syncLegacyTableStorage(tableSession: MobileTableSession | null) {
  if (!tableSession) {
    localStorage.removeItem('activeSession');
    localStorage.removeItem('activeTableSessionId');
    localStorage.removeItem('activeTableId');
    localStorage.removeItem('activeTableCode');
    localStorage.removeItem('activeTableLabel');
    localStorage.removeItem('activeVenueName');
    return;
  }

  localStorage.setItem('activeSession', 'true');
  localStorage.setItem('activeTableSessionId', tableSession.id);
  localStorage.setItem('activeTableId', tableSession.table.id);
  localStorage.setItem('activeTableCode', tableSession.table.code || tableSession.table.number);
  localStorage.setItem('activeTableLabel', tableSession.table.label);
  localStorage.setItem('activeVenueName', tableSession.venue.name);
}

export function TableSessionProvider({ children }: { children: ReactNode }) {
  const { session: authSession, continueAsGuest, isCheckingSession } = useMobileAuth();
  const [tableSession, setTableSession] = useState<MobileTableSession | null>(null);
  const [isCheckingTableSession, setIsCheckingTableSession] = useState(false);

  const persistTableSession = useCallback((nextSession: MobileTableSession | null) => {
    setTableSession(nextSession);
    syncLegacyTableStorage(nextSession);
  }, []);

  const refreshTableSession = useCallback(async () => {
    if (!authSession?.token) {
      persistTableSession(null);
      return null;
    }

    const response = await mobileGetTableSession(authSession.token);
    const nextSession = response.active ? response.session : null;
    persistTableSession(nextSession);
    return nextSession;
  }, [authSession?.token, persistTableSession]);

  useEffect(() => {
    let cancelled = false;

    if (isCheckingSession) {
      return undefined;
    }

    if (!authSession?.token) {
      persistTableSession(null);
      return undefined;
    }

    async function loadTableSession(token: string) {
      setIsCheckingTableSession(true);

      try {
        const response = await mobileGetTableSession(token);

        if (!cancelled) {
          persistTableSession(response.active ? response.session : null);
        }
      } catch {
        if (!cancelled) {
          persistTableSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingTableSession(false);
        }
      }
    }

    void loadTableSession(authSession.token);

    return () => {
      cancelled = true;
    };
  }, [authSession?.token, isCheckingSession, persistTableSession]);

  useEffect(() => {
    if (isCheckingSession || !authSession?.token) return undefined;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void refreshTableSession().catch(() => null);
      }
    };
    const refreshTimer = window.setInterval(refresh, TABLE_SESSION_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => refresh();
    const handleFocus = () => refresh();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authSession?.token, isCheckingSession, refreshTableSession]);

  const connectTable = useCallback(
    async (code: string) => {
      const normalizedCode = code.trim();

      if (!normalizedCode) {
        throw new Error('Unesite kod stola.');
      }

      const currentAuthSession = authSession ?? (await continueAsGuest('Gost'));
      const response = await mobileScanTable(currentAuthSession.token, normalizedCode);

      if (!response.session) {
        throw new Error('Sto nije povezan.');
      }

      persistTableSession(response.session);
      return response.session;
    },
    [authSession, continueAsGuest, persistTableSession],
  );

  const leaveTableSession = useCallback(async () => {
    if (authSession?.token) {
      await mobileLeaveTableSession(authSession.token);
    }

    persistTableSession(null);
  }, [authSession?.token, persistTableSession]);

  const value = useMemo<TableSessionContextValue>(() => {
    return {
      tableSession,
      hasActiveTableSession: Boolean(tableSession),
      isCheckingTableSession,
      connectTable,
      refreshTableSession,
      leaveTableSession,
    };
  }, [connectTable, isCheckingTableSession, leaveTableSession, refreshTableSession, tableSession]);

  return <TableSessionContext.Provider value={value}>{children}</TableSessionContext.Provider>;
}

export function useTableSession() {
  const context = useContext(TableSessionContext);

  if (!context) {
    throw new Error('useTableSession mora biti pozvan unutar TableSessionProvider-a.');
  }

  return context;
}
