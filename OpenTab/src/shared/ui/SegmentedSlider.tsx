import type { CSSProperties, ReactNode } from "react";

export type SegmentedSliderOption<T extends string> = {
  label: string;
  value: T;
  helper?: string;
  icon?: ReactNode;
  preview?: ReactNode;
};

type SegmentedSliderProps<T extends string> = {
  value: T;
  options: SegmentedSliderOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedSlider<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: SegmentedSliderProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const style = {
    "--segmented-count": options.length,
    "--segmented-index": activeIndex,
  } as CSSProperties;

  return (
    <div className={`segmented-slider ${className}`.trim()} style={style}>
      <div className="segmented-slider-thumb" />

      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented-slider-option ${option.value === value ? "active" : ""}`.trim()}
          onClick={() => onChange(option.value)}
        >
          {option.preview ? <span className="segmented-slider-preview">{option.preview}</span> : null}
          {option.icon ? <span className="segmented-slider-icon">{option.icon}</span> : null}

          <span className="segmented-slider-copy">
            <strong>{option.label}</strong>
            {option.helper ? <small>{option.helper}</small> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
