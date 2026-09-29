// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type {
  TopItemsSort,
  TopMenuItemAnalytics,
} from "../../../../entities/analytics/analytics.types";
import { GlassDropdown } from "../../../../shared/forms/GlassDropdown";
import type { GlassDropdownOption } from "../../../../shared/forms/GlassDropdown";
import { SegmentedSlider } from "../../../../shared/ui/SegmentedSlider";
import { TopItemsGlassList } from "../../../../shared/ui/TopItemsGlassList";

type TopItemsCardProps = {
  items: TopMenuItemAnalytics[];
  categories: string[];
  sort: TopItemsSort;
  categoryFilter: string;
  onSortChange: (value: TopItemsSort) => void;
  onCategoryChange: (value: string) => void;
};

const sortOptions = [
  { label: "Prihod", value: "revenue" },
  { label: "Količina", value: "quantity" },
] satisfies {
  label: string;
  value: TopItemsSort;
}[];

function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.includes("kaf") || normalized.includes("espresso")) return "☕";
  if (normalized.includes("sok") || normalized.includes("pić") || normalized.includes("pice")) return "🥤";
  if (normalized.includes("hrana") || normalized.includes("sendvi") || normalized.includes("obrok")) return "🍽";
  if (normalized.includes("dezert") || normalized.includes("slat")) return "🍰";
  if (normalized.includes("vino") || normalized.includes("alkohol") || normalized.includes("koktel")) return "🍷";

  return "◇";
}

export function TopItemsCard({
  items,
  categories,
  sort,
  categoryFilter,
  onSortChange,
  onCategoryChange,
}: TopItemsCardProps) {
  const categoryOptions: GlassDropdownOption<string>[] = [
    { label: "Sve kategorije", value: "all", icon: "☷" },
    ...categories.map((category) => ({
      label: category,
      value: category,
      icon: getCategoryIcon(category),
    })),
  ];

  return (
    <div className="chart-card top-items-card">
      <div className="chart-header top-items-header">
        <div>
          <span className="chart-title">Najprodavanije stavke</span>
          <p>Sortiranje i filtriranje po kategoriji</p>
        </div>
      </div>

      <div className="top-items-toolbar">
        <SegmentedSlider
          value={sort}
          options={sortOptions}
          onChange={onSortChange}
          className="analytics-sort-slider"
        />

        <GlassDropdown<string>
          value={categoryFilter}
          options={categoryOptions}
          onChange={onCategoryChange}
          placeholder="Kategorija"
          triggerClassName="category-filter-trigger"
          className="top-items-category-dropdown"
        />
      </div>

      <TopItemsGlassList items={items} emptyText="Nema stavki za izabrani period." />
    </div>
  );
}
