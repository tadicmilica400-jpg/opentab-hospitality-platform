import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GlassDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
};

const MONTHS_SR = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

const DAYS_SR = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

function toDate(value: string) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplay(value: string) {
  const date = toDate(value);

  if (!date) {
    return value;
  }

  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${date.getFullYear()}.`;
}

function isSameDay(first: Date | null, second: Date | null) {
  if (!first || !second) {
    return false;
  }

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function GlassDatePicker({
  value,
  onChange,
  label,
  placeholder = "Izaberi datum",
  min,
  max,
  className = "",
}: GlassDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => toDate(value) ?? new Date());
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = toDate(value);
  const today = new Date();

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const emptySlots = (firstDay.getDay() + 6) % 7;

    return {
      emptySlots: Array.from({ length: emptySlots }),
      days: Array.from({ length: totalDays }, (_, index) => index + 1),
    };
  }, [viewDate]);

  useEffect(() => {
    const nextDate = toDate(value);

    if (nextDate) {
      setViewDate(nextDate);
    }
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setPosition({
        top: rect.bottom + 12,
        left: rect.left,
      });
    };

    updatePosition();

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target)) {
        return;
      }

      if (popupRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const goToPreviousMonth = () => {
    setViewDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const selectDay = (day: number) => {
    const nextDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const nextValue = toInputDate(nextDate);

    if (min && nextValue < min) {
      return;
    }

    if (max && nextValue > max) {
      return;
    }

    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className={`glass-date-picker ${className}`.trim()}>
      {label ? <label>{label}</label> : null}

      <button
        ref={triggerRef}
        type="button"
        className={`glass-date-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((currentValue) => !currentValue)}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <span className="glass-date-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect x="3" y="4" width="18" height="18" rx="4" />
            <path d="M3 10h18" />
          </svg>
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={popupRef}
              className="glass-calendar-popup"
              style={{
                top: position.top,
                left: position.left,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="glass-calendar-wash" />

              <div className="glass-calendar-header">
                <button type="button" onClick={goToPreviousMonth}>
                  ‹
                </button>

                <strong>
                  {MONTHS_SR[viewDate.getMonth()]} {viewDate.getFullYear()}
                </strong>

                <button type="button" onClick={goToNextMonth}>
                  ›
                </button>
              </div>

              <div className="glass-calendar-grid">
                {DAYS_SR.map((day) => (
                  <div key={day} className="glass-calendar-day-name">
                    {day}
                  </div>
                ))}

                {calendarDays.emptySlots.map((_, index) => (
                  <div key={`empty-${index}`} className="glass-calendar-empty" />
                ))}

                {calendarDays.days.map((day) => {
                  const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                  const dateValue = toInputDate(date);
                  const selected = isSameDay(date, selectedDate);
                  const currentDay = isSameDay(date, today);
                  const disabled = Boolean((min && dateValue < min) || (max && dateValue > max));

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={disabled}
                      className={[
                        "glass-calendar-day",
                        selected ? "selected" : "",
                        currentDay ? "today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => selectDay(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}