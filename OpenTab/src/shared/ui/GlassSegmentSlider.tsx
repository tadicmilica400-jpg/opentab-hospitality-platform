import type { CSSProperties, ReactNode } from "react";

export type GlassSegmentedSliderOption<T extends string> = {
  value: T;
  label: string;
  helper?: string;
  icon?: ReactNode;
};

type GlassSegmentedSliderProps<T extends string> = {
  value: T;
  options: GlassSegmentedSliderOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export function GlassSegmentedSlider<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: GlassSegmentedSliderProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const sliderStyle = {
    "--glass-slider-count": options.length,
    "--glass-slider-index": activeIndex,
  } as CSSProperties;

  return (
    <div className={`glass-segmented-slider ${className}`.trim()} style={sliderStyle}>
      <div className="glass-segmented-slider-thumb" />

      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`glass-segmented-slider-option ${option.value === value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <span className="glass-segmented-slider-icon">{option.icon}</span> : null}

          <span className="glass-segmented-slider-copy">
            <strong>{option.label}</strong>
            {option.helper ? <small>{option.helper}</small> : null}
          </span>
        </button>
      ))}
    </div>
  );
}