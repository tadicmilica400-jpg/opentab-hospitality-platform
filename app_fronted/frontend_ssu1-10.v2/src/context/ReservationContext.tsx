/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, ReservationDraft } from '../types';

interface ReservationCtx {
  reservation: ReservationDraft;
  setReservation: (reservation: ReservationDraft) => void;
  addPreorder: (item: CartItem) => void;
  clearPreorder: () => void;
  removePreorder: (id: string) => void;
  resetReservation: () => void;
}

const RESERVATION_DEPOSIT = 500;
const Ctx = createContext<ReservationCtx | null>(null);

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultReservation(): ReservationDraft {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 1);
  const date = toDateInputValue(nextDate);

  return {
    date,
    dateLabel: date,
    time: '20:30',
    guests: 4,
    zone: 'none',
    name: '',
    phone: '',
    note: '',
    preorder: [],
    ownerDeposit: RESERVATION_DEPOSIT,
  };
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [reservation, setReservation] = useState<ReservationDraft>(() => createDefaultReservation());

  const addPreorder = useCallback((item: CartItem) => {
    setReservation((prev) => {
      const idx = prev.preorder.findIndex((preorderItem) => preorderItem.id === item.id);
      if (idx === -1) return { ...prev, preorder: [...prev.preorder, item] };
      return {
        ...prev,
        preorder: prev.preorder.map((preorderItem, index) => {
          if (index !== idx) return preorderItem;
          const qty = preorderItem.qty + item.qty;
          return { ...preorderItem, qty, totalPrice: preorderItem.unitPrice * qty };
        }),
      };
    });
  }, []);

  const clearPreorder = useCallback(() => {
    setReservation((prev) => ({ ...prev, preorder: [] }));
  }, []);

  const removePreorder = useCallback((id: string) => {
    setReservation((prev) => ({ ...prev, preorder: prev.preorder.filter((item) => item.id !== id) }));
  }, []);

  const resetReservation = useCallback(() => {
    setReservation(createDefaultReservation());
  }, []);

  return <Ctx.Provider value={{ reservation, setReservation, addPreorder, clearPreorder, removePreorder, resetReservation }}>{children}</Ctx.Provider>;
}

export function useReservation(): ReservationCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useReservation mora biti unutar <ReservationProvider>');
  return ctx;
}
