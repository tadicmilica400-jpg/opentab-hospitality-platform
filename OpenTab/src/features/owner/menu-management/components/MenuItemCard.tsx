// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { MenuCategory, MenuItem } from "../../../../entities/menu/menu.types";
import { GlassBadge } from "../../../../shared/ui/GlassBadge";

type MenuItemCardProps = {
  item: MenuItem;
  category: MenuCategory;
  onEdit: (item: MenuItem) => void;
  onToggleStatus: (itemId: string) => void;
  onDelete: (itemId: string) => void;
};

export function MenuItemCard({
  item,
  category,
  onEdit,
  onToggleStatus,
  onDelete,
}: MenuItemCardProps) {
  const isInactive = item.status === "inactive";

  return (
    <article className={`menu-item-card ${isInactive ? "inactive" : ""}`}>
      <div className="menu-item-image">
        <img src={item.imageUrl} alt={item.name} loading="lazy" referrerPolicy="no-referrer" />
        <GlassBadge tone={isInactive ? "muted" : "success"} dot className="menu-item-status-badge">{isInactive ? "Neaktivno" : "Aktivno"}</GlassBadge>
      </div>

      <div className="menu-item-content">
        <div className="menu-item-header">
          <span className="menu-item-name">{item.name}</span>
          <span className="menu-item-price">
            {item.price} <small>RSD</small>
          </span>
        </div>

        <p className="menu-item-description">{item.description}</p>

        <div className="menu-item-footer">
          <span className="menu-item-category">
            {category.emoji} {category.name}
          </span>

          <div className="menu-item-actions">
            <button type="button" className="menu-action-btn" title="Izmeni" onClick={() => onEdit(item)}>
              ✎
            </button>
            <button
              type="button"
              className={`menu-action-btn ${isInactive ? "enable" : ""}`}
              title={isInactive ? "Aktiviraj" : "Deaktiviraj"}
              onClick={() => onToggleStatus(item.id)}
            >
              {isInactive ? "✓" : "⊘"}
            </button>
            <button type="button" className="menu-action-btn danger" title="Obriši" onClick={() => onDelete(item.id)}>
              🗑
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}