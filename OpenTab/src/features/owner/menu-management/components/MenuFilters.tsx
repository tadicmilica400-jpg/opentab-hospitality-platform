// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { MenuCategory } from "../../../../entities/menu/menu.types";
import { GlassDropdown } from "../../../../shared/forms/GlassDropdown";
import type { GlassDropdownOption } from "../../../../shared/forms/GlassDropdown";
import { GlassSearchInput } from "../../../../shared/forms/GlassSearchInput";

type MenuFiltersProps = {
  search: string;
  categoryId: string;
  categories: MenuCategory[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
};

export function MenuFilters({
  search,
  categoryId,
  categories,
  onSearchChange,
  onCategoryChange,
}: MenuFiltersProps) {
  const categoryOptions: GlassDropdownOption<string>[] = [
    {
      label: "Sve kategorije",
      value: "all",
      icon: "☷",
    },
    ...categories.map((category) => ({
      label: category.name,
      value: category.id,
      icon: category.emoji || "☷",
    })),
  ];

  return (
    <div className="menu-filters-row">
      <div className="search-wrapper">
        <GlassSearchInput
          value={search}
          placeholder="Pretraži stavke..."
          onChange={onSearchChange}
        />
      </div>

      <div className="category-dropdown-wrapper">
        <GlassDropdown
          value={categoryId}
          options={categoryOptions}
          onChange={onCategoryChange}
          triggerClassName="category-filter-trigger"
        />
      </div>
    </div>
  );
}