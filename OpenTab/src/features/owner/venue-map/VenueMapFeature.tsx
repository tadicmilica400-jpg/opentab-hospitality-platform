// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  TableFormValues,
  VenueFloorType,
  VenueTable,
} from "../../../entities/venue-map/venueMap.types";
import { SectorManagerModal } from "./components/SectorManagerModal";
import { TableFormModal } from "./components/TableFormModal";
import { VenueMapCanvas } from "./components/VenueMapCanvas";
import { useVenueMap } from "./hooks/useVenueMap";
import { ConfirmModal } from "../../../shared/modals/ConfirmModal";
import type { ActionResult } from "../../../shared/types/action.types";
import { SegmentedSlider, type SegmentedSliderOption } from "../../../shared/ui/SegmentedSlider";

type TableModalState =
  | {
      mode: "create";
      table: null;
    }
  | {
      mode: "edit";
      table: VenueTable;
    }
  | null;

type ToastState = {
  id: number;
  message: string;
} | null;

const floorOptions: SegmentedSliderOption<VenueFloorType>[] = [
  {
    label: "Parket",
    value: "parket",
    preview: <span className="floor-swatch floor-swatch-parket" aria-hidden="true" />,
  },
  {
    label: "Pločice",
    value: "plocice",
    preview: <span className="floor-swatch floor-swatch-plocice" aria-hidden="true" />,
  },
  {
    label: "Beton",
    value: "beton",
    preview: <span className="floor-swatch floor-swatch-beton" aria-hidden="true" />,
  },
];

export function VenueMapFeature() {
  const venueMap = useVenueMap();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tableModal, setTableModal] = useState<TableModalState>(null);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [pendingDeleteTable, setPendingDeleteTable] = useState<VenueTable | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (searchParams.get("modal") === "sectors") {
      setIsSectorModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast({
      id: Date.now(),
      message,
    });

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const closeSectorManager = () => {
    setIsSectorModalOpen(false);

    if (searchParams.get("modal") === "sectors") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("modal");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const openCreateTableModal = () => {
    if (searchParams.get("modal") === "sectors") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("modal");
      setSearchParams(nextParams, { replace: true });
    }

    setIsSectorModalOpen(false);
    setTableModal({ mode: "create", table: null });
  };

  const handleSubmitTable = async (values: TableFormValues): Promise<ActionResult> => {
    const result =
      tableModal?.mode === "edit"
        ? await venueMap.updateTable(tableModal.table.id, values)
        : await venueMap.createTable(values);

    if (result.ok) {
      showToast(
        tableModal?.mode === "edit"
          ? "Sto je uspešno ažuriran."
          : "Sto je dodat i QR kod je generisan.",
      );
    }

    return result;
  };

  const requestDeleteTable = (table: VenueTable) => {
    if (table.hasActiveOrder) {
      showToast("Ovaj sto nije moguće ukloniti dok postoji aktivna narudžbina. Zatvorite sto pre brisanja.");
      return;
    }

    setTableModal(null);
    setPendingDeleteTable(table);
  };

  const confirmDeleteTable = async () => {
    if (!pendingDeleteTable) {
      return;
    }

    const deletedTableNumber = pendingDeleteTable.number;
    const result = await venueMap.deleteTable(pendingDeleteTable.id);

    if (result.ok === false) {
      showToast(result.message);
      setPendingDeleteTable(null);
      return;
    }

    showToast(`Sto ${deletedTableNumber} je uklonjen sa mape.`);
    setPendingDeleteTable(null);
  };

  const saveLayout = async () => {
    const result = await venueMap.saveLayout();

    if (result.ok === false) {
      showToast(result.message);
      return;
    }

    showToast("Raspored lokala je sačuvan.");
  };

  const resetChanges = () => {
    venueMap.resetUnsavedChanges();
    showToast("Mapa je vraćena na poslednje sačuvano stanje.");
  };

  const downloadQr = (table: VenueTable) => {
    const content = `OpenTab QR\nSto: ${table.number}\nID: ${table.id}\nQR URL: ${table.qrCodeUrl}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `opentab-sto-${table.number}-qr.txt`;
    link.click();

    URL.revokeObjectURL(url);
    showToast(`QR kod za sto ${table.number} je spreman za preuzimanje.`);
  };

  return (
    <div className="venue-map-layout">
      <div className="map-header">
        <div className="header-row-top">
          <div className="map-title">
            <h1>Mapa lokala · {venueMap.venueName}</h1>
            <p>Konfigurišite raspored stolova i sektora</p>
          </div>

          <div className="header-actions">
            <button type="button" className="btn-glass primary" onClick={openCreateTableModal}>
              + Dodaj sto
            </button>
          </div>
        </div>

        <div className="header-row-middle venue-map-header-controls">
          <SegmentedSlider
            value={venueMap.floor}
            options={floorOptions}
            onChange={venueMap.setFloor}
            className="floor-texture-slider venue-floor-selector"
          />

          <div className="venue-map-stats">
            <span>{venueMap.counters.sectors} sektora</span>
            <span>{venueMap.counters.tables} stolova</span>
            <span>{venueMap.counters.activeOrders} aktivnih narudžbina</span>
          </div>
        </div>
      </div>

      {venueMap.error ? (
        <div className="map-canvas-container venue-map-canvas-container">
          <div className="menu-empty-state">{venueMap.error}</div>
        </div>
      ) : venueMap.isLoading ? (
        <div className="map-canvas-container venue-map-canvas-container">
          <div className="menu-empty-state">Učitavanje mape lokala iz baze...</div>
        </div>
      ) : (
        <div className="map-canvas-container venue-map-canvas-container">
          <VenueMapCanvas
          sectors={venueMap.sectors}
          tables={venueMap.tables}
          floor={venueMap.floor}
          canUndo={venueMap.canUndo}
          canRedo={venueMap.canRedo}
          onUndo={venueMap.undo}
          onRedo={venueMap.redo}
          onBeginLayoutChange={venueMap.beginHistoryStep}
          onEndLayoutChange={venueMap.endHistoryStep}
          onMoveSector={venueMap.moveSector}
          onResizeSector={venueMap.resizeSector}
          onMoveTable={venueMap.moveTable}
          onEditTable={(table) => setTableModal({ mode: "edit", table })}
          onSaveLayout={saveLayout}
          onResetChanges={resetChanges}
        />
      </div>
      )}

      <TableFormModal
        open={tableModal !== null}
        mode={tableModal?.mode ?? "create"}
        table={tableModal?.mode === "edit" ? tableModal.table : null}
        sectors={venueMap.sectors}
        onClose={() => setTableModal(null)}
        onSubmit={handleSubmitTable}
        onRequestDelete={requestDeleteTable}
        onDownloadQr={downloadQr}
      />

      <SectorManagerModal
        open={isSectorModalOpen}
        sectors={venueMap.sectors}
        tables={venueMap.tables}
        onClose={closeSectorManager}
        onCreateSector={venueMap.createSector}
        onUpdateSector={venueMap.updateSector}
        onDeleteSector={venueMap.deleteSector}
      />

      <ConfirmModal
        open={pendingDeleteTable !== null}
        title="Potvrda brisanja"
        message={
          pendingDeleteTable
            ? `Brisanjem stola ${pendingDeleteTable.number} deaktivirate i njegov QR kod. Da li ste sigurni?`
            : ""
        }
        confirmLabel="Obriši"
        danger
        onClose={() => setPendingDeleteTable(null)}
        onConfirm={confirmDeleteTable}
      />

      {toast ? (
        <div className="menu-toast" key={toast.id}>
          <span className="menu-toast-dot" />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}