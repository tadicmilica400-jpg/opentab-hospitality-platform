type GlassNumberInputProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  className?: string;
  onChange: (value: number) => void;
};

function normalizeNumber(value: string, fallback: number) {
  const normalizedValue = value.replace(",", ".").trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function clamp(value: number, min: number, max?: number) {
  const minClampedValue = Math.max(min, value);

  if (typeof max !== "number") {
    return minClampedValue;
  }

  return Math.min(max, minClampedValue);
}

export function GlassNumberInput({
  value,
  min = 0,
  max,
  step = 1,
  ariaLabel = "Numerička vrednost",
  className = "",
  onChange,
}: GlassNumberInputProps) {
  const normalizedValue = Number.isFinite(value) ? value : min;
  const canDecrease = normalizedValue > min;
  const canIncrease = typeof max === "number" ? normalizedValue < max : true;

  const decrease = () => onChange(clamp(normalizedValue - step, min, max));
  const increase = () => onChange(clamp(normalizedValue + step, min, max));

  return (
    <div className={`glass-number-input ${className}`.trim()}>
      <button type="button" className="num-btn" disabled={!canDecrease} onClick={decrease}>
        −
      </button>

      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={normalizedValue}
        onChange={(event) => onChange(clamp(normalizeNumber(event.target.value, normalizedValue), min, max))}
      />

      <button type="button" className="num-btn" disabled={!canIncrease} onClick={increase}>
        +
      </button>
    </div>
  );
}
