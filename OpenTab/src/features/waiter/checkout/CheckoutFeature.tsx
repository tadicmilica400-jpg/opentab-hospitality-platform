// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { TableGuest, TableOrderLine, WaiterPaymentMethod, WaiterTableStatus } from "../../../entities/waiter/waiter.types";
import { ModalTextField } from "../../../shared/forms/ModalTextField";
import { GlassBadge, type GlassBadgeTone } from "../../../shared/ui/GlassBadge";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { IconButton } from "../../../shared/ui/IconButton";
import { AppModal } from "../../../shared/modals/AppModal";
import { TableStatusLegend } from "../shared/TableStatusLegend";
import { WaiterTablePicker } from "../shared/WaiterTablePicker";
import { formatRsd } from "../workspace/formatRsd";
import { useWaiterData } from "../workspace/useWaiterData";

const checkoutStatusLabels: Record<WaiterTableStatus, string> = {
  free: "Slobodan",
  occupied: "Zauzet",
  reserved: "Rezervisan",
  payment: "Čeka naplatu",
};

const checkoutStatusTones: Record<WaiterTableStatus, GlassBadgeTone> = {
  free: "muted",
  occupied: "success",
  reserved: "info",
  payment: "warning",
};

type CheckoutPhase = "idle" | "overview" | "split" | "payment" | "closing" | "done";
type ModalMode = "cash" | "online" | "splitCash" | "splitClose" | "release" | null;
type CheckoutPaymentType = "single" | "split";

type SplitLine = {
  guest: TableGuest;
  item: TableOrderLine;
  amount: number;
  paid: boolean;
};

function isSplitItemPaid(guest: TableGuest, item: TableOrderLine) {
  return guest.paid || item.paid === true;
}

function paymentMethodLabel(method: WaiterPaymentMethod | undefined) {
  if (method === "card") {
    return "Kartica";
  }

  if (method === "cash") {
    return "Gotovina";
  }

  return "Nije izabrano";
}

export function CheckoutFeature() {
  const { tableId } = useParams();
  const waiter = useWaiterData();
  const [selectedTableId, setSelectedTableId] = useState("");
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [tip, setTip] = useState("");
  const [splitSelection, setSplitSelection] = useState<string[]>([]);
  const [splitPaymentItemIds, setSplitPaymentItemIds] = useState<string[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<WaiterPaymentMethod | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<CheckoutPaymentType | null>(null);
  const [toast, setToast] = useState("");
  const [shakeTableId, setShakeTableId] = useState("");

  const chargeDeniedMessage = waiter.assignedSector
    ? `Mozes da naplatis samo stolove iz sektora ${waiter.assignedSector.name}.`
    : "Nemas aktivan sektor za naplatu.";
  const checkoutTables = useMemo(
    () => waiter.tables.filter((table) => table.canCharge === true && (table.status === "occupied" || table.status === "payment")),
    [waiter.tables],
  );
  const selectedTable = selectedTableId ? checkoutTables.find((table) => table.id === selectedTableId) : undefined;
  const orders = selectedTable?.guests ?? [];
  const total = selectedTable?.currentBill ?? 0;
  const hasOrders = orders.length > 0;
  const isCheckoutAllowed = selectedTable
    ? selectedTable.canCharge === true && (selectedTable.status === "occupied" || selectedTable.status === "payment")
    : false;

  const splitLines = useMemo<SplitLine[]>(() => (
    orders.flatMap((guest) => guest.items.map((item) => ({
      guest,
      item,
      amount: item.price * item.quantity,
      paid: isSplitItemPaid(guest, item),
    })))
  ), [orders]);

  const unpaidSplitLines = splitLines.filter((line) => !line.paid);
  const paidSplitTotal = splitLines
    .filter((line) => line.paid)
    .reduce((sum, line) => sum + line.amount, 0);
  const remainingSplitTotal = unpaidSplitLines.reduce((sum, line) => sum + line.amount, 0);
  const allSplitPaid = splitLines.length > 0 && unpaidSplitLines.length === 0;
  const selectedSplitLines = splitLines.filter((line) => splitSelection.includes(line.item.id) && !line.paid);
  const selectedSplitTotal = selectedSplitLines.reduce((sum, line) => sum + line.amount, 0);
  const splitPaymentLines = splitLines.filter((line) => splitPaymentItemIds.includes(line.item.id) && !line.paid);
  const splitPaymentTotal = splitPaymentLines.reduce((sum, line) => sum + line.amount, 0);

  const progress = splitLines.length ? (paidSplitTotal / Math.max(total, 1)) * 100 : 0;
  const allItemsPaid = splitLines.length > 0 && splitLines.every((line) => line.paid);
  const canCloseWithoutPayment = Boolean(selectedTable && isCheckoutAllowed && total <= 0);
  const canCloseTable = allItemsPaid || canCloseWithoutPayment;
  const canStartPaymentFlow = Boolean(selectedTable && isCheckoutAllowed && hasOrders && total > 0 && !allItemsPaid);

  const getCheckoutBlockMessage = (table: { canCharge: boolean; status: WaiterTableStatus }) => {
    if (!table.canCharge) {
      return chargeDeniedMessage;
    }

    return "Naplata je dostupna samo za zauzete stolove i stolove koji cekaju naplatu.";
  };

  const choosePaymentMethod = (method: WaiterPaymentMethod) => {
    setSelectedPaymentMethod(method);
    setSelectedPaymentType(null);
  };

  useEffect(() => {
    if (!tableId) {
      closePanel();
      return;
    }

    const table = waiter.getTable(tableId);
    if (!table) return;

    if (!table.canCharge || (table.status !== "occupied" && table.status !== "payment")) {
      setShakeTableId(tableId);
      setToast(getCheckoutBlockMessage(table));
      closePanel();
      return;
    }

    setSelectedTableId(tableId);
    setPhase("overview");
    setModalMode(null);
    setSplitSelection([]);
    setSplitPaymentItemIds([]);
    setSelectedPaymentMethod(table.paymentMethod ?? null);
    setSelectedPaymentType(null);
    setTip("");
  }, [tableId, waiter.tables, chargeDeniedMessage]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!shakeTableId) return;
    const timer = window.setTimeout(() => setShakeTableId(""), 550);
    return () => window.clearTimeout(timer);
  }, [shakeTableId]);

  const selectTable = (nextTableId: string) => {
    const table = waiter.getTable(nextTableId);

    if (!table) return;

    if (!table.canCharge) {
      setShakeTableId(nextTableId);
      setToast(getCheckoutBlockMessage(table));
      closePanel();
      return;
    }

    if (table.status === "free") {
      setShakeTableId(nextTableId);
      closePanel();
      return;
    }

    if (table.status === "reserved") {
      setShakeTableId(nextTableId);
      closePanel();
      return;
    }

    setSelectedTableId(nextTableId);
    setPhase("overview");
    setModalMode(null);
    setSplitSelection([]);
    setSplitPaymentItemIds([]);
    setSelectedPaymentMethod(table.paymentMethod ?? null);
    setSelectedPaymentType(null);
    setTip("");
  };

  const closePanel = () => {
    setSelectedTableId("");
    setPhase("idle");
    setModalMode(null);
    setSplitSelection([]);
    setSplitPaymentItemIds([]);
    setSelectedPaymentMethod(null);
    setSelectedPaymentType(null);
    setTip("");
  };

  const closeFinal = async (message: string) => {
    if (!selectedTable) return;

    try {
      await waiter.closeTable(selectedTable.id);
      setModalMode(null);
      setPhase("done");
      setToast(message);
      window.setTimeout(closePanel, 1000);
    } catch (error) {
      setModalMode(null);
      setPhase("overview");
      setToast(error instanceof Error ? error.message : "Sto nije zatvoren. Proverite naplatu.");
    }
  };

  const releaseFinal = async () => {
    if (!selectedTable) return;
    await waiter.releaseTable(selectedTable.id);
    setModalMode(null);
    setPhase("done");
    setToast(`Sto ${selectedTable.number} je oslobođen.`);
    window.setTimeout(closePanel, 1000);
  };

  const openSinglePayment = () => {
    if (!selectedTable || !selectedPaymentMethod) {
      setToast("Prvo izaberite način plaćanja.");
      return;
    }

    setSelectedPaymentType("single");
    setPhase("payment");
    setModalMode(selectedPaymentMethod === "card" ? "online" : "cash");
  };

  const confirmSinglePayment = async (method: WaiterPaymentMethod) => {
    if (!selectedTable) return;

    try {
      await waiter.markTablePaid(selectedTable.id, method);
      setModalMode(null);
      setPhase("overview");
      setTip("");
      setToast(`Plaćanje (${paymentMethodLabel(method).toLowerCase()}) je evidentirano - sto čeka naplatu.`);
    } catch (error) {
      setModalMode(null);
      setPhase("overview");
      setToast(error instanceof Error ? error.message : "Plaćanje nije evidentirano.");
    }
  };

  const startSplitPayment = () => {
    if (!selectedTable || !hasOrders) return;

    if (!selectedPaymentMethod) {
      setToast("Prvo izaberite način plaćanja.");
      return;
    }

    setSelectedPaymentType("split");
    waiter.beginSplitPayment(selectedTable.id, selectedPaymentMethod);
    setSplitSelection([]);
    setSplitPaymentItemIds([]);
    setModalMode(null);
    setPhase("split");
  };

  const toggleSplitItem = (itemId: string, checked: boolean) => {
    setSplitSelection((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }

      return current.filter((id) => id !== itemId);
    });
  };

  const toggleSplitGuest = (guest: TableGuest, checked: boolean) => {
    const unpaidItemIds = guest.items
      .filter((item) => !isSplitItemPaid(guest, item))
      .map((item) => item.id);

    setSplitSelection((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...unpaidItemIds]));
      }

      return current.filter((id) => !unpaidItemIds.includes(id));
    });
  };

  const clearSplitSelection = () => setSplitSelection([]);

  const selectAllUnpaidSplitItems = () => {
    setSplitSelection(unpaidSplitLines.map((line) => line.item.id));
  };

  const openSelectedSplitPayment = () => {
    const itemIds = selectedSplitLines.map((line) => line.item.id);

    if (!selectedTable || itemIds.length === 0) {
      setToast("Izaberite bar jednu nenaplaćenu stavku.");
      return;
    }

    if (!selectedPaymentMethod && !selectedTable.paymentMethod) {
      setToast("Prvo izaberite način plaćanja.");
      setPhase("overview");
      return;
    }

    setSplitPaymentItemIds(itemIds);
    setModalMode("splitCash");
    setPhase("payment");
  };

  const confirmSplitPayment = async () => {
    if (!selectedTable || splitPaymentItemIds.length === 0) return;

    const remainingAfterPayment = unpaidSplitLines.filter(
      (line) => !splitPaymentItemIds.includes(line.item.id),
    ).length;

    try {
      await waiter.markSplitItemsPaid(selectedTable.id, splitPaymentItemIds, selectedPaymentMethod ?? undefined);
      setSplitSelection([]);
      setSplitPaymentItemIds([]);
      setModalMode(null);
      setPhase("split");
      setTip("");
      setToast(
        remainingAfterPayment === 0
          ? "Sve stavke su naplaćene."
          : "Izabrane stavke su označene kao plaćene.",
      );
    } catch (error) {
      setModalMode(null);
      setSplitPaymentItemIds([]);
      setPhase("split");
      setToast(error instanceof Error ? error.message : "Plaćanje nije evidentirano.");
    }
  };

  const headerText = selectedTable
    ? phase === "split" || modalMode === "splitCash"
      ? `Sto ${selectedTable.number} - podeljeno plaćanje`
      : `Sto ${selectedTable.number} - ${selectedTable.sectorName}`
    : "Kliknite na sto koji čeka naplatu da pokrenete proces zatvaranja.";

  const step1Class = phase === "idle" || phase === "overview" || phase === "split" ? "active" : "done";
  const step2Class = phase === "payment" ? "active" : ["closing", "done"].includes(phase) ? "done" : "";
  const step3Class = phase === "closing" ? "active" : phase === "done" ? "done" : "";

  return (
    <div className="waiter-flow-page checkout-page">
      <div className="close-header">
        <div className="close-header-top">
          <div className="close-title">
            <h1>Zatvaranje stola i naplata</h1>
            <p>{headerText}</p>
          </div>
          <div className="step-wizard">
            <div className={`step-item ${step1Class}`}>
              <div className="step-circle"><span>1</span></div>
              <span className="step-label">Pregled stola</span>
            </div>
            <div className={`step-connector ${["payment", "closing", "done"].includes(phase) ? "done" : ""}`} />
            <div className={`step-item ${step2Class}`}>
              <div className="step-circle"><span>2</span></div>
              <span className="step-label">Potvrda naplate</span>
            </div>
            <div className={`step-connector ${["closing", "done"].includes(phase) ? "done" : ""}`} />
            <div className={`step-item ${step3Class}`}>
              <div className="step-circle"><span>3</span></div>
              <span className="step-label">Zatvaranje</span>
            </div>
          </div>
        </div>
        <TableStatusLegend />
      </div>

      <div className="waiter-workspace-shell checkout-workspace-shell">
        <div className="map-canvas-container waiter-workspace waiter-prototype-picker-shell">
          <WaiterTablePicker
            tables={checkoutTables}
            selectedTableId={selectedTableId}
            shakeTableId={shakeTableId}
            allowedStatuses={["occupied", "payment"]}
            onSelectTable={selectTable}
          />
        </div>

        <aside className={`info-panel waiter-slide-panel checkout-info-panel ${selectedTable ? "open" : ""}`}>
          <div className="info-panel-accent" />
          {selectedTable ? (
            <div>
              <IconButton className="panel-close-btn" onClick={closePanel}>x</IconButton>

              <div className="panel-table-header">
                <div className="panel-table-badge">{selectedTable.number}</div>
                <div>
                  <div className="panel-table-name">{selectedTable.guestLabel ?? "Sto bez gostiju"}</div>
                  <div className="panel-table-meta">Sto {selectedTable.number} - {selectedTable.sectorName}</div>
                </div>
                <GlassBadge tone={checkoutStatusTones[selectedTable.status]} dot>
                  {checkoutStatusLabels[selectedTable.status]}
                </GlassBadge>
              </div>

              <div className="panel-divider" />

              {phase === "split" || modalMode === "splitCash" ? (
                <>
                  <div className="split-back-row">
                    <GlassButton type="button" size="compact" onClick={() => { setModalMode(null); setPhase("overview"); }}>Nazad</GlassButton>
                  </div>

                  <div className="panel-section-label">Izaberite goste ili pojedinačne stavke za naplatu</div>
                  <div className="guest-transfer-list split-guest-list checkout-split-guest-list">
                    {orders.map((guest) => {
                      const guestTotal = waiter.getGuestTotal(guest);
                      const guestPaidTotal = guest.items.reduce(
                        (sum, item) => sum + (isSplitItemPaid(guest, item) ? item.price * item.quantity : 0),
                        0,
                      );
                      const unpaidItems = guest.items.filter((item) => !isSplitItemPaid(guest, item));
                      const unpaidItemIds = unpaidItems.map((item) => item.id);
                      const selectedCount = unpaidItemIds.filter((id) => splitSelection.includes(id)).length;
                      const guestFullyPaid = guest.items.length > 0 && unpaidItems.length === 0;
                      const guestChecked = unpaidItemIds.length > 0 && selectedCount === unpaidItemIds.length;

                      return (
                        <article
                          className={`waiter-transfer-guest-card checkout-split-guest-card ${guestFullyPaid ? "checked guest-paid" : selectedCount > 0 ? "selected" : ""}`}
                          key={guest.id}
                        >
                          <label className="checkout-split-guest-head waiter-transfer-guest-head">
                            <input
                              type="checkbox"
                              className="oci-cb checkout-split-checkbox"
                              checked={guestChecked}
                              disabled={guestFullyPaid}
                              onChange={(event) => toggleSplitGuest(guest, event.currentTarget.checked)}
                            />
                            <span>
                              <strong>{guest.guestName}</strong>
                              <small>{guestFullyPaid ? "Sve plaćeno" : selectedCount > 0 ? `${selectedCount}/${unpaidItemIds.length} izabrano` : "Izaberite stavke"}</small>
                            </span>
                            <b>{formatRsd(guestTotal)}</b>
                          </label>

                          <div className="checkout-split-item-list">
                            {guest.items.map((item) => {
                              const paid = isSplitItemPaid(guest, item);
                              const checked = paid || splitSelection.includes(item.id);

                              return (
                                <label
                                  className={`checkout-split-item-row ${paid ? "paid" : checked ? "selected" : ""}`}
                                  key={item.id}
                                >
                                  <input
                                    type="checkbox"
                                    className="oci-cb checkout-split-checkbox"
                                    checked={checked}
                                    disabled={paid}
                                    onChange={(event) => toggleSplitItem(item.id, event.currentTarget.checked)}
                                  />
                                  <span className="ov-qty">{item.quantity}x</span>
                                  <span className="ov-oname">
                                    {item.name}
                                    {item.note ? <em>{item.note}</em> : null}
                                  </span>
                                  <span className="ov-price">{formatRsd(item.price * item.quantity)}</span>
                                </label>
                              );
                            })}
                          </div>

                          <div className="checkout-split-card-footer">
                            <GlassBadge tone={guestFullyPaid ? "success" : "warning"} dot>
                              {guestFullyPaid ? "Plaćeno" : `Preostalo ${formatRsd(Math.max(guestTotal - guestPaidTotal, 0))}`}
                            </GlassBadge>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="split-progress-wrap checkout-split-progress">
                    <div className="split-progress-topline">
                      <div>
                        <span className="split-progress-label">Naplaćeno</span>
                        <strong>{formatRsd(paidSplitTotal)}</strong>
                      </div>
                      <div>
                        <span className="split-progress-label">Preostalo</span>
                        <strong>{formatRsd(remainingSplitTotal)}</strong>
                      </div>
                      <div>
                        <span className="split-progress-label">Izabrano</span>
                        <strong>{formatRsd(selectedSplitTotal)}</strong>
                      </div>
                    </div>
                    <div className="split-progress-bar-bg">
                      <div className="split-progress-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                    </div>
                  </div>

                  <div className="partial-count-bar checkout-split-bulk-row">
                    <span>{selectedSplitLines.length} stavki izabrano</span>
                    <div className="partial-bulk-btns">
                      <GlassButton type="button" size="compact" onClick={selectAllUnpaidSplitItems}>Sve nenaplaćeno</GlassButton>
                      <GlassButton type="button" size="compact" variant="muted" onClick={clearSplitSelection}>Ništa</GlassButton>
                    </div>
                  </div>

                  <div className="panel-actions checkout-split-actions">
                    <GlassButton
                      type="button"
                      variant="primary"
                      fullWidth
                      disabled={selectedSplitTotal <= 0}
                      onClick={openSelectedSplitPayment}
                    >
                      Naplati izabrano
                    </GlassButton>
                    <GlassButton
                      type="button"
                      variant="primary"
                      fullWidth
                      disabled={!allSplitPaid}
                      onClick={() => { setPhase("closing"); setModalMode("splitClose"); }}
                    >
                      Zatvori sto
                    </GlassButton>
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-section-label">Stavke i narudžbine</div>
                  <div className="panel-orders-list">
                    {orders.length === 0 ? <div className="orders-empty">Sto nema narudžbine.</div> : null}
                    {orders.map((guest) => (
                      <div className="ov-guest-group" key={guest.id}>
                        <div className="ov-guest-name">
                          {guest.guestName}
                          <GlassBadge tone={guest.paid ? "success" : "warning"} dot>
                            {guest.paid ? "Plaćeno" : "Nije plaćeno"}
                          </GlassBadge>
                        </div>
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
                    <span>Ukupno za naplatu</span>
                    <span className="panel-total-amount">{formatRsd(total)}</span>
                  </div>


                  <div className="panel-divider" />
                  <div className="panel-actions checkout-payment-flow-actions">
                    {canCloseTable ? (
                      <GlassButton type="button" variant="primary" fullWidth onClick={() => { setPhase("closing"); setModalMode("splitClose"); }}>
                        Zatvori sto
                      </GlassButton>
                    ) : null}
                    {canStartPaymentFlow ? (
                      <>
                        <div className="checkout-choice-section">
                          <div className="panel-section-label">1. Način plaćanja</div>
                          <div className="checkout-choice-grid">
                            <GlassButton
                              type="button"
                              variant={selectedPaymentMethod === "cash" ? "warning" : "muted"}
                              className={`waiter-panel-choice-btn ${selectedPaymentMethod === "cash" ? "is-selected" : "is-unselected"}`}
                              fullWidth
                              onClick={() => choosePaymentMethod("cash")}
                            >
                              Gotovina
                            </GlassButton>
                            <GlassButton
                              type="button"
                              variant={selectedPaymentMethod === "card" ? "warning" : "muted"}
                              className={`waiter-panel-choice-btn ${selectedPaymentMethod === "card" ? "is-selected" : "is-unselected"}`}
                              fullWidth
                              onClick={() => choosePaymentMethod("card")}
                            >
                              Kartica
                            </GlassButton>
                          </div>
                        </div>

                        <div className="checkout-choice-section">
                          <div className="panel-section-label">2. Tip naplate</div>
                          <div className="checkout-choice-grid">
                            <GlassButton
                              type="button"
                              variant={selectedPaymentType === "single" ? "warning" : "muted"}
                              className={`waiter-panel-choice-btn ${selectedPaymentType === "single" ? "is-selected" : "is-unselected"}`}
                              fullWidth
                              disabled={!selectedPaymentMethod}
                              onClick={openSinglePayment}
                            >
                              Sve zajedno
                            </GlassButton>
                            <GlassButton
                              type="button"
                              variant={selectedPaymentType === "split" ? "warning" : "muted"}
                              className={`waiter-panel-choice-btn ${selectedPaymentType === "split" ? "is-selected" : "is-unselected"}`}
                              fullWidth
                              disabled={!selectedPaymentMethod}
                              onClick={startSplitPayment}
                            >
                              Podeljeno plaćanje
                            </GlassButton>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      <AppModal
        open={modalMode === "cash"}
        title="Potvrdi gotovinsko plaćanje"
        subtitle={selectedTable ? `Sto ${selectedTable.number}` : ""}
        onClose={() => setModalMode(null)}
        footer={
          <div className="modal-actions">
            <GlassButton type="button" variant="muted" onClick={() => setModalMode(null)}>Otkaži</GlassButton>
            <GlassButton type="button" variant="primary" onClick={() => confirmSinglePayment("cash")}>
              Potvrdi naplatu
            </GlassButton>
          </div>
        }
      >
        <div className="amount-summary-row">
          <span className="amount-label">Iznos</span>
          <span className="amount-value">{formatRsd(total)}</span>
        </div>
        <ModalTextField label="Bakšiš" value={tip} onChange={setTip} placeholder="Opcioni iznos" />
      </AppModal>

      <AppModal
        open={modalMode === "online"}
        title="Potvrdi kartično plaćanje"
        subtitle={selectedTable ? `Sto ${selectedTable.number}` : ""}
        onClose={() => setModalMode(null)}
        footer={
          <div className="modal-actions">
            <GlassButton type="button" variant="muted" onClick={() => setModalMode(null)}>Otkaži</GlassButton>
            <GlassButton type="button" variant="primary" onClick={() => confirmSinglePayment("card")}>
              Potvrdi karticu
            </GlassButton>
          </div>
        }
      >
        <div className="amount-summary-row checkout-paid-summary">
          <span className="amount-label">Iznos za naplatu</span>
          <span className="amount-value">{formatRsd(total)}</span>
        </div>
      </AppModal>

      <AppModal
        open={modalMode === "splitCash"}
        title={`Potvrdi podeljenu naplatu - ${paymentMethodLabel(selectedPaymentMethod ?? selectedTable?.paymentMethod)}`}
        subtitle={splitPaymentLines.length ? `${splitPaymentLines.length} stavki za naplatu` : "Izabrane stavke"}
        onClose={() => { setModalMode(null); setSplitPaymentItemIds([]); setPhase("split"); }}
        footer={
          <div className="modal-actions">
            <GlassButton type="button" variant="muted" onClick={() => { setModalMode(null); setSplitPaymentItemIds([]); setPhase("split"); }}>Otkaži</GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              disabled={splitPaymentTotal <= 0}
              onClick={confirmSplitPayment}
            >
              Potvrdi naplatu
            </GlassButton>
          </div>
        }
      >
        <div className="amount-summary-row">
          <span className="amount-label">Iznos za izabrane stavke</span>
          <span className="amount-value">{formatRsd(splitPaymentTotal)}</span>
        </div>
        <div className="split-modal-lines">
          {splitPaymentLines.map((line) => (
            <div className="split-modal-line" key={line.item.id}>
              <span>{line.guest.guestName}</span>
              <strong>{line.item.quantity}x {line.item.name}</strong>
              <b>{formatRsd(line.amount)}</b>
            </div>
          ))}
        </div>
      </AppModal>

      <AppModal
        open={modalMode === "splitClose"}
        title="Zatvori sto"
        subtitle={canCloseWithoutPayment ? "Nema iznosa za naplatu" : "Sve stavke su naplaćene"}
        onClose={() => { setModalMode(null); setPhase("overview"); }}
        footer={
          <div className="modal-actions">
            <GlassButton type="button" variant="muted" onClick={() => { setModalMode(null); setPhase("overview"); }}>Otkaži</GlassButton>
            <GlassButton type="button" variant="primary" disabled={!canCloseTable} onClick={() => closeFinal(`Sto ${selectedTable?.number} je zatvoren`)}>
              Zatvori sto
            </GlassButton>
          </div>
        }
      >
        <div className="amount-summary-row checkout-paid-summary">
          <span className="amount-label">{canCloseWithoutPayment ? "Za naplatu" : "Ukupno naplaćeno"}</span>
          <span className="amount-value">{formatRsd(total)}</span>
        </div>
      </AppModal>

      <AppModal
        open={modalMode === "release"}
        title="Oslobodi sto"
        subtitle={selectedTable ? `Sto ${selectedTable.number}` : ""}
        onClose={() => setModalMode(null)}
        footer={
          <div className="modal-actions">
            <GlassButton type="button" variant="muted" onClick={() => setModalMode(null)}>Otkaži</GlassButton>
            <GlassButton type="button" variant="warning" onClick={releaseFinal}>
              Oslobodi sto
            </GlassButton>
          </div>
        }
      >
        <></>
      </AppModal>

      {toast ? <div className="toast visible"><span className="toast-icon">OK</span>{toast}</div> : null}
    </div>
  );
}
