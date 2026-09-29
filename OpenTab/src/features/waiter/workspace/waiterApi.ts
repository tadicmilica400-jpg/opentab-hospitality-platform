// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import type { MenuCategory, MenuItem } from "../../../entities/menu/menu.types";
import type { RevenuePoint, TopMenuItemAnalytics } from "../../../entities/analytics/analytics.types";
import type { StaffDetailsData } from "../../../entities/staff/staff-details.types";
import type { VenueFloorType, VenueSector } from "../../../entities/venue-map/venueMap.types";
import type {
  ManualOrderCartItem,
  PendingOrder,
  WaiterReservationRequest,
  WaiterReservationStatus,
  WaiterActiveShift,
  WaiterAssignedSector,
  WaiterProfile,
  WaiterTableRecord,
  WaiterTableStatus,
} from "../../../entities/waiter/waiter.types";
import { apiGet, apiPost, isApiNetworkError } from "../../../shared/api/client";

type WaiterVenueMapResponse = {
  floor?: VenueFloorType;
  sectors?: Array<Partial<VenueSector> & { display_order?: number; active?: boolean }>;
};

export type WaiterMeResponse = {
  profile?: WaiterProfile;
  activeShift?: WaiterActiveShift | null;
  sector?: WaiterAssignedSector | null;
  activeTableIds?: string[];
};

type WaiterTablesResponse = {
  tables?: ApiWaiterTable[];
};

type WaiterPendingOrdersResponse = {
  pendingOrders?: PendingOrder[];
};

type WaiterArchiveOrdersResponse = {
  archiveOrders?: PendingOrder[];
};

type WaiterOrdersResponse = WaiterPendingOrdersResponse & WaiterArchiveOrdersResponse;

type WaiterReservationsResponse = {
  reservations?: WaiterReservationRequest[];
};

type ProcessWaiterReservationResponse = WaiterReservationsResponse & {
  reservation?: WaiterReservationRequest;
};

type ProcessPendingOrderPayload = {
  status: PendingOrder["status"];
  itemApprovals?: Record<string, boolean>;
  rejectionReason?: string;
};

type WaiterTableMutationResponse = {
  tables?: ApiWaiterTable[];
  pendingOrders?: PendingOrder[];
  archiveOrders?: PendingOrder[];
};

type TransferTableResponse = WaiterTableMutationResponse;

type NormalizedWaiterTableMutationResponse = Omit<WaiterTableMutationResponse, "tables"> & {
  tables?: WaiterTableRecord[];
};

type ProcessPendingOrderResponse = {
  order?: {
    id: string;
    // Backend vraća DB status, npr. "in_preparation" za odobrenu narudžbinu.
    // UI archive i dalje koristi PendingOrder status koji šaljemo iz akcije.
    status: string;
    approvedAt?: string;
    itemStatuses?: Record<string, string>;
  };
  pendingOrders?: PendingOrder[];
  archiveOrders?: PendingOrder[];
};

type WaiterMenuResponse = {
  categories?: ApiMenuCategory[];
  items?: ApiMenuItem[];
};

export type WaiterPerformanceResponse = {
  workerId?: string;
  details?: StaffDetailsData;
  summary?: {
    revenue?: number;
    ordersCount?: number;
    tablesCount?: number;
    averageRating?: number;
    averageBill?: number;
  };
  points?: RevenuePoint[];
  topItems?: TopMenuItemAnalytics[];
  goals?: StaffDetailsData["goals"];
};

export type WaiterShiftResponse = {
  id: string;
  type?: string;
  status?: string;
  sector?: string | null;
  start?: string | null;
  end?: string | null;
  startLabel?: string | null;
  endLabel?: string | null;
  note?: string | null;
};

type WaiterShiftsResponse = {
  shifts?: WaiterShiftResponse[];
};

type ApiWaiterTable = Partial<WaiterTableRecord> & {
  id: string;
  sectorId: string;
  sectorName?: string;
  sector?: string;
  number: string;
  seats: number;
  shape: WaiterTableRecord["shape"];
  status?: WaiterTableStatus;
  x?: number;
  y?: number;
  qr_code_url?: string;
  qrCodeUrl?: string;
};

type ApiMenuCategory = Partial<MenuCategory> & {
  active?: boolean | number;
};

type ApiMenuItem = Partial<MenuItem> & {
  category?: string;
  active?: boolean | number;
  available?: boolean | number;
  image?: string;
  option_groups?: Array<{
    id: string;
    name: string;
    options?: Array<{ id: string; name: string; extra_price?: number; priceDelta?: number }>;
  }>;
};

export class WaiterBackendUnavailableError extends Error {
  constructor() {
    super("Waiter backend nije dostupan.");
    this.name = "WaiterBackendUnavailableError";
  }
}

export function isWaiterBackendUnavailableError(error: unknown) {
  return error instanceof WaiterBackendUnavailableError;
}

const now = () => new Date().toISOString();

function normalizeSector(sector: Partial<VenueSector> & { id?: string; name?: string }): VenueSector | null {
  if (!sector.id || !sector.name) {
    return null;
  }

  return {
    id: sector.id,
    name: sector.name,
    emoji: sector.emoji ?? "",
    x: Number(sector.x ?? 0),
    y: Number(sector.y ?? 0),
    width: Number(sector.width ?? 0),
    height: Number(sector.height ?? 0),
    createdAt: sector.createdAt ?? now(),
    updatedAt: sector.updatedAt ?? now(),
  };
}

function normalizeTable(table: ApiWaiterTable): WaiterTableRecord {
  const sectorName = table.sectorName ?? table.sector ?? "Nepoznat sektor";

  return {
    id: table.id,
    sectorId: table.sectorId,
    sectorName,
    sector: sectorName,
    number: table.number,
    seats: table.seats,
    shape: table.shape,
    status: table.status,
    canCharge: table.canCharge === true,
    x: Number(table.x ?? 0),
    y: Number(table.y ?? 0),
    qrCodeUrl: table.qrCodeUrl ?? table.qr_code_url ?? "",
    hasActiveOrder: Boolean(table.hasActiveOrder ?? table.guests?.length),
    createdAt: table.createdAt ?? now(),
    updatedAt: table.updatedAt ?? now(),
    guests: table.guests ?? [],
    pendingOrders: Number(table.pendingOrders ?? 0),
    reservationLabel: table.reservationLabel,
    paymentMode: table.paymentMode,
    paymentMethod: table.paymentMethod,
    openedAt: table.openedAt,
  };
}

function normalizeMutationResponse(response: WaiterTableMutationResponse): NormalizedWaiterTableMutationResponse {
  return {
    ...response,
    tables: response.tables?.map(normalizeTable),
  };
}

function normalizeMenuCategory(category: ApiMenuCategory): MenuCategory | null {
  if (!category.id || !category.name) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji ?? "",
    active: Boolean(category.active),
    createdAt: category.createdAt ?? now(),
    updatedAt: category.updatedAt ?? now(),
  };
}

function getOptionPriceDelta(option: { priceDelta?: number; extra_price?: number }) {
  return Number(option.priceDelta ?? option.extra_price ?? 0);
}

function normalizeMenuItem(item: ApiMenuItem): MenuItem | null {
  if (!item.id || !item.name || !item.category) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    composition: item.composition ?? "",
    price: Number(item.price ?? 0),
    categoryId: item.categoryId ?? item.category,
    status: item.active && item.available !== false ? "active" : "inactive",
    imageUrl: item.imageUrl ?? item.image ?? "",
    optionGroups: (item.optionGroups ?? item.option_groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      options: (group.options ?? []).map((option) => ({
        id: option.id,
        name: option.name,
        priceDelta: getOptionPriceDelta(option),
      })),
    })),
    createdAt: item.createdAt ?? now(),
    updatedAt: item.updatedAt ?? now(),
  };
}

export async function getWaiterReadonlySnapshot() {
  const [meResult, venueMapResult, tablesResult, ordersResult, menuResult] = await Promise.allSettled([
    apiGet<WaiterMeResponse>("/waiter/me/"),
    apiGet<WaiterVenueMapResponse>("/waiter/venue-map/"),
    apiGet<WaiterTablesResponse>("/waiter/tables/"),
    apiGet<WaiterOrdersResponse>("/waiter/orders/"),
    apiGet<WaiterMenuResponse>("/waiter/menu/"),
  ]);

  const results = [meResult, venueMapResult, tablesResult, ordersResult, menuResult];

  if (results.every((result) => result.status === "rejected")) {
    const reasons = results.map((result) => result.status === "rejected" ? result.reason : undefined);

    if (reasons.every(isApiNetworkError)) {
      throw new WaiterBackendUnavailableError();
    }

    throw reasons.find((reason) => reason instanceof Error) ?? new Error("Waiter API nije vratio podatke.");
  }

  const mePayload = meResult.status === "fulfilled" ? meResult.value : {};
  const venueMap = venueMapResult.status === "fulfilled" ? venueMapResult.value : {};
  const tablesPayload = tablesResult.status === "fulfilled" ? tablesResult.value : { tables: [] };
  const ordersPayload = ordersResult.status === "fulfilled"
    ? ordersResult.value
    : { pendingOrders: [], archiveOrders: [] };
  const menuPayload = menuResult.status === "fulfilled" ? menuResult.value : { categories: [], items: [] };

  return {
    profile: mePayload.profile ?? null,
    activeShift: mePayload.activeShift ?? null,
    assignedSector: mePayload.sector ?? null,
    floor: venueMap.floor,
    sectors: venueMap.sectors?.map(normalizeSector).filter((sector): sector is VenueSector => Boolean(sector)),
    tables: tablesPayload.tables?.map(normalizeTable),
    pendingOrders: ordersPayload.pendingOrders,
    archive: ordersPayload.archiveOrders,
    menuCategories: menuPayload.categories?.map(normalizeMenuCategory).filter((category): category is MenuCategory => Boolean(category)),
    menuItems: menuPayload.items?.map(normalizeMenuItem).filter((item): item is MenuItem => Boolean(item)),
  };
}

export async function getWaiterLiveSnapshot() {
  const [meResult, venueMapResult, tablesResult, ordersResult] = await Promise.allSettled([
    apiGet<WaiterMeResponse>("/waiter/me/"),
    apiGet<WaiterVenueMapResponse>("/waiter/venue-map/"),
    apiGet<WaiterTablesResponse>("/waiter/tables/"),
    apiGet<WaiterOrdersResponse>("/waiter/orders/"),
  ]);

  const results = [meResult, venueMapResult, tablesResult, ordersResult];

  if (results.every((result) => result.status === "rejected")) {
    const reasons = results.map((result) => result.status === "rejected" ? result.reason : undefined);

    if (reasons.every(isApiNetworkError)) {
      throw new WaiterBackendUnavailableError();
    }

    throw reasons.find((reason) => reason instanceof Error) ?? new Error("Waiter API nije vratio podatke.");
  }

  const mePayload = meResult.status === "fulfilled" ? meResult.value : {};
  const venueMap = venueMapResult.status === "fulfilled" ? venueMapResult.value : {};
  const tablesPayload = tablesResult.status === "fulfilled" ? tablesResult.value : { tables: [] };
  const ordersPayload = ordersResult.status === "fulfilled"
    ? ordersResult.value
    : { pendingOrders: [], archiveOrders: [] };

  return {
    profile: mePayload.profile ?? null,
    activeShift: mePayload.activeShift ?? null,
    assignedSector: mePayload.sector ?? null,
    floor: venueMap.floor,
    sectors: venueMap.sectors?.map(normalizeSector).filter((sector): sector is VenueSector => Boolean(sector)),
    tables: tablesPayload.tables?.map(normalizeTable),
    pendingOrders: ordersPayload.pendingOrders,
    archive: ordersPayload.archiveOrders,
  };
}

export function getWaiterMeApi() {
  return apiGet<WaiterMeResponse>("/waiter/me/");
}

export function getWaiterOrdersApi() {
  return apiGet<WaiterOrdersResponse>("/waiter/orders/");
}

export function getWaiterPerformanceApi() {
  return apiGet<WaiterPerformanceResponse>("/waiter/performance/");
}

export async function getWaiterShiftsApi() {
  const response = await apiGet<WaiterShiftsResponse | WaiterShiftResponse[]>("/waiter/shifts/");

  return Array.isArray(response) ? response : response.shifts ?? [];
}


export function getWaiterPendingReservationsApi() {
  return apiGet<WaiterReservationsResponse>("/waiter/reservations/pending/");
}

export function processWaiterReservationApi(reservationId: string, status: Extract<WaiterReservationStatus, "confirmed" | "rejected">) {
  return apiPost<ProcessWaiterReservationResponse>(`/waiter/reservations/${reservationId}/process/`, { status });
}

export function processWaiterPendingOrderApi(orderId: string, payload: ProcessPendingOrderPayload) {
  return apiPost<ProcessPendingOrderResponse>(`/waiter/orders/pending/${orderId}/process/`, payload);
}

export async function transferWaiterWholeTableApi(sourceTableId: string, targetTableId: string) {
  const response = await apiPost<TransferTableResponse>("/waiter/tables/transfer/", {
    source_table_id: sourceTableId,
    target_table_id: targetTableId,
    mode: "whole",
  });

  return normalizeMutationResponse(response);
}

export async function transferWaiterGuestsApi(sourceTableId: string, targetTableId: string, guestIds: string[]) {
  const response = await apiPost<TransferTableResponse>("/waiter/tables/transfer/", {
    source_table_id: sourceTableId,
    target_table_id: targetTableId,
    mode: "guest",
    table_guest_ids: guestIds,
  });

  return normalizeMutationResponse(response);
}


export async function occupyWaiterTableApi(tableId: string) {
  return normalizeMutationResponse(
    await apiPost<WaiterTableMutationResponse>(`/waiter/tables/${tableId}/occupy/`, {}),
  );
}

export async function releaseWaiterTableApi(tableId: string) {
  return normalizeMutationResponse(
    await apiPost<WaiterTableMutationResponse>(`/waiter/tables/${tableId}/release/`, {}),
  );
}

export async function recordWaiterTablePaymentApi(
  tableId: string,
  method: "cash" | "card",
  mode: "whole" | "split",
  itemIds: string[] = [],
) {
  return normalizeMutationResponse(
    await apiPost<WaiterTableMutationResponse>(`/waiter/tables/${tableId}/payments/`, {
      method,
      mode,
      item_ids: itemIds,
    }),
  );
}

export async function closeWaiterTableApi(tableId: string) {
  return normalizeMutationResponse(
    await apiPost<WaiterTableMutationResponse>(`/waiter/tables/${tableId}/close/`, {}),
  );
}

export async function createWaiterManualOrderApi(tableId: string, items: ManualOrderCartItem[]) {
  return normalizeMutationResponse(
    await apiPost<WaiterTableMutationResponse>(`/waiter/tables/${tableId}/orders/`, {
      items,
    }),
  );
}
