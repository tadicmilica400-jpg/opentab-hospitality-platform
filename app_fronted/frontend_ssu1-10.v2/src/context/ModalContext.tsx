/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { MenuItem } from '../types';

export type ItemSheetMode = 'cart' | 'preorder';

interface ModalCtx {
  item: MenuItem | null;
  mode: ItemSheetMode;
  openItem: (item: MenuItem, mode?: ItemSheetMode) => void;
  closeItem: () => void;
}

const Ctx = createContext<ModalCtx | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<MenuItem | null>(null);
  const [mode, setMode] = useState<ItemSheetMode>('cart');

  const openItem = useCallback((nextItem: MenuItem, nextMode: ItemSheetMode = 'cart') => {
    setMode(nextMode);
    setItem(nextItem);
  }, []);

  const closeItem = useCallback(() => setItem(null), []);

  return <Ctx.Provider value={{ item, mode, openItem, closeItem }}>{children}</Ctx.Provider>;
}

export function useModal(): ModalCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useModal mora biti unutar <ModalProvider>');
  return ctx;
}
