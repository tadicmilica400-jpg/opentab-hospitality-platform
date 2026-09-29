// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { MenuStatusFilter } from "../hooks/useMenu";
import { StatusPills } from "../../../../shared/ui/StatusPills";

type MenuStatusPillsProps = {
  value: MenuStatusFilter;
  counters: {
    all: number;
    active: number;
    inactive: number;
  };
  onChange: (value: MenuStatusFilter) => void;
};

export function MenuStatusPills({ value, counters, onChange }: MenuStatusPillsProps) {
  return (
    <div className="status-pills-wrapper">
      <StatusPills<MenuStatusFilter>
        value={value}
        onChange={onChange}
        options={[
          {
            label: "Sve",
            value: "all",
            count: counters.all,
          },
          {
            label: "Aktivni",
            value: "active",
            count: counters.active,
          },
          {
            label: "Neaktivni",
            value: "inactive",
            count: counters.inactive,
          },
        ]}
      />
    </div>
  );
}