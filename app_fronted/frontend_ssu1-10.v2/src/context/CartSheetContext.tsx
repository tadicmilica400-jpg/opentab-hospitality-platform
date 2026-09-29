/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface CartSheetCtx {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const Ctx = createContext<CartSheetCtx | null>(null);

export function CartSheetProvider({ children }: { children: ReactNode }) {
  const [isCartOpen, setCartOpen] = useState(false);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  return <Ctx.Provider value={{ isCartOpen, openCart, closeCart }}>{children}</Ctx.Provider>;
}

export function useCartSheet(): CartSheetCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCartSheet mora biti unutar <CartSheetProvider>');
  return ctx;
}
