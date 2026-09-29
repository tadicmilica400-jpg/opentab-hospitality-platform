// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { StaffDetailsTab } from "../../../../../entities/staff/staff-details.types";
import { SegmentedSlider } from "../../../../../shared/ui/SegmentedSlider";

type StaffDetailsTabsProps = {
  value: StaffDetailsTab;
  onChange: (value: StaffDetailsTab) => void;
};

const tabs = [
  {
    value: "tables",
    label: "Stolovi",
  },
  {
    value: "schedule",
    label: "Raspored",
  },
  {
    value: "performance",
    label: "Performanse",
  },
] satisfies {
  value: StaffDetailsTab;
  label: string;
}[];

export function StaffDetailsTabs({ value, onChange }: StaffDetailsTabsProps) {
  return (
    <SegmentedSlider
      value={value}
      options={tabs}
      onChange={onChange}
      className="staff-details-tab-slider"
    />
  );
}
