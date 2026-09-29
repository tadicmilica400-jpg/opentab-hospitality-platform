import { useEffect, useRef, useState } from "react";

export type GlassDropdownOption<T extends string> = {
  label: string;
  value: T;
  icon?: string;
  disabled?: boolean;
};

type GlassDropdownProps<T extends string> = {
  value: T;
  options: GlassDropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
};

export function GlassDropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Izaberi",
  className = "",
  triggerClassName = "modal-dropdown",
}: GlassDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`kat-dropdown-container ${className}`.trim()}>
      <button
        type="button"
        className={`${triggerClassName} ${open ? "open" : ""}`.trim()}
        onClick={() => setOpen((currentValue) => !currentValue)}
      >
        <span className="dropdown-option-label">
          {selectedOption?.icon ? <span className="dropdown-option-icon">{selectedOption.icon}</span> : null}
          <span>{selectedOption?.label ?? placeholder}</span>
        </span>

        <span className="dropdown-chevron">⌵</span>
      </button>

      <div className={`kat-dropdown-list ${open ? "open" : ""}`}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            disabled={option.disabled}
            className={`kat-dropdown-item ${option.value === value ? "active" : ""}`}
            onClick={() => {
              if (option.disabled) {
                return;
              }

              onChange(option.value);
              setOpen(false);
            }}
          >
            <span className="dropdown-option-label">
              {option.icon ? <span className="dropdown-option-icon">{option.icon}</span> : null}
              <span>{option.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}