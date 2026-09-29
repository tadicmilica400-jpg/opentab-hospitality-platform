/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastScope = 'reservation' | 'silent';

interface ToastState {
  msg: string;
  kind: ToastKind;
  scope: ToastScope;
  show: boolean;
}

interface ToastCtx {
  showToast: (kind: ToastKind, msg: string, scope?: ToastScope) => void;
  toast: ToastState;
}

const Ctx = createContext<ToastCtx | null>(null);
const hiddenToast: ToastState = { msg: '', kind: 'info', scope: 'silent', show: false };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(hiddenToast);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback((kind: ToastKind, msg: string, scope: ToastScope = 'silent') => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setToast({ kind, msg, scope, show: true });
    timerRef.current = window.setTimeout(() => {
      setToast(hiddenToast);
      timerRef.current = null;
    }, kind === 'error' ? 4200 : 2800);
  }, []);

  return <Ctx.Provider value={{ showToast, toast }}>{children}</Ctx.Provider>;
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast mora biti unutar <ToastProvider>');
  return ctx;
}
