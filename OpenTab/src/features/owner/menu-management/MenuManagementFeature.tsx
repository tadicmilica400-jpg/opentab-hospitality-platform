// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { MenuItem, MenuItemFormValues } from "../../../entities/menu/menu.types";
import { CategoryManagerModal } from "./components/CategoryManagerModal";
import { MenuFilters } from "./components/MenuFilters";
import { MenuItemFormModal } from "./components/MenuItemFormModal";
import { MenuItemsGrid } from "./components/MenuItemsGrid";
import { MenuStatusPills } from "./components/MenuStatusPills";
import { MenuToolbar } from "./components/MenuToolbar";
import { useMenu } from "./hooks/useMenu";

type ItemModalState =
  | { mode: "create"; item: null; initialCategoryId?: string }
  | { mode: "edit"; item: MenuItem }
  | null;

type MenuToastState = {
  id: number;
  message: string;
} | null;

export function MenuManagementFeature() {
  const menu = useMenu();
  const [searchParams, setSearchParams] = useSearchParams();
  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [toast, setToast] = useState<MenuToastState>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (searchParams.get("modal") === "categories") {
      setIsCategoryModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const closeCategoryManager = () => {
    setIsCategoryModalOpen(false);

    if (searchParams.get("modal") === "categories") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("modal");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const openCreateItemModal = () => {
    if (searchParams.get("modal") === "categories") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("modal");
      setSearchParams(nextParams, { replace: true });
    }

    setIsCategoryModalOpen(false);
    setItemModal({ mode: "create", item: null });
  };

  const handleSubmitItem = async (values: MenuItemFormValues) => {
    if (!itemModal) {
      return {
        ok: false as const,
        message: "Forma nije otvorena.",
      };
    }

    const result =
      itemModal.mode === "create"
        ? await menu.createItem(values)
        : await menu.updateItem(itemModal.item.id, values);

    if (result.ok) {
      setItemModal(null);
      showToast(itemModal.mode === "create" ? "Stavka je dodata u bazu." : "Stavka je izmenjena u bazi.");
    }

    return result;
  };

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

  const handleToggleStatus = async (itemId: string) => {
    const item = menu.items.find((currentItem) => currentItem.id === itemId);

    if (!item) {
      return;
    }

    const result = await menu.toggleStatus(itemId);

    if (result.ok === false) {
      showToast(result.message);
      return;
    }

    if (item.status === "active") {
      showToast("Stavka je deaktivirana i prebačena ispod aktivnih stavki.");
      return;
    }

    showToast("Stavka je ponovo aktivna i vraćena među aktivne stavke.");
  };

  const handleDeleteItem = async (itemId: string) => {
    const result = await menu.deleteItem(itemId);

    if (result.ok === false) {
      showToast(result.message);
      return;
    }

    showToast("Stavka je obrisana iz baze.");
  };

  return (
    <div className="menu-layout">
      <div className="map-header">
        <MenuToolbar onAddItem={openCreateItemModal} />

        <MenuFilters
          search={menu.search}
          categoryId={menu.categoryId}
          categories={menu.categories}
          onSearchChange={menu.setSearch}
          onCategoryChange={menu.setCategoryId}
        />

        <MenuStatusPills value={menu.status} counters={menu.counters} onChange={menu.setStatus} />
      </div>

      <div className="map-canvas-container">
        {menu.isLoading ? (
          <div className="menu-empty-state">Učitavanje menija iz baze...</div>
        ) : menu.error ? (
          <div className="menu-empty-state">{menu.error}</div>
        ) : (
          <MenuItemsGrid
            items={menu.filteredItems}
            getCategoryById={menu.getCategoryById}
            onEdit={(item) => setItemModal({ mode: "edit", item })}
            onToggleStatus={(itemId) => void handleToggleStatus(itemId)}
            onDelete={(itemId) => void handleDeleteItem(itemId)}
          />
        )}
      </div>

      <MenuItemFormModal
        open={itemModal !== null}
        mode={itemModal?.mode ?? "create"}
        item={itemModal?.mode === "edit" ? itemModal.item : null}
        categories={menu.categories}
        initialCategoryId={itemModal?.mode === "create" ? itemModal.initialCategoryId : undefined}
        onClose={() => setItemModal(null)}
        onSubmit={handleSubmitItem}
      />

      <CategoryManagerModal
        open={isCategoryModalOpen}
        categories={menu.categories}
        items={menu.items}
        onClose={closeCategoryManager}
        onCreateCategory={menu.createCategory}
        onUpdateCategory={menu.updateCategory}
        onDeleteCategory={menu.deleteCategory}
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