/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, MenuItem, MenuOption } from '../types';

interface CartCtx {
  cart: CartItem[];
  addToCart: (item: MenuItem, selectedOptions: MenuOption[], note: string, qty: number) => void;
  changeQty: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const Ctx = createContext<CartCtx | null>(null);

function signature(item: MenuItem, options: MenuOption[], note: string): string {
  const optionIds = options.map((option) => option.id).sort().join('-');
  return `${item.id}-${optionIds}-${note.trim().toLowerCase()}`;
}

function pricedItem(item: MenuItem, selectedOptions: MenuOption[], note: string, qty: number): CartItem {
  const unitPrice = item.price + selectedOptions.reduce((sum, option) => sum + (option.priceDelta ?? 0), 0);
  return {
    id: signature(item, selectedOptions, note),
    menuItem: item,
    qty,
    selectedOptions,
    note,
    unitPrice,
    totalPrice: unitPrice * qty,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((item: MenuItem, selectedOptions: MenuOption[], note: string, qty: number) => {
    setCart((prev) => {
      const nextItem = pricedItem(item, selectedOptions, note.trim(), qty);
      const idx = prev.findIndex((cartItem) => cartItem.id === nextItem.id);
      if (idx === -1) return [...prev, nextItem];
      return prev.map((cartItem, index) => {
        if (index !== idx) return cartItem;
        const nextQty = cartItem.qty + qty;
        return { ...cartItem, qty: nextQty, totalPrice: cartItem.unitPrice * nextQty };
      });
    });
  }, []);

  const changeQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((cartItem) => {
          if (cartItem.id !== id) return cartItem;
          const qty = cartItem.qty + delta;
          return { ...cartItem, qty, totalPrice: cartItem.unitPrice * qty };
        })
        .filter((cartItem) => cartItem.qty > 0),
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((cartItem) => cartItem.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const totalPrice = useMemo(() => cart.reduce((sum, item) => sum + item.totalPrice, 0), [cart]);

  return <Ctx.Provider value={{ cart, addToCart, changeQty, removeFromCart, clearCart, totalItems, totalPrice }}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart mora biti unutar <CartProvider>');
  return ctx;
}

