// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import { useEffect, useMemo, useReducer, useRef } from "react";
import type { MenuCategory, MenuItem } from "../../../entities/menu/menu.types";
import type {
  ManualOrderCartItem,
  PendingOrder,
  PendingOrderStatus,
  TableGuest,
  TableOrderLine,
  WaiterActiveShift,
  WaiterAssignedSector,
  WaiterNotification,
  WaiterPaymentMethod,
  WaiterProfile,
  WaiterTable,
  WaiterTableRecord,
  WaiterTableStatus,
} from "../../../entities/waiter/waiter.types";
import type { VenueFloorType, VenueSector } from "../../../entities/venue-map/venueMap.types";
import { useAuth } from "../../auth/AuthProvider";
import { initialVenueFloor } from "../../owner/venue-map/mock/venueMap.mock";
import { WaiterDataContext } from "./WaiterDataContext";
import { closeWaiterTableApi, createWaiterManualOrderApi, getWaiterLiveSnapshot, getWaiterReadonlySnapshot, occupyWaiterTableApi, processWaiterPendingOrderApi, recordWaiterTablePaymentApi, releaseWaiterTableApi, transferWaiterGuestsApi, transferWaiterWholeTableApi } from "./waiterApi";
import { getOrderElapsedSeconds, getSessionPendingTimerStartedAt, isPendingOrderExpired } from "./waiterTime";

type WaiterState = {
  profile: WaiterProfile | null;
  activeShift: WaiterActiveShift | null;
  assignedSector: WaiterAssignedSector | null;
  floor: VenueFloorType;
  sectors: VenueSector[];
  tables: WaiterTableRecord[];
  pendingOrders: PendingOrder[];
  archive: PendingOrder[];
  notifications: WaiterNotification[];
  activeAlert: WaiterNotification | null;
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
};

export type WaiterDataContextValue = {
  profile: WaiterProfile | null;
  activeShift: WaiterActiveShift | null;
  assignedSector: WaiterAssignedSector | null;
  floor: VenueFloorType;
  sectors: VenueSector[];
  tables: WaiterTable[];
  pendingOrders: PendingOrder[];
  archive: PendingOrder[];
  notifications: WaiterNotification[];
  unreadNotificationsCount: number;
  activeAlert: WaiterNotification | null;
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  getTable: (tableId: string | undefined) => WaiterTable | undefined;
  getGuests: (tableId: string) => TableGuest[];
  getTableTotal: (tableId: string) => number;
  getGuestTotal: (guest: TableGuest) => number;
  getStatus: (table: WaiterTableRecord) => WaiterTableStatus;
  addManualOrder: (tableId: string, cart: ManualOrderCartItem[]) => Promise<void>;
  occupyFreeTable: (tableId: string) => Promise<void>;
  transferWholeTable: (sourceId: string, destinationId: string) => Promise<void>;
  transferGuests: (sourceId: string, destinationId: string, guestIds: string[]) => Promise<void>;
  beginSplitPayment: (tableId: string, method?: WaiterPaymentMethod) => void;
  markTablePaid: (tableId: string, method: WaiterPaymentMethod) => Promise<void>;
  markGuestPaid: (tableId: string, guestId: string) => void;
  markSplitItemsPaid: (tableId: string, itemIds: string[], method?: WaiterPaymentMethod) => Promise<void>;
  closeTable: (tableId: string) => Promise<void>;
  releaseTable: (tableId: string) => Promise<void>;
  processPendingOrder: (orderId: string, status: PendingOrderStatus, itemApprovals?: Record<string, boolean>, rejectionReason?: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  dismissActiveAlert: () => void;
};

type Action =
  | { type: "addManualOrder"; tableId: string; cart: ManualOrderCartItem[] }
  | { type: "occupyFreeTable"; tableId: string }
  | { type: "transferWholeTable"; sourceId: string; destinationId: string }
  | { type: "transferGuests"; sourceId: string; destinationId: string; guestIds: string[] }
  | { type: "beginSplitPayment"; tableId: string; method?: WaiterPaymentMethod }
  | { type: "markTablePaid"; tableId: string; method: WaiterPaymentMethod }
  | { type: "markGuestPaid"; tableId: string; guestId: string }
  | { type: "markSplitItemsPaid"; tableId: string; itemIds: string[]; method?: WaiterPaymentMethod }
  | { type: "closeTable"; tableId: string }
  | { type: "releaseTable"; tableId: string }
  | { type: "processPendingOrder"; orderId: string; status: PendingOrderStatus; itemApprovals?: Record<string, boolean> }
  | { type: "expirePendingOrders"; nowMs: number }
  | { type: "clearSectorScopedData" }
  | { type: "resetWaiterData" }
  | { type: "pushNotification"; notification: WaiterNotification }
  | { type: "markNotificationRead"; notificationId: string }
  | { type: "markAllNotificationsRead" }
  | { type: "dismissActiveAlert" }
  | {
      type: "hydrateReadOnly";
      profile?: WaiterProfile | null;
      activeShift?: WaiterActiveShift | null;
      assignedSector?: WaiterAssignedSector | null;
      floor?: VenueFloorType;
      sectors?: VenueSector[];
      tables?: WaiterTableRecord[];
      pendingOrders?: PendingOrder[];
      archive?: PendingOrder[];
      menuCategories?: MenuCategory[];
      menuItems?: MenuItem[];
      nowMs: number;
    };

function lineTotal(item: TableOrderLine) {
  return item.price * item.quantity;
}

function tableTotal(table: Pick<WaiterTableRecord, "guests">) {
  return table.guests.reduce(
    (sum, guest) => sum + guest.items.reduce((guestSum, item) => guestSum + lineTotal(item), 0),
    0,
  );
}

function deriveStatus(table: WaiterTableRecord): WaiterTableStatus {
  if (table.status === "reserved" || table.reservationLabel) {
    return "reserved";
  }

  if (table.status === "payment" || (table.paymentMode && table.guests.length > 0)) {
    return "payment";
  }

  if (table.status === "occupied") {
    return "occupied";
  }

  return table.guests.length > 0 ? "occupied" : "free";
}

function getGuestLabel(table: WaiterTableRecord) {
  if (table.reservationLabel) {
    return table.reservationLabel;
  }

  if (table.guests.length === 0) {
    return undefined;
  }

  if (table.guests.length === 1) {
    return table.guests[0].guestName;
  }

  return `${table.guests.length} gosta`;
}

function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createManualGuest(cart: ManualOrderCartItem[]): TableGuest {
  return {
    id: `manual-${Date.now()}`,
    guestName: "Ručni unos",
    registered: false,
    paid: false,
    items: cart.map((item) => ({
      id: createLineId(),
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      note: item.note || undefined,
      options: item.options,
    })),
  };
}

function applySessionTimers(orders: PendingOrder[], nowMs = Date.now()) {
  return orders.map((order) => ({
    ...order,
    timerStartedAt: getSessionPendingTimerStartedAt(order.elapsedSeconds, nowMs),
  }));
}


function makeInitialState(): WaiterState {
  return {
    profile: null,
    activeShift: null,
    assignedSector: null,
    floor: initialVenueFloor,
    sectors: [],
    tables: [],
    pendingOrders: [],
    archive: [],
    notifications: [],
    activeAlert: null,
    menuCategories: [],
    menuItems: [],
  };
}

const initialState: WaiterState = makeInitialState();

function getChargeDeniedMessage(assignedSector: WaiterAssignedSector | null) {
  return assignedSector
    ? `Mozes da naplatis samo stolove iz sektora ${assignedSector.name}.`
    : "Nemas aktivan sektor za naplatu.";
}

function getManualOrderDeniedMessage(
  activeShift: WaiterActiveShift | null,
  assignedSector: WaiterAssignedSector | null,
) {
  if (!activeShift || !assignedSector) {
    return "Nemaš aktivnu smenu ili dodeljen sektor za ručni unos.";
  }

  return "Ručni unos je dozvoljen samo za stolove iz tvog trenutnog sektora.";
}

function getTransferDeniedMessage(activeShift: WaiterActiveShift | null, assignedSector: WaiterAssignedSector | null) {
  if (!activeShift) {
    return "Nemas aktivnu smenu i ne mozes da premestas stolove.";
  }

  if (!assignedSector) {
    return "Nije ti dodeljen sektor za trenutnu smenu.";
  }

  return "Sto mozes da premestis samo iz svog sektora ili u svoj sektor.";
}

function canTransferTableBetweenSectors(
  sourceTable: WaiterTableRecord | undefined,
  destinationTable: WaiterTableRecord | undefined,
  assignedSector: WaiterAssignedSector | null,
) {
  return Boolean(
    sourceTable
      && destinationTable
      && assignedSector
      && (sourceTable.sectorId === assignedSector.id || destinationTable.sectorId === assignedSector.id),
  );
}

function getOrderNotificationId(order: PendingOrder) {
  return `ORDER_CREATED:${order.id}`;
}

function getPaymentNotificationId(table: WaiterTableRecord) {
  return `PAYMENT_REQUESTED:${table.id}:${table.openedAt ?? "session"}:${table.paymentMode ?? "payment"}`;
}

function makeOrderNotification(order: PendingOrder): WaiterNotification {
  return {
    id: getOrderNotificationId(order),
    type: "ORDER_CREATED",
    tableId: order.tableId,
    tableNumber: order.tableNumber,
    message: `Nova narudzbina - sto ${order.tableNumber}`,
    createdAt: order.createdAt ?? order.timestamp ?? order.timerStartedAt,
    read: false,
  };
}

function makePaymentNotification(table: WaiterTableRecord): WaiterNotification {
  return {
    id: getPaymentNotificationId(table),
    type: "PAYMENT_REQUESTED",
    tableId: table.id,
    tableNumber: table.number,
    message: `Zahtev za naplatu - sto ${table.number}`,
    createdAt: table.openedAt,
    read: false,
  };
}

function updateTable(state: WaiterState, tableId: string, updater: (table: WaiterTableRecord) => WaiterTableRecord) {
  return {
    ...state,
    tables: state.tables.map((table) => (table.id === tableId ? updater(table) : table)),
  };
}

function reducer(state: WaiterState, action: Action): WaiterState {
  switch (action.type) {
    case "addManualOrder":
      return updateTable(state, action.tableId, (table) => ({
        ...table,
        guests: [...table.guests, createManualGuest(action.cart)],
        paymentMode: undefined,
        paymentMethod: undefined,
        openedAt: table.openedAt ?? "sada",
      }));

    case "occupyFreeTable":
      return updateTable(state, action.tableId, (table) => ({
        ...table,
        reservationLabel: undefined,
        paymentMode: undefined,
        paymentMethod: undefined,
        openedAt: table.openedAt ?? "sada",
      }));

    case "transferWholeTable": {
      const source = state.tables.find((table) => table.id === action.sourceId);
      const destination = state.tables.find((table) => table.id === action.destinationId);
      const destinationStatus = destination ? deriveStatus(destination) : undefined;

      if (
        !source ||
        !destination ||
        action.sourceId === action.destinationId ||
        (destinationStatus !== "free" && destinationStatus !== "occupied")
      ) {
        return state;
      }

      const isMergingIntoOccupiedTable = destinationStatus === "occupied";

      return {
        ...state,
        tables: state.tables.map((table) => {
          if (table.id === action.sourceId) {
            return { ...table, guests: [], paymentMode: undefined, paymentMethod: undefined, openedAt: undefined, reservationLabel: undefined };
          }

          if (table.id === action.destinationId) {
            return {
              ...table,
              guests: isMergingIntoOccupiedTable ? [...table.guests, ...source.guests] : source.guests,
              reservationLabel: isMergingIntoOccupiedTable ? table.reservationLabel : source.reservationLabel,
              paymentMode: isMergingIntoOccupiedTable ? table.paymentMode : source.paymentMode,
              paymentMethod: isMergingIntoOccupiedTable ? table.paymentMethod : source.paymentMethod,
              openedAt: table.openedAt ?? source.openedAt ?? "sada",
            };
          }

          return table;
        }),
      };
    }

    case "transferGuests": {
      const source = state.tables.find((table) => table.id === action.sourceId);
      const destination = state.tables.find((table) => table.id === action.destinationId);
      const destinationStatus = destination ? deriveStatus(destination) : undefined;

      if (
        !source ||
        !destination ||
        action.sourceId === action.destinationId ||
        (destinationStatus !== "free" && destinationStatus !== "occupied")
      ) {
        return state;
      }

      const movingGuests = source.guests.filter((guest) => action.guestIds.includes(guest.id));

      if (movingGuests.length === 0) {
        return state;
      }

      return {
        ...state,
        tables: state.tables.map((table) => {
          if (table.id === action.sourceId) {
            const remainingGuests = table.guests.filter((guest) => !action.guestIds.includes(guest.id));
            return {
              ...table,
              guests: remainingGuests,
              paymentMode: remainingGuests.length > 0 ? table.paymentMode : undefined,
              paymentMethod: remainingGuests.length > 0 ? table.paymentMethod : undefined,
              openedAt: remainingGuests.length > 0 ? table.openedAt : undefined,
            };
          }

          if (table.id === action.destinationId) {
            return {
              ...table,
              guests: [...table.guests, ...movingGuests],
              paymentMode: table.paymentMode,
              paymentMethod: table.paymentMethod,
              openedAt: table.openedAt ?? source.openedAt ?? "sada",
            };
          }

          return table;
        }),
      };
    }

    case "beginSplitPayment":
      return updateTable(state, action.tableId, (table) => ({
        ...table,
        paymentMode: table.guests.length > 0 ? "split" : table.paymentMode,
        paymentMethod: action.method ?? table.paymentMethod,
      }));

    case "markTablePaid":
      return updateTable(state, action.tableId, (table) => ({
        ...table,
        paymentMode: table.guests.length > 0 ? (action.method === "card" ? "online" : "cash") : table.paymentMode,
        paymentMethod: action.method,
        guests: table.guests.map((guest) => ({
          ...guest,
          paid: true,
          paidOnline: action.method === "card",
          items: guest.items.map((item) => ({ ...item, paid: true })),
        })),
      }));

    case "markGuestPaid":
      return updateTable(state, action.tableId, (table) => ({
        ...table,
        paymentMode: table.guests.length > 0 ? "split" : table.paymentMode,
        paymentMethod: table.paymentMethod,
        guests: table.guests.map((guest) =>
          guest.id === action.guestId
            ? {
                ...guest,
                paid: true,
                items: guest.items.map((item) => ({ ...item, paid: true })),
              }
            : guest,
        ),
      }));

    case "markSplitItemsPaid":
      return updateTable(state, action.tableId, (table) => {
        const paidItemIds = new Set(action.itemIds);

        if (paidItemIds.size === 0) {
          return {
            ...table,
            paymentMode: table.guests.length > 0 ? "split" : table.paymentMode,
            paymentMethod: action.method ?? table.paymentMethod,
          };
        }

        const guests = table.guests.map((guest) => {
          const items = guest.items.map((item) =>
            paidItemIds.has(item.id) ? { ...item, paid: true } : item,
          );
          const guestFullyPaid = items.length > 0 && items.every((item) => item.paid);

          return {
            ...guest,
            paid: guestFullyPaid,
            items,
          };
        });

        return {
          ...table,
          paymentMode: guests.length > 0 ? "split" : table.paymentMode,
          paymentMethod: action.method ?? table.paymentMethod,
          guests,
        };
      });

    case "closeTable":
    case "releaseTable":
      return updateTable(state, action.tableId, (table) => ({
        ...table,
        guests: [],
        paymentMode: undefined,
        paymentMethod: undefined,
        openedAt: undefined,
        reservationLabel: undefined,
      }));

    case "processPendingOrder": {
      const order = state.pendingOrders.find((pendingOrder) => pendingOrder.id === action.orderId);

      if (!order) {
        return state;
      }

      const archivedItems = order.items.map((item) => ({
        ...item,
        approved: action.itemApprovals
          ? action.itemApprovals[item.id] ?? true
          : action.status === "rejected"
            ? false
            : action.status === "approved"
              ? true
              : item.approved,
      }));

      const processedAt = new Date().toISOString();
      const resolvedElapsedSeconds = getOrderElapsedSeconds({ ...order, processedAt });

      return {
        ...state,
        pendingOrders: state.pendingOrders.filter((pendingOrder) => pendingOrder.id !== action.orderId),
        archive: [
          {
            ...order,
            status: action.status,
            items: archivedItems,
            elapsedSeconds: resolvedElapsedSeconds,
            processedAt,
          },
          ...state.archive,
        ],
        tables: state.tables.map((table) =>
          table.id === order.tableId
            ? { ...table, pendingOrders: Math.max(0, table.pendingOrders - 1) }
            : table,
        ),
      };
    }

    case "expirePendingOrders": {
      const expiredOrders = state.pendingOrders.filter((order) => isPendingOrderExpired(order, action.nowMs));

      if (expiredOrders.length === 0) {
        return state;
      }

      const expiredIds = new Set(expiredOrders.map((order) => order.id));
      const expiredCountsByTable = expiredOrders.reduce<Record<string, number>>((counts, order) => {
        if (order.tableId) {
          counts[order.tableId] = (counts[order.tableId] ?? 0) + 1;
        }

        return counts;
      }, {});
      const expiredAt = new Date(action.nowMs).toISOString();

      return {
        ...state,
        pendingOrders: state.pendingOrders.filter((order) => !expiredIds.has(order.id)),
        archive: [
          ...expiredOrders.map((order) => ({
            ...order,
            status: "expired" as PendingOrderStatus,
            elapsedSeconds: getOrderElapsedSeconds(order, action.nowMs),
            expiredAt,
          })),
          ...state.archive,
        ],
        tables: state.tables.map((table) => {
          const expiredForTable = expiredCountsByTable[table.id] ?? 0;

          if (expiredForTable === 0) {
            return table;
          }

          return {
            ...table,
            pendingOrders: Math.max(0, table.pendingOrders - expiredForTable),
          };
        }),
      };
    }

    case "clearSectorScopedData":
      return {
        ...state,
        pendingOrders: [],
        archive: [],
        notifications: [],
        activeAlert: null,
        tables: state.tables.map((table) => ({
          ...table,
          pendingOrders: 0,
          canCharge: false,
        })),
      };

    case "resetWaiterData":
      return initialState;

    case "pushNotification":
      if (state.notifications.some((notification) => notification.id === action.notification.id)) {
        return state;
      }

      return {
        ...state,
        notifications: [action.notification, ...state.notifications].slice(0, 30),
        activeAlert: action.notification,
      };

    case "markNotificationRead":
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.id === action.notificationId ? { ...notification, read: true } : notification,
        ),
      };

    case "markAllNotificationsRead":
      return {
        ...state,
        notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
      };

    case "dismissActiveAlert":
      return {
        ...state,
        activeAlert: null,
      };

    case "hydrateReadOnly":
      return {
        ...state,
        profile: action.profile !== undefined ? action.profile : state.profile,
        activeShift: action.activeShift !== undefined ? action.activeShift : state.activeShift,
        assignedSector: action.assignedSector !== undefined ? action.assignedSector : state.assignedSector,
        floor: action.floor ?? state.floor,
        sectors: action.sectors !== undefined ? action.sectors : state.sectors,
        tables: action.tables !== undefined ? action.tables : state.tables,
        pendingOrders: action.pendingOrders
          ? applySessionTimers(action.pendingOrders, action.nowMs)
          : state.pendingOrders,
        archive: action.archive ?? state.archive,
        menuCategories: action.menuCategories !== undefined ? action.menuCategories : state.menuCategories,
        menuItems: action.menuItems !== undefined ? action.menuItems : state.menuItems,
      };

    default:
      return state;
  }
}

const WAITER_PROFILE_REFRESH_INTERVAL_MS = 10_000;

type WaiterSnapshot =
  | Awaited<ReturnType<typeof getWaiterReadonlySnapshot>>
  | Awaited<ReturnType<typeof getWaiterLiveSnapshot>>;

export function WaiterDataProvider({ children }: { children: React.ReactNode }) {
  const { session, user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const scopeRef = useRef("none:none");
  const initializedEventsRef = useRef(false);
  const shownEventIdsRef = useRef<Set<string>>(new Set());
  const snapshotRequestRef = useRef<Promise<WaiterSnapshot> | null>(null);
  const waiterIdentityKey = `${user?.id ?? "anonymous"}:${session?.token ?? "no-token"}`;

  useEffect(() => {
    let ignore = false;

    dispatch({ type: "resetWaiterData" });
    scopeRef.current = "none:none";
    initializedEventsRef.current = false;
    shownEventIdsRef.current = new Set();
    snapshotRequestRef.current = null;

    const getScopeKey = (activeShift?: WaiterActiveShift | null, assignedSector?: WaiterAssignedSector | null) =>
      `${activeShift?.id ?? "none"}:${assignedSector?.id ?? "none"}`;

    const refreshSnapshot = async () => {
      const request = snapshotRequestRef.current ?? (
        initializedEventsRef.current
          ? getWaiterLiveSnapshot()
          : getWaiterReadonlySnapshot()
      );

      snapshotRequestRef.current = request;

      try {
        const snapshot = await request;
        const nextScopeKey = getScopeKey(snapshot.activeShift, snapshot.assignedSector);

        if (!ignore && scopeRef.current !== nextScopeKey) {
          scopeRef.current = nextScopeKey;
          dispatch({ type: "clearSectorScopedData" });
        }

        if (!ignore) {
          scopeRef.current = getScopeKey(snapshot.activeShift, snapshot.assignedSector);
          dispatch({ type: "hydrateReadOnly", ...snapshot, nowMs: Date.now() });

          const nextEventIds = [
            ...(snapshot.pendingOrders ?? []).map(getOrderNotificationId),
            ...(snapshot.tables ?? [])
              .filter((table) => table.status === "payment" && table.canCharge)
              .map(getPaymentNotificationId),
          ];

          if (!initializedEventsRef.current) {
            shownEventIdsRef.current = new Set(nextEventIds);
            initializedEventsRef.current = true;
          } else {
            for (const order of snapshot.pendingOrders ?? []) {
              const eventId = getOrderNotificationId(order);

              if (!shownEventIdsRef.current.has(eventId)) {
                shownEventIdsRef.current.add(eventId);
                dispatch({ type: "pushNotification", notification: makeOrderNotification(order) });
              }
            }

            for (const table of snapshot.tables ?? []) {
              if (table.status !== "payment" || !table.canCharge) {
                continue;
              }

              const eventId = getPaymentNotificationId(table);

              if (!shownEventIdsRef.current.has(eventId)) {
                shownEventIdsRef.current.add(eventId);
                dispatch({ type: "pushNotification", notification: makePaymentNotification(table) });
              }
            }
          }
        }
      } catch (error) {
        console.error("[waiter-snapshot] Osvezavanje nije uspelo", error);
      } finally {
        if (snapshotRequestRef.current === request) {
          snapshotRequestRef.current = null;
        }
      }
    };

    void refreshSnapshot();

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshSnapshot();
      }
    }, WAITER_PROFILE_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSnapshot();
      }
    };
    const handleFocus = () => {
      void refreshSnapshot();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      ignore = true;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [waiterIdentityKey]);

  const tables = useMemo<WaiterTable[]>(
    () =>
      state.tables.map((table) => ({
        ...table,
        hasActiveOrder: table.guests.length > 0,
        status: deriveStatus(table),
        guestLabel: getGuestLabel(table),
        currentBill: tableTotal(table),
      })),
    [state.tables],
  );

  const value = useMemo<WaiterDataContextValue>(
    () => ({
      profile: state.profile,
      activeShift: state.activeShift,
      assignedSector: state.assignedSector,
      floor: state.floor,
      sectors: state.sectors,
      tables,
      pendingOrders: state.pendingOrders,
      archive: state.archive,
      notifications: state.notifications,
      unreadNotificationsCount: state.notifications.filter((notification) => !notification.read).length,
      activeAlert: state.activeAlert,
      menuCategories: state.menuCategories,
      menuItems: state.menuItems,
      getTable: (tableId) => tables.find((table) => table.id === tableId),
      getGuests: (tableId) => tables.find((table) => table.id === tableId)?.guests ?? [],
      getTableTotal: (tableId) => tables.find((table) => table.id === tableId)?.currentBill ?? 0,
      getGuestTotal: (guest) => guest.items.reduce((sum, item) => sum + lineTotal(item), 0),
      getStatus: deriveStatus,
      addManualOrder: async (tableId, cart) => {
        const table = state.tables.find((candidate) => candidate.id === tableId);

        if (
          !state.activeShift
          || !state.assignedSector
          || !table
          || table.sectorId !== state.assignedSector.id
        ) {
          throw new Error(getManualOrderDeniedMessage(state.activeShift, state.assignedSector));
        }

        try {
          const result = await createWaiterManualOrderApi(tableId, cart);

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "addManualOrder", tableId, cart });
        } catch (error) {
          throw error;
        }
      },
      occupyFreeTable: async (tableId) => {
        const isLocalMockTable = tableId.startsWith("table-");

        try {
          const result = await occupyWaiterTableApi(tableId);

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "occupyFreeTable", tableId });
        } catch (error) {
          if (isLocalMockTable) {
            dispatch({ type: "occupyFreeTable", tableId });
            return;
          }

          throw error;
        }
      },
      transferWholeTable: async (sourceId, destinationId) => {
        const isLocalMockTransfer = sourceId.startsWith("table-") || destinationId.startsWith("table-");
        const sourceTable = state.tables.find((table) => table.id === sourceId);
        const destinationTable = state.tables.find((table) => table.id === destinationId);

        if (!canTransferTableBetweenSectors(sourceTable, destinationTable, state.assignedSector)) {
          throw new Error(getTransferDeniedMessage(state.activeShift, state.assignedSector));
        }

        try {
          const result = await transferWaiterWholeTableApi(sourceId, destinationId);

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "transferWholeTable", sourceId, destinationId });
        } catch (error) {
          if (isLocalMockTransfer) {
            dispatch({ type: "transferWholeTable", sourceId, destinationId });
            return;
          }

          throw error;
        }
      },
      transferGuests: async (sourceId, destinationId, guestIds) => {
        const isLocalMockTransfer = sourceId.startsWith("table-") || destinationId.startsWith("table-");
        const sourceTable = state.tables.find((table) => table.id === sourceId);
        const destinationTable = state.tables.find((table) => table.id === destinationId);

        if (!canTransferTableBetweenSectors(sourceTable, destinationTable, state.assignedSector)) {
          throw new Error(getTransferDeniedMessage(state.activeShift, state.assignedSector));
        }

        try {
          const result = await transferWaiterGuestsApi(sourceId, destinationId, guestIds);

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "transferGuests", sourceId, destinationId, guestIds });
        } catch (error) {
          if (isLocalMockTransfer) {
            dispatch({ type: "transferGuests", sourceId, destinationId, guestIds });
            return;
          }

          throw error;
        }
      },
      beginSplitPayment: (tableId, method) => dispatch({ type: "beginSplitPayment", tableId, method }),
      markTablePaid: async (tableId, method) => {
        const isLocalMockTable = tableId.startsWith("table-");
        const table = tables.find((item) => item.id === tableId);

        if (!table?.canCharge) {
          throw new Error(getChargeDeniedMessage(state.assignedSector));
        }

        try {
          const result = await recordWaiterTablePaymentApi(tableId, method, "whole");

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "markTablePaid", tableId, method });
        } catch (error) {
          if (isLocalMockTable) {
            dispatch({ type: "markTablePaid", tableId, method });
            return;
          }

          throw error;
        }
      },
      markGuestPaid: (tableId, guestId) => dispatch({ type: "markGuestPaid", tableId, guestId }),
      markSplitItemsPaid: async (tableId, itemIds, method = "cash") => {
        const isLocalMockTable = tableId.startsWith("table-");
        const table = tables.find((item) => item.id === tableId);

        if (!table?.canCharge) {
          throw new Error(getChargeDeniedMessage(state.assignedSector));
        }

        try {
          const result = await recordWaiterTablePaymentApi(tableId, method, "split", itemIds);

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "markSplitItemsPaid", tableId, itemIds, method });
        } catch (error) {
          if (isLocalMockTable) {
            dispatch({ type: "markSplitItemsPaid", tableId, itemIds, method });
            return;
          }

          throw error;
        }
      },
      closeTable: async (tableId) => {
        const isLocalMockTable = tableId.startsWith("table-");
        const table = tables.find((item) => item.id === tableId);

        if (!table?.canCharge) {
          throw new Error(getChargeDeniedMessage(state.assignedSector));
        }

        try {
          const result = await closeWaiterTableApi(tableId);

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "closeTable", tableId });
        } catch (error) {
          if (isLocalMockTable) {
            dispatch({ type: "closeTable", tableId });
            return;
          }

          throw error;
        }
      },
      releaseTable: async (tableId) => {
        const isLocalMockTable = tableId.startsWith("table-");

        try {
          const result = await releaseWaiterTableApi(tableId);

          if (result.tables) {
            dispatch({
              type: "hydrateReadOnly",
              tables: result.tables,
              pendingOrders: result.pendingOrders,
              archive: result.archiveOrders,
              nowMs: Date.now(),
            });
            return;
          }

          dispatch({ type: "releaseTable", tableId });
        } catch (error) {
          if (isLocalMockTable) {
            dispatch({ type: "releaseTable", tableId });
            return;
          }

          throw error;
        }
      },
      processPendingOrder: async (orderId, status, itemApprovals, rejectionReason) => {
        const result = await processWaiterPendingOrderApi(orderId, {
          status,
          itemApprovals,
          rejectionReason,
        });

        if (!result.pendingOrders || !result.archiveOrders) {
          throw new Error("Backend nije vratio usklađenu pending listu i arhivu.");
        }

        dispatch({
          type: "hydrateReadOnly",
          pendingOrders: result.pendingOrders,
          archive: result.archiveOrders,
          nowMs: Date.now(),
        });
      },
      markNotificationRead: (notificationId) => dispatch({ type: "markNotificationRead", notificationId }),
      markAllNotificationsRead: () => dispatch({ type: "markAllNotificationsRead" }),
      dismissActiveAlert: () => dispatch({ type: "dismissActiveAlert" }),
    }),
    [
      state.activeShift,
      state.archive,
      state.assignedSector,
      state.activeAlert,
      state.floor,
      state.menuCategories,
      state.menuItems,
      state.notifications,
      state.pendingOrders,
      state.profile,
      state.sectors,
      state.tables,
      tables,
    ],
  );

  return <WaiterDataContext.Provider value={value}>{children}</WaiterDataContext.Provider>;
}
