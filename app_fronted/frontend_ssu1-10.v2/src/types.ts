export interface MenuOption {
  id: string;
  label: string;
  priceDelta?: number;
  group?: string;
  required?: boolean;
  minChoices?: number | null;
  maxChoices?: number | null;
}

export interface MenuItem {
  id: string | number;
  cat: string;
  name: string;
  desc: string;
  composition?: string;
  price: number;
  image?: string;
  badge?: string;
  options?: MenuOption[];
}

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  qty: number;
  selectedOptions: MenuOption[];
  note: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Category {
  key: string;
  label: string;
  emoji?: string;
  icon?: string;
}

export type OrderStage = 'sent' | 'approved' | 'preparing' | 'served';

export interface OrderItemStatus {
  cartItemId: string;
  status: 'preparing' | 'served' | 'rejected';
  staffComment?: string;
}

export interface CurrentOrder {
  id?: number;
  items: CartItem[];
  total: number;
  sentAt: string;
  stage: OrderStage;
  etaMinutes?: number;
  itemStatuses: OrderItemStatus[];
}

export type PaymentMethod = 'online-card' | 'cash-waiter' | 'card-waiter';
export type SplitMode = 'all' | 'equal' | 'items';
export type TipValue = 0 | 5 | 10 | 15 | 'custom';

export interface ReservationDraft {
  date?: string;
  dateLabel: string;
  time: string;
  guests: number;
  zone: string;
  name: string;
  phone: string;
  note: string;
  preorder: CartItem[];
  ownerDeposit?: number;
}
