import type { ReactNode } from "react";
import { SegmentedSlider } from "../ui/SegmentedSlider";

export type ShapeSelectorOption<T extends string> = {
  label: string;
  value: T;
  preview: ReactNode;
};

type ShapeSelectorProps<T extends string> = {
  value: T;
  options: ShapeSelectorOption<T>[];
  onChange: (value: T) => void;
};

export function ShapeSelector<T extends string>({
  value,
  options,
  onChange,
}: ShapeSelectorProps<T>) {
  return (
    <SegmentedSlider
      value={value}
      options={options.map((option) => ({
        label: option.label,
        value: option.value,
        preview: option.preview,
      }))}
      className="shape-slider"
      onChange={onChange}
    />
  );
}
