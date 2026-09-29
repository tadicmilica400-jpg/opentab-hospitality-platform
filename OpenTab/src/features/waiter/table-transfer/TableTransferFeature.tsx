// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { WaiterTableStatus } from "../../../entities/waiter/waiter.types";
import { AppModal } from "../../../shared/modals/AppModal";
import { GlassBadge, type GlassBadgeTone } from "../../../shared/ui/GlassBadge";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { IconButton } from "../../../shared/ui/IconButton";
import { TableStatusLegend } from "../shared/TableStatusLegend";
import { WaiterTablePicker } from "../shared/WaiterTablePicker";
import { formatRsd } from "../workspace/formatRsd";
import { useWaiterData } from "../workspace/useWaiterData";

const transferStatusLabels: Record<WaiterTableStatus, string> = {
  free: "Slobodan",
  occupied: "Zauzet",
  reserved: "Rezervisan",
  payment: "Čeka naplatu",
};

const transferStatusTones: Record<WaiterTableStatus, GlassBadgeTone> = {
  free: "muted",
  occupied: "success",
  reserved: "info",
  payment: "warning",
};

type TransferPhase = "idle" | "overview" | "partial" | "dst-select" | "confirm" | "done";
type TransferMode = "full" | "partial";

function canTransferBetweenSectors(sourceSectorId: string, targetSectorId: string, waiterSectorId: string) {
  return sourceSectorId === waiterSectorId || targetSectorId === waiterSectorId;
}

export function TableTransferFeature() {
  const { tableId } = useParams();
  const waiter = useWaiterData();
  const [phase, setPhase] = useState<TransferPhase>("idle");
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [mode, setMode] = useState<TransferMode>("full");
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [shakeTableId, setShakeTableId] = useState("");

  const sourceTable = waiter.getTable(sourceId);
  const destinationTable = waiter.getTable(destinationId);
  const waiterSectorId = waiter.assignedSector?.id ?? "";
  const transferSectorMessage = waiter.activeShift
    ? "Nije ti dodeljen sektor za trenutnu smenu."
    : "Nemas aktivnu smenu i ne mozes da premestas stolove.";
  const crossForeignSectorMessage = "Sto mozes da premestis samo iz svog sektora ili u svoj sektor.";
  const guests = sourceTable?.guests ?? [];
  const destinationAllowedStatuses: WaiterTableStatus[] =
    sourceTable?.status === "reserved" ? ["free"] : ["free", "occupied"];
  const transferTargetTables = useMemo(() => {
    if (phase !== "dst-select" || !sourceId) return waiter.tables;

    return waiter.tables.filter((table) => table.id !== sourceId && destinationAllowedStatuses.includes(table.status));
  }, [destinationAllowedStatuses, phase, sourceId, waiter.tables]);
  const selectedGuestCount = selectedGuestIds.length;
  const hasTransferSector = Boolean(waiterSectorId);
  const canMove = Boolean(hasTransferSector && sourceTable && sourceTable.status !== "payment" && sourceTable.status !== "free");
  const canPartial = Boolean(hasTransferSector && sourceTable && sourceTable.status === "occupied" && guests.length > 1);
  const showPanel = Boolean(sourceTable && ["overview", "partial", "done"].includes(phase));
  const isDestinationDisabledBySector = (targetSectorId: string) => {
    if (!sourceTable || !waiterSectorId) {
      return true;
    }

    return !canTransferBetweenSectors(sourceTable.sectorId, targetSectorId, waiterSectorId);
  };

  useEffect(() => {
    if (!tableId) {
      resetFlow();
      return;
    }

    const table = waiter.getTable(tableId);
    if (!table) return;

    setSourceId(tableId);
    setDestinationId("");
    setSelectedGuestIds([]);
    setMode("full");
    setPhase("overview");
  }, [tableId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!shakeTableId) return;
    const timer = window.setTimeout(() => setShakeTableId(""), 550);
    return () => window.clearTimeout(timer);
  }, [shakeTableId]);

  const headerText = useMemo(() => {
    if (!sourceTable) return "Kliknite na zauzet ili rezervisan sto da vidite detalje i pokrenete premeštanje.";
    if (phase === "dst-select" && sourceTable.status === "reserved") {
      return `Sto ${sourceTable.number} izabran - rezervisan sto moze da se premesti samo na slobodan sto`;
    }
    if (phase === "dst-select") return `Sto ${sourceTable.number} izabran - kliknite na slobodan ili zauzet sto odredišta`;
    if (phase === "confirm") return `Sto ${sourceTable.number} -> Sto ${destinationTable?.number ?? ""} - potvrda premeštanja`;
    if (phase === "partial") return `Sto ${sourceTable.number} - izaberite goste za premeštanje`;
    return "Kliknite na zauzet ili rezervisan sto da vidite detalje i pokrenete premeštanje.";
  }, [destinationTable?.number, phase, sourceTable]);

  const resetFlow = () => {
    setPhase("idle");
    setSourceId("");
    setDestinationId("");
    setSelectedGuestIds([]);
    setMode("full");
  };

  const selectTable = (nextTableId: string) => {
    const table = waiter.getTable(nextTableId);

    if (!table) return;

    if (phase === "dst-select") {
      if (nextTableId === sourceId) {
        setShakeTableId(nextTableId);
        setToast("To je već polazni sto.");
        return;
      }

      if (table.status === "payment") {
        setShakeTableId(nextTableId);
        return;
      }

      if (table.status === "reserved") {
        setShakeTableId(nextTableId);
        return;
      }

      if (isDestinationDisabledBySector(table.sectorId)) {
        setShakeTableId(nextTableId);
        setToast(waiterSectorId ? crossForeignSectorMessage : transferSectorMessage);
        return;
      }

      if (sourceTable?.status === "reserved" && table.status !== "free") {
        setShakeTableId(nextTableId);
        setToast("Rezervisan sto moze da se premesti samo na slobodan sto.");
        return;
      }

      setDestinationId(nextTableId);
      setPhase("confirm");
      return;
    }

    setSourceId(nextTableId);
    setDestinationId("");
    setSelectedGuestIds([]);
    setMode("full");
    setPhase("overview");
  };

  const beginFullMove = () => {
    if (!sourceTable || !canMove) {
      if (!hasTransferSector) {
        setToast(transferSectorMessage);
      }
      return;
    }
    setMode("full");
    setDestinationId("");
    setPhase("dst-select");
  };

  const beginPartialMove = () => {
    if (!canPartial) {
      if (!hasTransferSector) {
        setToast(transferSectorMessage);
      }
      return;
    }
    setMode("partial");
    setSelectedGuestIds([]);
    setPhase("partial");
  };

  const confirmPartialDestination = () => {
    if (selectedGuestIds.length === 0) {
      setToast("Izaberite bar jednog gosta za premeštanje.");
      return;
    }

    setDestinationId("");
    setPhase("dst-select");
  };

  const backToOverview = () => {
    setDestinationId("");
    setSelectedGuestIds([]);
    setPhase(sourceTable ? "overview" : "idle");
  };

  const executeTransfer = async () => {
    if (!sourceTable || !destinationTable) return;

    try {
      if (mode === "full") {
        await waiter.transferWholeTable(sourceTable.id, destinationTable.id);
      } else {
        await waiter.transferGuests(sourceTable.id, destinationTable.id, selectedGuestIds);
      }

      setToast(`Premeštanje sa stola ${sourceTable.number} na sto ${destinationTable.number} je uspešno izvršeno.`);
      setPhase("done");
      window.setTimeout(() => {
        setSourceId(destinationTable.id);
        setDestinationId("");
        setSelectedGuestIds([]);
        setPhase("overview");
      }, 1000);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Premeštanje nije uspelo.");
    }
  };

  return (
    <div className="waiter-flow-page table-transfer-page">
      <div className="move-header">
        <div className="move-header-top">
          <div className="move-title">
            <h1>Premeštanje stola</h1>
            <p>{headerText}</p>
          </div>
          {phase === "dst-select" ? (
            <GlassButton type="button" variant="muted" className="transfer-destination-cancel" onClick={backToOverview}>
              Odustani
            </GlassButton>
          ) : null}
          <div className="step-wizard">
            <div className={`step-item ${phase === "idle" || ["overview", "partial"].includes(phase) ? "active" : "done"}`}>
              <div className="step-circle"><span>1</span></div>
              <span className="step-label">Pregled stola</span>
            </div>
            <div className={`step-connector ${["dst-select", "confirm", "done"].includes(phase) ? "done" : ""}`} />
            <div className={`step-item ${phase === "dst-select" ? "active" : ["confirm", "done"].includes(phase) ? "done" : ""}`}>
              <div className="step-circle"><span>2</span></div>
              <span className="step-label">Odredišni sto</span>
            </div>
            <div className={`step-connector ${["confirm", "done"].includes(phase) ? "done" : ""}`} />
            <div className={`step-item ${phase === "confirm" ? "active" : phase === "done" ? "done" : ""}`}>
              <div className="step-circle"><span>3</span></div>
              <span className="step-label">Potvrda</span>
            </div>
          </div>
        </div>
        <TableStatusLegend />
      </div>

      <div className="waiter-workspace-shell">
        <div className="map-canvas-container waiter-workspace waiter-prototype-picker-shell">
          <WaiterTablePicker
            tables={transferTargetTables}
            selectedTableId={phase === "dst-select" ? destinationId : sourceTable?.id}
            sourceTableId={phase === "dst-select" ? undefined : sourceTable?.id}
            destinationTableId={destinationId}
            allowedStatuses={phase === "dst-select" ? destinationAllowedStatuses : undefined}
            allowDisabledClick={phase === "dst-select"}
            isTableDisabled={phase === "dst-select" ? (table) => table.id !== sourceId && isDestinationDisabledBySector(table.sectorId) : undefined}
            shakeTableId={shakeTableId}
            onSelectTable={selectTable}
          />
        </div>

        {sourceTable ? (
          <aside className={`info-panel waiter-slide-panel ${showPanel ? "open" : ""}`}>
            <div className="info-panel-accent" />
            <div>
              <IconButton className="panel-close-btn" onClick={resetFlow}>x</IconButton>
              <div className="panel-table-header">
                <div className="panel-table-badge">{sourceTable.number}</div>
                <div>
                  <div className="panel-table-name">{sourceTable.guestLabel ?? "Nema aktivnih gostiju"}</div>
                  <div className="panel-table-meta">Sto {sourceTable.number} - {sourceTable.sectorName}</div>
                </div>
                <GlassBadge tone={transferStatusTones[sourceTable.status]} dot>
                  {transferStatusLabels[sourceTable.status]}
                </GlassBadge>
              </div>

              <div className="panel-divider" />


              {phase === "partial" ? (
                <>
                  <div className="panel-section-label">Izaberite goste za premeštanje</div>
                  <div className="guest-transfer-list">
                    {guests.map((guest) => (
                      <label className={`waiter-transfer-guest-card ${selectedGuestIds.includes(guest.id) ? "checked" : ""}`} key={guest.id}>
                        <input
                          type="checkbox"
                          checked={selectedGuestIds.includes(guest.id)}
                          onChange={(event) =>
                            setSelectedGuestIds((current) =>
                              event.target.checked
                                ? [...current, guest.id]
                                : current.filter((id) => id !== guest.id),
                            )
                          }
                        />
                        <span className="waiter-transfer-guest-head">
                          <strong>{guest.guestName}</strong>
                          <b>{formatRsd(waiter.getGuestTotal(guest))}</b>
                        </span>
                        <span className="waiter-transfer-guest-items">
                          {guest.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="partial-count-bar">{selectedGuestCount} od {guests.length} gostiju izabrano</div>
                  <GlassButton type="button" variant="primary" fullWidth disabled={selectedGuestCount === 0} onClick={confirmPartialDestination}>
                    Odaberi odredišni sto
                  </GlassButton>
                  <GlassButton type="button" variant="muted" fullWidth onClick={backToOverview}>Nazad na pregled</GlassButton>
                </>
              ) : (
                <>
                  <div className="panel-section-label">Aktivne narudžbine</div>
                  <div className="panel-orders-list">
                    {guests.length === 0 ? <div className="orders-empty">Nema aktivnih narudžbina.</div> : null}
                    {guests.map((guest) => (
                      <div className="ov-guest-group" key={guest.id}>
                        <div className="ov-guest-name">{guest.guestName}</div>
                        {guest.items.map((item) => (
                          <div className="ov-order-row" key={item.id}>
                            <span className="ov-qty">{item.quantity}x</span>
                            <span className="ov-oname">{item.name}</span>
                            <span className="ov-price">{formatRsd(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="panel-total-row">
                    <span>Ukupno</span>
                    <span className="panel-total-amount">{formatRsd(sourceTable.currentBill)}</span>
                  </div>
                  <div className="panel-actions">
                    <GlassButton type="button" variant="warning" className="waiter-panel-choice-btn" fullWidth disabled={!canPartial || phase === "dst-select"} onClick={beginPartialMove}>
                      Parcijalno premeštanje
                    </GlassButton>
                    <GlassButton type="button" variant="primary" fullWidth disabled={!canMove || phase === "dst-select"} onClick={beginFullMove}>
                      Premesti sto
                    </GlassButton>
                  </div>
                </>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      <AppModal
        open={phase === "confirm" && Boolean(sourceTable && destinationTable)}
        title="Potvrda premeštanja"
        subtitle={sourceTable && destinationTable ? `Sto ${sourceTable.number} -> Sto ${destinationTable.number}` : ""}
        onClose={() => {
          setDestinationId("");
          setPhase("dst-select");
        }}
        footer={
          <div className="modal-actions">
            <GlassButton type="button" variant="muted" onClick={() => { setDestinationId(""); setPhase("dst-select"); }}>
              Otkaži
            </GlassButton>
            <GlassButton type="button" variant="primary" onClick={executeTransfer}>
              Potvrdi premeštanje
            </GlassButton>
          </div>
        }
      >
        <p className="confirm-question">
          {mode === "full"
            ? destinationTable?.status === "occupied"
              ? "Da li želite da premestite sve goste i njihove narudžbine na zauzet sto? Postojeće i premeštene guest grupe ostaće odvojene."
              : "Da li želite da premestite sve goste i sve narudžbine?"
            : destinationTable?.status === "occupied"
              ? `Da li želite da premestite ${selectedGuestCount} izabranih gostiju na zauzet sto? Postojeće i premeštene guest grupe ostaće odvojene.`
              : `Da li želite da premestite ${selectedGuestCount} izabranih gostiju sa svim njihovim stavkama?`}
        </p>
      </AppModal>

      {toast ? <div className="toast visible"><span className="toast-icon">!</span>{toast}</div> : null}
      {shakeTableId ? <span className="sr-only">Nevažeći izbor stola {shakeTableId}</span> : null}
    </div>
  );
}
