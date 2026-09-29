// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../app/routes";
import type { WaiterTableStatus } from "../../../entities/waiter/waiter.types";
import { GlassBadge, type GlassBadgeTone } from "../../../shared/ui/GlassBadge";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { IconButton } from "../../../shared/ui/IconButton";
import { formatRsd } from "../workspace/formatRsd";
import { useWaiterData } from "../workspace/useWaiterData";
import { TableStatusLegend } from "../shared/TableStatusLegend";
import { WaiterVenueMapCanvas } from "./components/WaiterVenueMapCanvas";

const statusLabels: Record<WaiterTableStatus, string> = {
  free: "Slobodan",
  occupied: "Zauzet",
  reserved: "Rezervisan",
  payment: "Čeka naplatu",
};

const statusTones: Record<WaiterTableStatus, GlassBadgeTone> = {
  free: "muted",
  occupied: "success",
  reserved: "info",
  payment: "warning",
};

export function WaiterTableMapFeature() {
  const navigate = useNavigate();
  const waiter = useWaiterData();
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const selectedTable = waiter.getTable(selectedTableId);
  const venueName = waiter.profile?.venue.name ?? "Lokal nije dostupan";

  const stats = useMemo(
    () => ({
      occupied: waiter.tables.filter((table) => table.status === "occupied").length,
      payment: waiter.tables.filter((table) => table.status === "payment").length,
      free: waiter.tables.filter((table) => table.status === "free").length,
    }),
    [waiter.tables],
  );
  const selectedGuests = selectedTable?.guests ?? [];
  const canAddManualOrder = selectedTable ? selectedTable.status !== "payment" : false;
  const canTransferTable = selectedTable ? selectedTable.status !== "free" : false;
  const canCheckoutTable = selectedTable
    ? selectedTable.status === "occupied" || selectedTable.status === "payment"
    : false;
  const selectedOrderLines = selectedGuests.flatMap((guest) =>
    guest.items.map((item) => ({ ...item, guestName: guest.guestName })),
  );

  return (
    <div className="waiter-layout waiter-map-layout venue-map-layout page-layout">
      <div className="map-header">
        <div className="header-row-top">
          <div className="map-title">
            <h1>Mapa stolova - {venueName}</h1>
            <p>Kliknite na sto za ručni unos, premeštanje ili naplatu.</p>
          </div>
          <div className="venue-map-stats waiter-map-toolbar">
            <div className="waiter-map-stat-pills" aria-label="Status stolova">
              <span>{stats.occupied} zauzeta</span>
              <span>{stats.payment} čeka naplatu</span>
              <span>{stats.free} slobodna</span>
            </div>
            <GlassButton
              type="button"
              variant="primary"
              className="waiter-map-manual-btn"
              onClick={() => {
                if (selectedTable && canAddManualOrder) {
                  navigate(routes.waiter.manualOrder.replace(":tableId", selectedTable.id));
                  return;
                }

                navigate(routes.waiter.manualOrderBase);
              }}
            >
              Ručni unos
            </GlassButton>
          </div>
        </div>
        <TableStatusLegend />
      </div>


      <div className="waiter-workspace-shell">
        <div className="map-canvas-container waiter-workspace waiter-map-workspace venue-map-canvas-container">
          <WaiterVenueMapCanvas
            sectors={waiter.sectors}
            tables={waiter.tables}
            waiterTables={waiter.tables}
            floor={waiter.floor}
            selectedTableId={selectedTableId}
            onSelectTable={setSelectedTableId}
          />
        </div>

        <aside className={`info-panel waiter-slide-panel waiter-map-info-panel ${selectedTable ? "open" : ""}`}>
          <div className="info-panel-accent" />
          {selectedTable ? (
            <div className="waiter-map-panel-content">
              <IconButton className="panel-close-btn" onClick={() => setSelectedTableId("")}>x</IconButton>
              <div className="panel-table-header waiter-map-panel-header">
                <div className="panel-table-badge">{selectedTable.number}</div>
                <div className="waiter-map-panel-title">
                  <div className="panel-table-name">Sto {selectedTable.number}</div>
                  <div className="panel-table-meta">{selectedTable.sectorName}</div>
                </div>
                <GlassBadge tone={statusTones[selectedTable.status]} dot>
                  {statusLabels[selectedTable.status]}
                </GlassBadge>
              </div>

              <div className="panel-divider" />

              <section className="waiter-map-panel-section">
                <div className="panel-section-label">{selectedTable.status === "reserved" ? "Rezervacija" : "Gosti"}</div>
                {selectedTable.status === "reserved" ? (
                  <div className="waiter-map-guests-list">
                    <div className="waiter-map-guest-row reserved">
                      <span>{selectedTable.reservationLabel ?? "Rezervisao: gost"}</span>
                      <em>rezervacija</em>
                    </div>
                  </div>
                ) : selectedGuests.length > 0 ? (
                  <div className="waiter-map-guests-list">
                    {selectedGuests.map((guest) => (
                      <div className="waiter-map-guest-row" key={guest.id}>
                        <span>{guest.guestName}</span>
                        <em>{guest.registered ? "registrovan" : "ručni unos"}</em>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="waiter-map-empty-line">Nema aktivnih gostiju.</div>
                )}
              </section>

              <section className="waiter-map-panel-section">
                <div className="panel-section-label">Vreme otvaranja</div>
                <div className="waiter-map-opened-time">{selectedTable.openedAt ?? "—"}</div>
              </section>

              <section className="waiter-map-panel-section">
                <div className="panel-section-label">Stavke narudžbine</div>
                {selectedOrderLines.length > 0 ? (
                  <div className="waiter-map-order-list">
                    {selectedOrderLines.map((item) => (
                      <div className="waiter-map-order-row" key={item.id}>
                        <div className="waiter-map-order-main">
                          <span>{item.name}</span>
                          <small>{item.guestName}</small>
                        </div>
                        <div className="waiter-map-order-meta">
                          <span>{item.quantity}x</span>
                          <b>{formatRsd(item.price * item.quantity)}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="waiter-map-empty-line">Nema stavki narudžbine.</div>
                )}
              </section>

              <section className="waiter-map-panel-section waiter-map-panel-total">
                <span>Ukupan račun</span>
                <b>{formatRsd(selectedTable.currentBill)}</b>
              </section>


              <div className="waiter-table-actions waiter-map-panel-actions">
                <GlassButton
                  type="button"
                  variant="primary"
                  fullWidth
                  align="start"
                  disabled={!canAddManualOrder}
                  onClick={() => {
                    if (canAddManualOrder) {
                      navigate(routes.waiter.manualOrder.replace(":tableId", selectedTable.id));
                    }
                  }}
                >
                  Dodaj narudžbinu ručno
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="primary"
                  fullWidth
                  align="start"
                  disabled={!canTransferTable}
                  onClick={() => {
                    if (canTransferTable) {
                      navigate(routes.waiter.transferTable.replace(":tableId", selectedTable.id));
                    }
                  }}
                >
                  <span>⇄</span>
                  Premesti sto
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="primary"
                  fullWidth
                  align="start"
                  disabled={!canCheckoutTable}
                  onClick={() => {
                    if (canCheckoutTable) {
                      navigate(routes.waiter.checkout.replace(":tableId", selectedTable.id));
                    }
                  }}
                >
                  <span>$</span>
                  Naplata / zatvaranje stola
                </GlassButton>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
