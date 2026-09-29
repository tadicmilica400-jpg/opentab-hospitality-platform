export type OrderStatus = "pending" | "approved" | "partial" | "rejected";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
  approved?: boolean;
};

export type PendingOrder = {
  id: string;
  tableId: string;
  tableNumber: string;
  source: "qr" | "waiter";
  status: OrderStatus;
  receivedAt: string;
  guestNote?: string;
  items: OrderItem[];
};

export type MenuOrderItem = OrderItem & {
  category: "food" | "drink" | "dessert";
};

export type TableOrderLine = {
  id: string;
  guestId: string;
  guestName: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
  paid?: boolean;
};

export type TableActiveOrder = {
  tableId: string;
  lines: TableOrderLine[];
};
