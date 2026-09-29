// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { MenuCategory, MenuItem } from "../../../../entities/menu/menu.types";
import { MenuItemCard } from "./MenuItemCard";

type MenuItemsGridProps = {
  items: MenuItem[];
  getCategoryById: (id: string) => MenuCategory | undefined;
  onEdit: (item: MenuItem) => void;
  onToggleStatus: (itemId: string) => void;
  onDelete: (itemId: string) => void;
};

export function MenuItemsGrid({
  items,
  getCategoryById,
  onEdit,
  onToggleStatus,
  onDelete,
}: MenuItemsGridProps) {
  if (items.length === 0) {
    return (
      <div className="menu-empty-state">
        Nema stavki koje odgovaraju izabranim filterima.
      </div>
    );
  }

  return (
    <div className="menu-items-grid">
      {items.map((item) => {
        const category = getCategoryById(item.categoryId);

        if (!category) {
          return null;
        }

        return (
          <MenuItemCard
            key={item.id}
            item={item}
            category={category}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}