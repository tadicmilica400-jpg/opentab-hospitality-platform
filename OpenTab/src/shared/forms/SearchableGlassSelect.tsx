import { useEffect, useMemo, useRef, useState } from "react";
import type { GlassDropdownOption } from "./GlassDropdown";
import { GlassSearchInput } from "./GlassSearchInput";

type SearchableGlassSelectProps<T extends string> = {
  value: T;
  options: GlassDropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  searchable?: boolean;
  disabled?: boolean;
};

export function SearchableGlassSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Izaberi",
  searchPlaceholder = "Pretraži...",
  emptyText = "Nema rezultata.",
  className = "",
  triggerClassName = "modal-dropdown",
  searchable = true,
  disabled = false,
}: SearchableGlassSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleMouseDown);

    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const closeDropdown = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <div
      ref={containerRef}
      className={`kat-dropdown-container searchable-glass-select ${open ? "open" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        disabled={disabled}
        className={`${triggerClassName} ${open ? "open" : ""}`.trim()}
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((currentValue) => !currentValue);
        }}
      >
        <span className="dropdown-option-label">
          {selectedOption?.icon ? (
            <span className="dropdown-option-icon">{selectedOption.icon}</span>
          ) : null}

          <span>{selectedOption?.label ?? placeholder}</span>
        </span>

        <span className="dropdown-chevron">⌵</span>
      </button>

      <div className={`kat-dropdown-list searchable-select-list ${open ? "open" : ""}`}>
        {searchable ? (
          <div
            className="searchable-select-search"
            onClick={(event) => event.stopPropagation()}
          >
            <GlassSearchInput
              value={search}
              placeholder={searchPlaceholder}
              onChange={setSearch}
              icon="◉"
            />
          </div>
        ) : null}

        <div className="searchable-select-items custom-scrollbar">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
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
                  closeDropdown();
                }}
              >
                <span className="dropdown-option-label">
                  {option.icon ? (
                    <span className="dropdown-option-icon">{option.icon}</span>
                  ) : null}

                  <span>{option.label}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="searchable-select-empty">{emptyText}</div>
          )}
        </div>
      </div>
    </div>
  );
}