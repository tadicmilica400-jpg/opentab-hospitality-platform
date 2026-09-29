// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SectorMutationValues,
  TableFormValues,
  VenueFloorType,
  VenueMapSnapshot,
  VenueSector,
  VenueTable,
} from "../../../../entities/venue-map/venueMap.types";
import type { ActionResult } from "../../../../shared/types/action.types";
import {
  createVenueSector,
  createVenueTable,
  deleteVenueSector,
  deleteVenueTable,
  getVenueMapSnapshot,
  updateVenueFloor,
  updateVenueSector,
  updateVenueTable,
  type ApiVenueMapSnapshot,
  type ApiVenueSector,
  type ApiVenueTable,
} from "../api/venueMapApi";
import { getTableDimensions } from "../utils/tableGeometry";

type AsyncActionResult = Promise<ActionResult>;

const emptySnapshot: VenueMapSnapshot = {
  sectors: [],
  tables: [],
  floor: "parket",
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getNextTablePosition(tablesInSector: VenueTable[]) {
  const index = tablesInSector.length;
  const column = index % 4;
  const row = Math.floor(index / 4);

  return {
    x: 24 + column * 130,
    y: 24 + row * 112,
  };
}

function cloneSnapshot(snapshot: VenueMapSnapshot): VenueMapSnapshot {
  return {
    floor: snapshot.floor,
    sectors: snapshot.sectors.map((sector) => ({ ...sector })),
    tables: snapshot.tables.map((table) => ({ ...table })),
  };
}

function mapApiSector(sector: ApiVenueSector): VenueSector {
  const now = new Date().toISOString();

  return {
    id: sector.id,
    name: sector.name,
    emoji: sector.emoji || "☷",
    x: toNumber(sector.x, 40),
    y: toNumber(sector.y, 40),
    width: toNumber(sector.width, 520),
    height: toNumber(sector.height, 300),
    createdAt: now,
    updatedAt: now,
  };
}

function mapApiTable(table: ApiVenueTable): VenueTable {
  const now = new Date().toISOString();

  return {
    id: table.id,
    sectorId: table.sector,
    number: table.number,
    seats: table.seats,
    shape: table.shape,
    x: toNumber(table.x, 24),
    y: toNumber(table.y, 24),
    qrCodeUrl: table.qr_code_url,
    hasActiveOrder: table.has_active_order,
    createdAt: now,
    updatedAt: now,
  };
}

function mapApiSnapshot(snapshot: ApiVenueMapSnapshot): VenueMapSnapshot {
  return {
    floor: snapshot.floor,
    sectors: snapshot.sectors.map(mapApiSector),
    tables: snapshot.tables.map(mapApiTable),
  };
}

function clampTableToSector(table: VenueTable, sector: VenueSector) {
  const dimensions = getTableDimensions(table.shape);
  const maxX = Math.max(0, sector.width - dimensions.width - 24);
  const maxY = Math.max(0, sector.height - dimensions.height - 74);

  return {
    ...table,
    x: Math.max(0, Math.min(table.x, maxX)),
    y: Math.max(0, Math.min(table.y, maxY)),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useVenueMap() {
  const [snapshot, setSnapshot] = useState<VenueMapSnapshot>(cloneSnapshot(emptySnapshot));
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<VenueMapSnapshot>(cloneSnapshot(emptySnapshot));
  const [pastSnapshots, setPastSnapshots] = useState<VenueMapSnapshot[]>([]);
  const [futureSnapshots, setFutureSnapshots] = useState<VenueMapSnapshot[]>([]);
  const [venueName, setVenueName] = useState("Lokal");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const interactionLockedRef = useRef(false);

  const applySnapshot = (nextSnapshot: VenueMapSnapshot, resetHistory = false) => {
    const clonedSnapshot = cloneSnapshot(nextSnapshot);

    setSnapshot(clonedSnapshot);
    setLastSavedSnapshot(cloneSnapshot(clonedSnapshot));
    interactionLockedRef.current = false;

    if (resetHistory) {
      setPastSnapshots([]);
      setFutureSnapshots([]);
    }
  };

  const loadSnapshot = async (resetHistory = true) => {
    const apiSnapshot = await getVenueMapSnapshot();
    const nextSnapshot = mapApiSnapshot(apiSnapshot);

    setVenueName(apiSnapshot.venue.name || "Lokal");
    applySnapshot(nextSnapshot, resetHistory);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSnapshot() {
      try {
        setIsLoading(true);
        setError(null);

        const apiSnapshot = await getVenueMapSnapshot();

        if (cancelled) {
          return;
        }

        setVenueName(apiSnapshot.venue.name || "Lokal");
        applySnapshot(mapApiSnapshot(apiSnapshot), true);
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Nije moguće učitati mapu lokala."));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitialSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  const counters = useMemo(() => {
    const activeOrders = snapshot.tables.filter((table) => table.hasActiveOrder).length;

    return {
      sectors: snapshot.sectors.length,
      tables: snapshot.tables.length,
      activeOrders,
    };
  }, [snapshot]);

  const pushHistorySnapshot = (historySnapshot: VenueMapSnapshot) => {
    setPastSnapshots((currentPastSnapshots) => {
      const nextPastSnapshots = [...currentPastSnapshots, cloneSnapshot(historySnapshot)];

      return nextPastSnapshots.length > 50
        ? nextPastSnapshots.slice(nextPastSnapshots.length - 50)
        : nextPastSnapshots;
    });

    setFutureSnapshots([]);
  };

  const commitSnapshot = (nextSnapshot: VenueMapSnapshot, pushHistory = true) => {
    if (pushHistory) {
      pushHistorySnapshot(snapshot);
    }

    setSnapshot(cloneSnapshot(nextSnapshot));
  };

  const getSectorById = (sectorId: string) =>
    snapshot.sectors.find((sector) => sector.id === sectorId) ?? null;

  const getTablesBySectorId = (sectorId: string) =>
    snapshot.tables.filter((table) => table.sectorId === sectorId);

  const tableNumberExists = (sectorId: string, number: string, ignoredTableId?: string) =>
    snapshot.tables.some(
      (table) =>
        table.id !== ignoredTableId &&
        table.sectorId === sectorId &&
        table.number.trim().toLowerCase() === number.trim().toLowerCase(),
    );

  const sectorNameExists = (name: string, ignoredSectorId?: string) =>
    snapshot.sectors.some(
      (sector) =>
        sector.id !== ignoredSectorId &&
        sector.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  const beginHistoryStep = () => {
    if (interactionLockedRef.current) {
      return;
    }

    pushHistorySnapshot(snapshot);
    interactionLockedRef.current = true;
  };

  const endHistoryStep = () => {
    interactionLockedRef.current = false;
  };

  const setFloor = (nextFloor: VenueFloorType) => {
    if (snapshot.floor === nextFloor) {
      return;
    }

    commitSnapshot({
      ...snapshot,
      floor: nextFloor,
    });
  };

  const createSector = async (values: SectorMutationValues): AsyncActionResult => {
    const normalizedName = normalizeText(values.name);
    const normalizedIcon = values.icon.trim() || "☷";

    if (!normalizedName) {
      return { ok: false, message: "Naziv sektora je obavezno polje." };
    }

    if (sectorNameExists(normalizedName)) {
      return { ok: false, message: "Sektor sa ovim nazivom već postoji." };
    }

    try {
      await createVenueSector({
        name: normalizedName,
        emoji: normalizedIcon,
        table_ids: values.tableIds,
      });
      await loadSnapshot(true);

      return { ok: true };
    } catch (createError) {
      return { ok: false, message: getErrorMessage(createError, "Sektor nije sačuvan.") };
    }
  };

  const updateSector = async (sectorId: string, values: SectorMutationValues): AsyncActionResult => {
    const normalizedName = normalizeText(values.name);
    const normalizedIcon = values.icon.trim() || "☷";

    if (!normalizedName) {
      return { ok: false, message: "Naziv sektora je obavezno polje." };
    }

    const currentSector = snapshot.sectors.find((sector) => sector.id === sectorId);

    if (!currentSector) {
      return { ok: false, message: "Sektor nije pronađen." };
    }

    if (sectorNameExists(normalizedName, sectorId)) {
      return { ok: false, message: "Sektor sa ovim nazivom već postoji." };
    }

    const fallbackSector = snapshot.sectors.find((sector) => sector.id !== sectorId);

    try {
      await updateVenueSector(sectorId, {
        name: normalizedName,
        emoji: normalizedIcon,
        x: currentSector.x,
        y: currentSector.y,
        width: currentSector.width,
        height: currentSector.height,
        table_ids: values.tableIds,
        fallback_sector_id: fallbackSector?.id,
      });
      await loadSnapshot(true);

      return { ok: true };
    } catch (updateError) {
      return { ok: false, message: getErrorMessage(updateError, "Sektor nije ažuriran.") };
    }
  };

  const deleteSector = async (sectorId: string): AsyncActionResult => {
    const targetSector = snapshot.sectors.find((sector) => sector.id === sectorId);

    if (!targetSector) {
      return { ok: false, message: "Sektor nije pronađen." };
    }

    if (snapshot.sectors.length === 1) {
      return { ok: false, message: "Ne možete obrisati jedini sektor u lokalu." };
    }

    const sectorTables = snapshot.tables.filter((table) => table.sectorId === sectorId);
    const hasBlockedTable = sectorTables.some((table) => table.hasActiveOrder);

    if (hasBlockedTable) {
      return {
        ok: false,
        message: "Sektor sadrži sto sa aktivnom narudžbinom. Prvo zatvorite sto.",
      };
    }

    const fallbackSector = snapshot.sectors.find((sector) => sector.id !== sectorId);

    if (!fallbackSector) {
      return { ok: false, message: "Nije pronađen rezervni sektor za premeštanje stolova." };
    }

    try {
      await deleteVenueSector(sectorId, fallbackSector.id);
      await loadSnapshot(true);

      return { ok: true };
    } catch (deleteError) {
      return { ok: false, message: getErrorMessage(deleteError, "Sektor nije obrisan.") };
    }
  };

  const createTable = async (values: TableFormValues): AsyncActionResult => {
    const normalizedNumber = normalizeText(values.number);

    if (!values.sectorId) {
      return { ok: false, message: "Sektor je obavezno polje." };
    }

    if (!normalizedNumber) {
      return { ok: false, message: "Broj stola je obavezno polje." };
    }

    const targetSector = snapshot.sectors.find((sector) => sector.id === values.sectorId);

    if (!targetSector) {
      return { ok: false, message: "Izabrani sektor ne postoji." };
    }

    if (tableNumberExists(values.sectorId, normalizedNumber)) {
      return { ok: false, message: "Broj ovog stola već postoji u ovom sektoru." };
    }

    if (!Number.isFinite(values.seats) || values.seats < 1 || values.seats > 12) {
      return { ok: false, message: "Broj mesta mora biti između 1 i 12." };
    }

    const position = getNextTablePosition(snapshot.tables.filter((table) => table.sectorId === values.sectorId));
    const nextTable = clampTableToSector(
      {
        id: "preview",
        sectorId: values.sectorId,
        number: normalizedNumber,
        seats: values.seats,
        shape: values.shape,
        x: position.x,
        y: position.y,
        qrCodeUrl: "",
        hasActiveOrder: false,
        createdAt: "",
        updatedAt: "",
      },
      targetSector,
    );

    try {
      await createVenueTable({
        sector: values.sectorId,
        number: normalizedNumber,
        seats: values.seats,
        shape: values.shape,
        x: nextTable.x,
        y: nextTable.y,
      });
      await loadSnapshot(true);

      return { ok: true };
    } catch (createError) {
      return { ok: false, message: getErrorMessage(createError, "Sto nije sačuvan.") };
    }
  };

  const updateTable = async (tableId: string, values: TableFormValues): AsyncActionResult => {
    const normalizedNumber = normalizeText(values.number);

    if (!normalizedNumber) {
      return { ok: false, message: "Broj stola je obavezno polje." };
    }

    const targetSector = snapshot.sectors.find((sector) => sector.id === values.sectorId);

    if (!targetSector) {
      return { ok: false, message: "Izabrani sektor ne postoji." };
    }

    if (tableNumberExists(values.sectorId, normalizedNumber, tableId)) {
      return { ok: false, message: "Broj ovog stola već postoji u ovom sektoru." };
    }

    if (!Number.isFinite(values.seats) || values.seats < 1 || values.seats > 12) {
      return { ok: false, message: "Broj mesta mora biti između 1 i 12." };
    }

    const currentTable = snapshot.tables.find((table) => table.id === tableId);

    if (!currentTable) {
      return { ok: false, message: "Sto nije pronađen." };
    }

    const nextTable = clampTableToSector(
      {
        ...currentTable,
        sectorId: values.sectorId,
        number: normalizedNumber,
        seats: values.seats,
        shape: values.shape,
      },
      targetSector,
    );

    try {
      await updateVenueTable(tableId, {
        sector: values.sectorId,
        number: normalizedNumber,
        seats: values.seats,
        shape: values.shape,
        x: nextTable.x,
        y: nextTable.y,
      });
      await loadSnapshot(true);

      return { ok: true };
    } catch (updateError) {
      return { ok: false, message: getErrorMessage(updateError, "Sto nije ažuriran.") };
    }
  };

  const deleteTable = async (tableId: string): AsyncActionResult => {
    const table = snapshot.tables.find((currentTable) => currentTable.id === tableId);

    if (!table) {
      return { ok: false, message: "Sto nije pronađen." };
    }

    if (table.hasActiveOrder) {
      return {
        ok: false,
        message: "Ovaj sto nije moguće ukloniti dok postoji aktivna narudžbina. Zatvorite sto pre brisanja.",
      };
    }

    try {
      await deleteVenueTable(tableId);
      await loadSnapshot(true);

      return { ok: true };
    } catch (deleteError) {
      return { ok: false, message: getErrorMessage(deleteError, "Sto nije obrisan.") };
    }
  };

  const moveTable = (tableId: string, x: number, y: number) => {
    const now = new Date().toISOString();

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      tables: currentSnapshot.tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              x,
              y,
              updatedAt: now,
            }
          : table,
      ),
    }));
  };

  const moveSector = (sectorId: string, x: number, y: number) => {
    const now = new Date().toISOString();

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      sectors: currentSnapshot.sectors.map((sector) =>
        sector.id === sectorId
          ? {
              ...sector,
              x,
              y,
              updatedAt: now,
            }
          : sector,
      ),
    }));
  };

  const resizeSector = (sectorId: string, x: number, y: number, width: number, height: number) => {
    const now = new Date().toISOString();

    setSnapshot((currentSnapshot) => {
      const targetSector = currentSnapshot.sectors.find((sector) => sector.id === sectorId);

      if (!targetSector) {
        return currentSnapshot;
      }

      const resizedSector: VenueSector = {
        ...targetSector,
        x,
        y,
        width,
        height,
        updatedAt: now,
      };

      return {
        ...currentSnapshot,
        sectors: currentSnapshot.sectors.map((sector) =>
          sector.id === sectorId ? resizedSector : sector,
        ),
        tables: currentSnapshot.tables.map((table) =>
          table.sectorId === sectorId
            ? {
                ...clampTableToSector(table, resizedSector),
                updatedAt: now,
              }
            : table,
        ),
      };
    });
  };

  const saveLayout = async (): AsyncActionResult => {
    try {
      await updateVenueFloor(snapshot.floor);

      for (const sector of snapshot.sectors) {
        await updateVenueSector(sector.id, {
          x: sector.x,
          y: sector.y,
          width: sector.width,
          height: sector.height,
        });
      }

      for (const table of snapshot.tables) {
        await updateVenueTable(table.id, {
          sector: table.sectorId,
          x: table.x,
          y: table.y,
        });
      }

      await loadSnapshot(true);
      setPastSnapshots([]);
      setFutureSnapshots([]);
      interactionLockedRef.current = false;

      return { ok: true };
    } catch (saveError) {
      return { ok: false, message: getErrorMessage(saveError, "Raspored nije sačuvan.") };
    }
  };

  const resetUnsavedChanges = () => {
    pushHistorySnapshot(snapshot);
    setSnapshot(cloneSnapshot(lastSavedSnapshot));
    interactionLockedRef.current = false;
  };

  const undo = () => {
    if (!pastSnapshots.length) {
      return;
    }

    const previousSnapshot = pastSnapshots[pastSnapshots.length - 1];

    setPastSnapshots((currentPastSnapshots) => currentPastSnapshots.slice(0, -1));
    setFutureSnapshots((currentFutureSnapshots) => [cloneSnapshot(snapshot), ...currentFutureSnapshots]);
    setSnapshot(cloneSnapshot(previousSnapshot));
    interactionLockedRef.current = false;
  };

  const redo = () => {
    if (!futureSnapshots.length) {
      return;
    }

    const [nextSnapshot, ...restFutureSnapshots] = futureSnapshots;

    setFutureSnapshots(restFutureSnapshots);
    setPastSnapshots((currentPastSnapshots) => [...currentPastSnapshots, cloneSnapshot(snapshot)]);
    setSnapshot(cloneSnapshot(nextSnapshot));
    interactionLockedRef.current = false;
  };

  return {
    sectors: snapshot.sectors,
    tables: snapshot.tables,
    floor: snapshot.floor,
    venueName,
    isLoading,
    error,
    counters,
    canUndo: pastSnapshots.length > 0,
    canRedo: futureSnapshots.length > 0,
    setFloor,
    getSectorById,
    getTablesBySectorId,
    beginHistoryStep,
    endHistoryStep,
    undo,
    redo,
    createSector,
    updateSector,
    deleteSector,
    createTable,
    updateTable,
    deleteTable,
    moveTable,
    moveSector,
    resizeSector,
    saveLayout,
    resetUnsavedChanges,
  };
}
