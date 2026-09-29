// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import type { VenueTable } from "../venue-map/venueMap.types";

export type WaiterTableStatus = "free" | "occupied" | "reserved" | "payment";

export type WaiterPaymentMode = "cash" | "online" | "split" | "empty";
export type WaiterPaymentMethod = "cash" | "card";

export type TableOrderLine = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
  options?: string[];
  paid?: boolean;
  approved?: boolean;
};

export type TableGuest = {
  id: string;
  guestName: string;
  registered: boolean;
  paid: boolean;
  paidOnline?: boolean;
  items: TableOrderLine[];
};

export type WaiterOrderItem = TableOrderLine;
export type WaiterGuestOrder = TableGuest;

export type WaiterSession = {
  id: string;
  username: string;
  fullName: string;
  shiftLabel: string;
  status: "active" | "inactive";
  activeTableIds: string[];
};

export type WaiterVenueProfile = {
  id: string;
  name: string;
  address?: string | null;
  floor?: string | null;
};

export type WaiterProfile = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  staffRole: string;
  status: string;
  venue: WaiterVenueProfile;
};

export type WaiterActiveShift = {
  id: string;
  type: string;
  status: string;
  start: string | null;
  end: string | null;
};

export type WaiterAssignedSector = {
  id: string;
  name: string;
  emoji?: string;
};

export type WaiterTableRecord = VenueTable & {
  status?: WaiterTableStatus;
  sectorName: string;
  sector: string;
  canCharge: boolean;
  guests: TableGuest[];
  pendingOrders: number;
  reservationLabel?: string;
  paymentMode?: WaiterPaymentMode;
  paymentMethod?: WaiterPaymentMethod;
  openedAt?: string;
};

export type WaiterTable = WaiterTableRecord & {
  status: WaiterTableStatus;
  guestLabel?: string;
  currentBill: number;
};

export type PendingOrderStatus = "pending" | "approved" | "rejected" | "partial" | "expired" | "completed";

export type PendingOrder = {
  id: string;
  tableId?: string;
  tableNumber: string;
  sectorName: string;
  guestName: string;
  guestMeta: string;
  elapsedSeconds: number;
  timerStartedAt?: string;
  createdAt?: string;
  timestamp?: string;
  processedAt?: string;
  expiredAt?: string;
  closedAt?: string;
  paidAt?: string;
  status: PendingOrderStatus;
  items: TableOrderLine[];
};

export type WaiterNotificationType = "ORDER_CREATED" | "PAYMENT_REQUESTED";

export type WaiterNotification = {
  id: string;
  type: WaiterNotificationType;
  tableId?: string;
  tableNumber: string;
  message: string;
  createdAt?: string;
  read: boolean;
};



export type WaiterReservationStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "no_show";

export type WaiterReservationRequest = {
  id: string;
  guestId: string;
  guestName: string;
  guestMeta: string;
  status: WaiterReservationStatus;
  tableId: string;
  tableNumber: string;
  sectorId: string;
  sectorName: string;
  numberOfPeople: number;
  startsAt: string;
  endsAt: string;
  dateLabel: string;
  timeLabel: string;
  endsAtLabel: string;
  depositAmount: number;
  preorderTotal: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ManualOrderCartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  options: string[];
  note: string;
};
