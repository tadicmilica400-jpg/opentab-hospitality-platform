// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../shared/api/client";
import type { TableShape, VenueFloorType } from "../../../../entities/venue-map/venueMap.types";

export type ApiVenue = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  floor: VenueFloorType;
  active: boolean | number;
};

export type ApiVenueSector = {
  id: string;
  venue: string;
  name: string;
  emoji: string;
  description: string | null;
  x: number | string | null;
  y: number | string | null;
  width: number | string | null;
  height: number | string | null;
  display_order: number;
  active: boolean | number;
};

export type ApiVenueTable = {
  id: string;
  sector: string;
  number: string;
  seats: number;
  shape: TableShape;
  status: string;
  x: number | string | null;
  y: number | string | null;
  width: number | string | null;
  height: number | string | null;
  qr_code_url: string;
  has_active_order: boolean;
  active: boolean | number;
};

export type ApiVenueMapSnapshot = {
  venue: ApiVenue;
  floor: VenueFloorType;
  sectors: ApiVenueSector[];
  tables: ApiVenueTable[];
};

export type SectorPayload = {
  name?: string;
  emoji?: string;
  icon?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  table_ids?: string[];
  fallback_sector_id?: string;
};

export type TablePayload = {
  sector?: string;
  number?: string;
  seats?: number;
  shape?: TableShape;
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
};

export function getVenueMapSnapshot() {
  return apiGet<ApiVenueMapSnapshot>("/venue-map/");
}

export function updateVenueFloor(floor: VenueFloorType) {
  return apiPatch<ApiVenue>("/venue-map/floor/", { floor });
}

export function createVenueSector(payload: SectorPayload) {
  return apiPost<ApiVenueSector>("/venue-sectors/", payload);
}

export function updateVenueSector(sectorId: string, payload: SectorPayload) {
  return apiPatch<ApiVenueSector>(`/venue-sectors/${sectorId}/`, payload);
}

export function deleteVenueSector(sectorId: string, fallbackSectorId?: string) {
  return apiDelete<{ ok: true }>(`/venue-sectors/${sectorId}/`, {
    fallback_sector_id: fallbackSectorId,
  });
}

export function createVenueTable(payload: TablePayload) {
  return apiPost<ApiVenueTable>("/venue-tables/", payload);
}

export function updateVenueTable(tableId: string, payload: TablePayload) {
  return apiPatch<ApiVenueTable>(`/venue-tables/${tableId}/`, payload);
}

export function deleteVenueTable(tableId: string) {
  return apiDelete<{ ok: true }>(`/venue-tables/${tableId}/`);
}
