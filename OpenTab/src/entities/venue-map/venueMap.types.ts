// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
export type VenueFloorType = "parket" | "plocice" | "beton";

export type TableShape = "round" | "square" | "rectangle";

export type VenueSector = {
  id: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
};

export type VenueTable = {
  id: string;
  sectorId: string;
  number: string;
  seats: number;
  shape: TableShape;
  x: number;
  y: number;
  qrCodeUrl: string;
  hasActiveOrder: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TableFormValues = {
  sectorId: string;
  number: string;
  seats: number;
  shape: TableShape;
};

export type SectorMutationValues = {
  name: string;
  icon: string;
  tableIds: string[];
};

export type VenueMapSnapshot = {
  sectors: VenueSector[];
  tables: VenueTable[];
  floor: VenueFloorType;
};