// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "../../../app/routes";
import type { MenuItem } from "../../../entities/menu/menu.types";
import type { ManualOrderCartItem } from "../../../entities/waiter/waiter.types";
import { GlassDropdown, type GlassDropdownOption } from "../../../shared/forms/GlassDropdown";
import { GlassSearchInput } from "../../../shared/forms/GlassSearchInput";
import { ModalTextField } from "../../../shared/forms/ModalTextField";
import { AppModal } from "../../../shared/modals/AppModal";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { IconButton } from "../../../shared/ui/IconButton";
import { TableStatusLegend } from "../shared/TableStatusLegend";
import { WaiterTablePicker } from "../shared/WaiterTablePicker";
import { formatRsd } from "../workspace/formatRsd";
import { useWaiterData } from "../workspace/useWaiterData";

export function ManualOrderFeature() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const waiter = useWaiterData();
  const [selectedTableId, setSelectedTableId] = useState(tableId ?? "");
  const [step, setStep] = useState<"tables" | "menu">(tableId ? "menu" : "tables");
  const [cart, setCart] = useState<ManualOrderCartItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategoryId, setMenuCategoryId] = useState("all");
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [scopeNotice, setScopeNotice] = useState("");

  const selectedTable = selectedTableId
    ? waiter.getTable(selectedTableId)
    : undefined;
  const manualOrderEnabled = Boolean(waiter.activeShift && waiter.assignedSector);
  const allowedTables = useMemo(
    () => waiter.assignedSector
      ? waiter.tables.filter((table) => table.sectorId === waiter.assignedSector?.id)
      : [],
    [waiter.assignedSector, waiter.tables],
  );
  const selectedTableAllowed = Boolean(
    selectedTable
      && waiter.assignedSector
      && selectedTable.sectorId === waiter.assignedSector.id,
  );

  useEffect(() => {
    if (!waiter.profile || !selectedTableId) {
      return;
    }

    if (manualOrderEnabled && selectedTableAllowed) {
      return;
    }

    setSelectedTableId("");
    setCart([]);
    setStep("tables");
    setSubmitError("");
    setScopeNotice(
      manualOrderEnabled
        ? "Izabrani sto više nije dostupan u tvom trenutnom sektoru."
        : "Nemaš aktivnu smenu ili dodeljen sektor za ručni unos.",
    );
    navigate(routes.waiter.manualOrderBase, { replace: true });
  }, [
    manualOrderEnabled,
    navigate,
    selectedTableAllowed,
    selectedTableId,
    waiter.profile,
  ]);
  const activeMenuItems = useMemo(() => {
    const normalizedSearch = menuSearch.trim().toLowerCase();

    return waiter.menuItems.filter((item) => {
      const matchesStatus = item.status === "active";
      const matchesCategory = menuCategoryId === "all" || item.categoryId === menuCategoryId;
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [menuCategoryId, menuSearch, waiter.menuItems]);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const hasExistingOrders = Boolean(selectedTable?.guests.length);

  const categoryOptions = useMemo<GlassDropdownOption<string>[]>(
    () => [
      { label: "Sve kategorije", value: "all", icon: "☷" },
      ...waiter.menuCategories
        .filter((category) => category.active)
        .map((category) => ({
          label: category.name,
          value: category.id,
          icon: category.emoji || "☷",
        })),
    ],
    [waiter.menuCategories],
  );
  const categoryNameById = useMemo(
    () => new Map(waiter.menuCategories.map((category) => [category.id, category.name])),
    [waiter.menuCategories],
  );

  const chooseTable = (nextTableId: string) => {
    const nextTable = waiter.getTable(nextTableId);

    if (
      !nextTable
      || !waiter.activeShift
      || !waiter.assignedSector
      || nextTable.sectorId !== waiter.assignedSector.id
    ) {
      setScopeNotice(
        waiter.activeShift && waiter.assignedSector
          ? "Ručni unos je dozvoljen samo za stolove iz tvog trenutnog sektora."
          : "Nemaš aktivnu smenu ili dodeljen sektor za ručni unos.",
      );
      return;
    }

    setScopeNotice("");
    setSubmitError("");
    setSelectedTableId(nextTable.id);
    setCart([]);
    setStep("menu");
  };

  const backToTables = () => {
    setCart([]);
    setSelectedTableId("");
    setStep("tables");
  };

  const returnToTableMap = () => {
    setCart([]);
    navigate(routes.waiter.tables);
  };

  const addToCart = (item: MenuItem) => {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (cartItem) => cartItem.menuItemId === item.id,
      );
      if (existing) {
        return currentCart.map((cartItem) =>
          cartItem.menuItemId === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }

      return [
        ...currentCart,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          options: [],
          note: "",
        },
      ];
    });
  };

  const changeQuantity = (menuItemId: string, delta: number) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.menuItemId === menuItemId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const openOptions = (item: MenuItem) => {
    const cartItem = cart.find(
      (currentItem) => currentItem.menuItemId === item.id,
    );
    if (!cartItem) return;

    setEditingItem(item);
    setDraftNote(cartItem.note);
    setSelectedOptions(cartItem.options);
  };

  const saveOptions = () => {
    if (!editingItem) return;

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.menuItemId === editingItem.id
          ? { ...item, note: draftNote.trim(), options: selectedOptions }
          : item,
      ),
    );
    setEditingItem(null);
  };

  const sendOrder = async () => {
    if (!selectedTable || cart.length === 0) return;

    if (!manualOrderEnabled || !selectedTableAllowed) {
      setSubmitError(
        manualOrderEnabled
          ? "Ručni unos je dozvoljen samo za stolove iz tvog trenutnog sektora."
          : "Nemaš aktivnu smenu ili dodeljen sektor za ručni unos.",
      );
      return;
    }

    try {
      setSubmitError("");
      await waiter.addManualOrder(selectedTable.id, cart);
      setCart([]);
      setSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Narudzbina nije sacuvana.");
    }
  };

  return (
    <div className="manual-order-page">
      <div className="manual-header map-header manual-header-with-legend">
        <div className="manual-header-main header-row-top">
          <div className="manual-header-left">
            <h1>
              {step === "menu" && selectedTable
                ? `Unos narudžbine - Sto ${selectedTable.number}`
                : "Ručni unos narudžbine"}
            </h1>
            <p>
              {step === "menu" && selectedTable
                ? `${selectedTable.sectorName} - ${hasExistingOrders ? "Dopuna postojeće narudžbine" : "Nova narudžbina"}`
                : "Izaberite sto za ručni unos."}
            </p>
          </div>
          <div className="manual-header-right">
            {step === "menu" && selectedTable ? (
              <div className="manual-context-block">
                <div className="manual-toolbar-actions">
                  <GlassButton
                    type="button"
                    size="compact"
                    onClick={backToTables}
                  >
                    Odustani
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="muted"
                    size="compact"
                    onClick={returnToTableMap}
                  >
                    Vrati se na mapu stolova
                  </GlassButton>
                </div>
                <div className="manual-context-meta">
                  Sto {selectedTable.number} · {selectedTable.sectorName}
                </div>
              </div>
            ) : (
              <GlassButton
                type="button"
                variant="muted"
                size="compact"
                onClick={returnToTableMap}
              >
                Vrati se na mapu stolova
              </GlassButton>
            )}
          </div>
        </div>

        <div className="header-row-middle manual-header-legend-row">
          <TableStatusLegend />
        </div>
      </div>

      {step === "tables" ? (
        <div className="map-canvas-container waiter-workspace waiter-prototype-picker-shell">
          {!manualOrderEnabled ? (
            <div className="empty-state visible">
              <div className="empty-title">Ručni unos nije dostupan</div>
              <div className="empty-sub">Nemaš aktivnu smenu ili dodeljen sektor za ručni unos.</div>
            </div>
          ) : allowedTables.length === 0 ? (
            <div className="empty-state visible">
              <div className="empty-title">Nema dostupnih stolova</div>
              <div className="empty-sub">U tvom trenutnom sektoru nema aktivnih stolova za izbor.</div>
            </div>
          ) : (
            <WaiterTablePicker
              tables={allowedTables}
              selectedTableId={selectedTable?.id}
              onSelectTable={chooseTable}
            />
          )}
          {scopeNotice ? <div className="field-error-msg visible manual-scope-message">{scopeNotice}</div> : null}
        </div>
      ) : selectedTable && selectedTableAllowed ? (
        <div className="step-menu">
          <section className="menu-panel">
            <div className="menu-panel-card manual-menu-toolbar-card">
              <div className="menu-filters-row manual-menu-filters">
                <div className="search-wrapper">
                  <GlassSearchInput
                    value={menuSearch}
                    onChange={setMenuSearch}
                    placeholder="Pretražite meni..."
                  />
                </div>

                <div className="category-dropdown-wrapper manual-category-dropdown-wrap">
                  <GlassDropdown
                    value={menuCategoryId}
                    options={categoryOptions}
                    onChange={setMenuCategoryId}
                    placeholder="Sve kategorije"
                    className="manual-category-dropdown"
                    triggerClassName="category-filter-trigger manual-category-trigger"
                  />
                </div>
              </div>
            </div>

            <div className="menu-panel-card menu-items-scroll">
              <div className="menu-items-grid">
                {activeMenuItems.map((item) => {
                  const cartItem = cart.find(
                    (currentItem) => currentItem.menuItemId === item.id,
                  );

                  return (
                    <button
                      type="button"
                      className={`menu-item-card ${cartItem ? "in-cart" : ""}`}
                      key={item.id}
                      onClick={() => addToCart(item)}
                    >
                      <div className="manual-menu-item-image">
                        <span className="manual-menu-item-image-fallback">OT</span>
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="menu-item-name">{item.name}</div>
                      <div className="menu-item-desc">
                        {item.description || categoryNameById.get(item.categoryId) || "Artikal iz menija"}
                      </div>
                      <div className="manual-menu-item-category">
                        {categoryNameById.get(item.categoryId) ?? "Meni"}
                      </div>
                      <div className="menu-item-footer">
                        <div className="menu-item-price">
                          {formatRsd(item.price)}
                        </div>
                        <div className="menu-item-add-btn" aria-hidden="true">
                          +
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="cart-panel">
            <IconButton className="panel-close-btn" onClick={backToTables}>×</IconButton>
            <div className="cart-header">
              <div className="cart-title">Privremena lista</div>
              <div className="cart-count">
                {cart.length === 1 ? "1 stavka" : `${cart.length} stavki`}
              </div>
            </div>
            <div className="cart-divider" />

            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <div className="cart-empty-text">
                    Dodajte stavke iz menija
                  </div>
                </div>
              ) : null}
              {cart.map((item) => {
                const menuItem = waiter.menuItems.find(
                  (currentItem) => currentItem.id === item.menuItemId,
                );
                const notePreview = [...item.options, item.note]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <div
                    className={`cart-item ${notePreview ? "has-note" : ""}`}
                    key={item.menuItemId}
                  >
                    <button
                      type="button"
                      className="cart-item-name"
                      onClick={() => menuItem && openOptions(menuItem)}
                    >
                      {item.name}
                    </button>
                    {notePreview ? (
                      <div className="cart-item-note-preview">
                        {notePreview}
                      </div>
                    ) : null}
                    <div className="cart-item-bottom">
                      <div className="qty-controls">
                        <IconButton
                          variant="danger"
                          onClick={() => changeQuantity(item.menuItemId, -1)}
                        >
                          −
                        </IconButton>
                        <div className="qty-num">{item.quantity}</div>
                        <IconButton
                          onClick={() => changeQuantity(item.menuItemId, 1)}
                        >
                          +
                        </IconButton>
                      </div>
                      <div className="cart-item-price">
                        {formatRsd(item.price * item.quantity)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="cart-footer">
              <div className="cart-divider" />
              <div className="cart-total-row">
                <div className="cart-total-label">Ukupno</div>
                <div className="cart-total-amount">{formatRsd(total)}</div>
              </div>
              <GlassButton
                type="button"
                variant="primary"
                fullWidth
                disabled={cart.length === 0 || !manualOrderEnabled || !selectedTableAllowed}
                onClick={sendOrder}
              >
                {hasExistingOrders ? "Pošalji dopunu" : "Pošalji narudžbinu"}
              </GlassButton>
              {submitError ? <div className="field-error-msg visible">{submitError}</div> : null}
            </div>
          </aside>
        </div>
      ) : null}

      <AppModal
        open={editingItem !== null}
        title={editingItem?.name ?? "Stavka"}
        subtitle={editingItem ? formatRsd(editingItem.price) : ""}
        onClose={() => setEditingItem(null)}
        footer={
          <div className="modal-actions">
            <GlassButton
              type="button"
              variant="muted"
              onClick={() => setEditingItem(null)}
            >
              Otkaži
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              onClick={saveOptions}
            >
              Potvrdi
            </GlassButton>
          </div>
        }
      >
        {editingItem ? (
          <>
            {editingItem.optionGroups.map((group) => (
              <div className="options-section" key={group.id}>
                <div className="options-section-label">{group.name}</div>
                <div className="options-grid">
                  {group.options.map((option) => (
                    <button
                      type="button"
                      className={`option-pill ${selectedOptions.includes(option.name) ? "selected" : ""}`}
                      key={option.id}
                      onClick={() =>
                        setSelectedOptions((current) =>
                          current.includes(option.name)
                            ? current.filter((name) => name !== option.name)
                            : [...current, option.name],
                        )
                      }
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <ModalTextField
              label="Napomena za pripremu"
              value={draftNote}
              onChange={setDraftNote}
              multiline
              placeholder="npr. bez luka, alergija, dobro pečeno..."
            />
          </>
        ) : null}
      </AppModal>

      {success ? (
        <div className="success-overlay visible">
          <div className="success-box">
            <div className="success-title">Narudžbina je poslata!</div>
            <p className="success-sub">
              Narudžbina za sto {selectedTable?.number ?? "—"} je kreirana sa
              statusom u pripremi.
            </p>
            <GlassButton
              type="button"
              variant="primary"
              onClick={() => {
                setSuccess(false);
                setSelectedTableId("");
                setStep("tables");
              }}
            >
              Vrati se na stolove
            </GlassButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
