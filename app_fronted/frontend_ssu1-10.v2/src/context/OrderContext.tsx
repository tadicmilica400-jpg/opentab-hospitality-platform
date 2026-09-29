/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { CurrentOrder, OrderStage } from '../types';

interface OrderCtx {
  currentOrder: CurrentOrder | null;
  setCurrentOrder: (order: CurrentOrder | null) => void;
  updateStage: (stage: OrderStage) => void;
}

const Ctx = createContext<OrderCtx | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null);

  const updateStage = useCallback((stage: OrderStage) => {
    setCurrentOrder((order) => (order ? { ...order, stage } : order));
  }, []);

  return <Ctx.Provider value={{ currentOrder, setCurrentOrder, updateStage }}>{children}</Ctx.Provider>;
}

export function useOrder(): OrderCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrder mora biti unutar <OrderProvider>');
  return ctx;
}

