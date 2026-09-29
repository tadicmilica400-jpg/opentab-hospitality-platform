// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { useEffect, useMemo, useState } from "react";
import type { PendingOrder, PendingOrderStatus } from "../../../entities/waiter/waiter.types";
import { GlassBadge, type GlassBadgeTone } from "../../../shared/ui/GlassBadge";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { StatusPills } from "../../../shared/ui/StatusPills";
import { formatRsd } from "../workspace/formatRsd";
import { formatOrderDateTime, getOrderElapsedSeconds, getOrderEndTimestamp, getOrderStartTimestamp } from "../workspace/waiterTime";
import { useWaiterData } from "../workspace/useWaiterData";

function CheckmarkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

type ActivePanel = {
  orderId: string;
  mode: "reject" | "partial";
} | null;

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function timerClass(seconds: number) {
  if (seconds >= 600) {
    return "danger";
  }

  if (seconds >= 300) {
    return "warning";
  }

  return "normal";
}

function statusTone(status: PendingOrderStatus): GlassBadgeTone {
  const tones: Record<PendingOrderStatus, GlassBadgeTone> = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    partial: "info",
    expired: "muted",
    completed: "success",
  };

  return tones[status];
}

function statusLabel(status: PendingOrderStatus) {
  const labels: Record<PendingOrderStatus, string> = {
    pending: "Na cekanju",
    approved: "Odobrena",
    rejected: "Odbijena",
    partial: "Del. odobrena",
    expired: "Isteklo",
    completed: "Zavrsena",
  };

  return labels[status];
}

function orderTotal(order: PendingOrder) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function orderWaitLabel(seconds: number) {
  return `Vreme cekanja: ${formatTimer(seconds)}`;
}

export function PendingOrdersFeature() {
  const waiter = useWaiterData();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<"pending" | "archive">("pending");
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [partialState, setPartialState] = useState<Record<string, boolean>>({});
  const [expandedArchiveOrderId, setExpandedArchiveOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const pendingOrders = waiter.pendingOrders.map((order) => ({
    ...order,
    elapsedSeconds: getOrderElapsedSeconds(order, nowMs),
  }));
  const emptyTitle = !waiter.activeShift
    ? "Nema aktivne smene"
    : !waiter.assignedSector
      ? "Sektor nije dodeljen"
      : "Sve narudzbine su obradjene";
  const emptySubtitle = !waiter.activeShift
    ? "Pending narudzbine ce se prikazati kada smena pocne."
    : !waiter.assignedSector
      ? "Pending narudzbine nisu dostupne dok smeni nije dodeljen sektor."
      : "Nema vise narudzbina na cekanju";
  const totalCount = pendingOrders.length + waiter.archive.length;
  const processedCount = waiter.archive.length;
  const progress = totalCount ? (processedCount / totalCount) * 100 : 100;

  const archiveOrders = useMemo(
    () => waiter.archive.map((order) => ({
      ...order,
      elapsedSeconds: getOrderElapsedSeconds(order, nowMs),
    })),
    [nowMs, waiter.archive],
  );

  useEffect(() => {
    if (!activePanel) {
      return;
    }

    const orderStillPending = waiter.pendingOrders.some((order) => order.id === activePanel.orderId);

    if (!orderStillPending) {
      setActivePanel(null);
      setRejectReason("");
      setPartialState({});
    }
  }, [activePanel, waiter.pendingOrders]);

  const finishOrder = async (orderId: string, status: PendingOrderStatus, message: string) => {
    const order = waiter.pendingOrders.find((currentOrder) => currentOrder.id === orderId);

    if (!order) {
      return;
    }

    try {
      await waiter.processPendingOrder(
        orderId,
        status,
        status === "partial" ? partialState : undefined,
        status === "rejected" ? rejectReason : undefined,
      );
      setActivePanel(null);
      setRejectReason("");
      setPartialState({});
      setToast(message);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Narudžbina nije obrađena. Proveri backend.");
    }
  };

  const startPartial = (order: PendingOrder) => {
    setActivePanel({ orderId: order.id, mode: "partial" });
    setPartialState(Object.fromEntries(order.items.map((item) => [item.id, true])));
  };

  return (
    <div className="waiter-orders-page">
      <div className="orders-header map-header waiter-pending-hero">
        <div className="orders-header-top header-row-top">
          <div className="orders-title">
            <h1>Narudzbine na cekanju</h1>
            <p>Pregledajte i odobrite narudzbine gostiju</p>
          </div>
          <GlassBadge tone="success" dot>Uzivo</GlassBadge>
        </div>

        <StatusPills
          value={activeTab}
          onChange={(value) => setActiveTab(value)}
          className="waiter-pending-tabs"
          options={[
            { label: "Aktivni", value: "pending", count: pendingOrders.length },
            { label: "Arhiva", value: "archive", count: archiveOrders.length },
          ]}
        />
      </div>

      <div className="orders-content">
        {activeTab === "pending" ? (
          <>
            <div className="multi-counter">
              <span>{pendingOrders.length} narudzbine na cekanju</span>
              <div className="multi-counter-bar">
                <div className="multi-counter-fill" style={{ width: `${progress}%` }} />
              </div>
              <span>{processedCount}/{totalCount} obrađeno</span>
            </div>

            {pendingOrders.map((order) => {
              const isActiveReject = activePanel?.orderId === order.id && activePanel.mode === "reject";
              const isActivePartial = activePanel?.orderId === order.id && activePanel.mode === "partial";

              return (
                <article
                  className={`order-card ${order.elapsedSeconds >= 600 ? "very-urgent" : order.elapsedSeconds >= 300 ? "urgent" : ""}`}
                  key={order.id}
                >
                  <div className="card-header">
                    <div className="card-header-left">
                      <div className="table-badge">{order.tableNumber}</div>
                      <div className="card-guest-info">
                        <div className="card-guest-name">{order.guestName}</div>
                        <div className="card-guest-meta">{order.guestMeta} - Sto {order.tableNumber} - {order.sectorName}</div>
                      </div>
                    </div>
                    <div className="card-header-right">
                      <div className={`order-timer ${timerClass(order.elapsedSeconds)}`}>{formatTimer(order.elapsedSeconds)}</div>
                      <GlassBadge tone="warning" dot className="waiter-pending-status-badge">Na cekanju</GlassBadge>
                    </div>
                  </div>

                  <div className="card-divider" />

                  <div className="card-items">
                    {order.items.map((item) => (
                      <div className={`item-row ${partialState[item.id] === false ? "disabled-soft" : ""}`.trim()} key={item.id}>
                        <div className="item-qty">{item.quantity}x</div>
                        <div className="item-info">
                          <div className="item-name">{item.name}</div>
                          {item.options?.length ? <div className="item-options">{item.options.join(", ")}</div> : null}
                          {item.note ? <div className="item-note">{item.note}</div> : null}
                        </div>
                        {isActivePartial ? (
                          <GlassButton
                            type="button"
                            size="compact"
                            variant={partialState[item.id] ? "success" : "danger"}
                            onClick={() => setPartialState((current) => ({ ...current, [item.id]: !current[item.id] }))}
                          >
                            {partialState[item.id] ? <CheckmarkIcon /> : "x"}
                          </GlassButton>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {isActiveReject ? (
                    <div className="reject-panel visible">
                      <label>Razlog odbijanja</label>
                      <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
                      <div className="reject-actions">
                        <GlassButton type="button" variant="danger" onClick={() => void finishOrder(order.id, "rejected", "Narudzbina je odbijena i gost je obavesten")}>
                          Odbij narudzbinu
                        </GlassButton>
                        <GlassButton type="button" variant="muted" onClick={() => setActivePanel(null)}>Otkazi</GlassButton>
                      </div>
                    </div>
                  ) : null}

                  {isActivePartial ? (
                    <div className="partial-panel visible">
                      <div className="partial-header">Oznacite svaku stavku: kliknite za odobravanje / odbijanje</div>
                      <input className="partial-note-input" placeholder="Opcionalna napomena za odbijene stavke..." />
                      <div className="partial-confirm-actions">
                        <GlassButton type="button" variant="warning" onClick={() => void finishOrder(order.id, "partial", "Delimicno odobreno - gost je obavesten")}>
                          Potvrdi delimicno
                        </GlassButton>
                        <GlassButton type="button" variant="muted" onClick={() => setActivePanel(null)}>Otkazi</GlassButton>
                      </div>
                    </div>
                  ) : null}

                  {!activePanel || activePanel.orderId !== order.id ? (
                    <>
                      <div className="card-divider" />
                      <div className="card-actions">
                        <GlassButton type="button" variant="success" onClick={() => void finishOrder(order.id, "approved", "Narudzbina je odobrena i prosledjena u pripremu")}>Odobri</GlassButton>
                        <GlassButton type="button" variant="warning" onClick={() => startPartial(order)}>Delimicno</GlassButton>
                        <GlassButton type="button" variant="danger" onClick={() => setActivePanel({ orderId: order.id, mode: "reject" })}>Odbij</GlassButton>
                      </div>
                    </>
                  ) : null}
                </article>
              );
            })}

            {pendingOrders.length === 0 ? (
              <div className="empty-state visible">
                <div className="empty-title">{emptyTitle}</div>
                <div className="empty-sub">{emptySubtitle}</div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {archiveOrders.length === 0 ? (
              <div className="empty-state visible">
                <div className="empty-title">Nema arhiviranih narudžbina</div>
                <div className="empty-sub">Za tvoje smene i dozvoljene sektore nema rezultata.</div>
              </div>
            ) : null}

            {archiveOrders.map((order) => {
              const isExpanded = expandedArchiveOrderId === order.id;
              const total = orderTotal(order);

              return (
                <article className="archive-card" key={`${order.id}-${order.status}`}>
                  <div
                    className="archive-card-row"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedArchiveOrderId(isExpanded ? null : order.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpandedArchiveOrderId(isExpanded ? null : order.id);
                      }
                    }}
                  >
                    <div className="archive-table-badge">{order.tableNumber}</div>
                    <div className="archive-info">
                      <div className="archive-guest">{order.guestName}</div>
                      <div className="archive-meta">Sto {order.tableNumber} - {order.sectorName} - {formatRsd(total)}</div>
                    </div>
                    <GlassBadge tone={statusTone(order.status)} dot>{statusLabel(order.status)}</GlassBadge>
                  </div>

                  {isExpanded ? (
                    <>
                      <div className="card-divider" />

                      <div className="card-items">
                        <div className="panel-section-label">Detalji narudzbine</div>

                        <div className="item-row">
                          <div className="item-info">
                            <div className="item-name">Sto {order.tableNumber}</div>
                            <div className="item-options">{order.sectorName}</div>
                          </div>
                        </div>

                        <div className="item-row">
                          <div className="item-info">
                            <div className="item-name">{orderWaitLabel(order.elapsedSeconds)}</div>
                            <div className="item-options">Kreirano: {formatOrderDateTime(getOrderStartTimestamp(order))}</div>
                            <div className="item-options">{order.status === "expired" ? "Isteklo" : "Obradjeno"}: {formatOrderDateTime(getOrderEndTimestamp(order))}</div>
                          </div>
                        </div>

                        <div className="item-row">
                          <div className="item-info">
                            <div className="item-name">Status narudzbine</div>
                            <div className="item-options">{statusLabel(order.status)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="card-divider" />

                      <div className="card-items">
                        <div className="panel-section-label">Stavke</div>
                        {order.items.map((item) => {
                          const isRejectedItem = order.status === "partial" && item.approved === false;

                          return (
                            <div className={`item-row ${isRejectedItem ? "disabled-soft" : ""}`.trim()} key={item.id} aria-disabled={isRejectedItem || undefined}>
                              <div className="item-qty">{item.quantity}x</div>
                              <div className="item-info">
                                <div className="item-name">{item.name}</div>
                                {item.options?.length ? <div className="item-options">{item.options.join(", ")}</div> : null}
                                {item.note ? <div className="item-note">{item.note}</div> : null}
                                {order.status === "partial" && item.approved === false ? <div className="item-note">Stavka nije odobrena.</div> : null}
                              </div>
                              <div className="panel-total-amount">{formatRsd(item.price)}</div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="card-divider" />

                      <div className="card-actions">
                        <div className="panel-total-row" style={{ width: "100%" }}>
                          <span>Ukupno</span>
                          <span className="panel-total-amount">{formatRsd(total)}</span>
                        </div>
                      </div>
                    </>
                  ) : null}
                </article>
              );
            })}
          </>
        )}
      </div>

      {toast ? <div className="toast visible"><span className="toast-icon"><CheckmarkIcon /></span>{toast}</div> : null}
    </div>
  );
}
