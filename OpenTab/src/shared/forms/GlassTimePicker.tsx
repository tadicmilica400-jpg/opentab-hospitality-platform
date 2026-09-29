import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GlassTimePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: number;
  className?: string;
};

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function splitTime(value: string) {
  const [rawHour = "09", rawMinute = "00"] = value.split(":");
  const hour = /^\d{2}$/.test(rawHour) ? rawHour : "09";
  const minute = /^\d{2}$/.test(rawMinute) ? rawMinute : "00";

  return { hour, minute };
}

function createMinuteOptions(_stepMinutes: number) {
  return Array.from({ length: 60 }, (_, minute) => padTime(minute));
}

export function GlassTimePicker({
  label,
  value,
  onChange,
  stepMinutes = 1,
  className = "",
}: GlassTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const hoursScrollRef = useRef<HTMLDivElement | null>(null);
  const minutesScrollRef = useRef<HTMLDivElement | null>(null);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => padTime(index)), []);
  const minutes = useMemo(() => createMinuteOptions(stepMinutes), [stepMinutes]);
  const selected = splitTime(value);
  const selectedMinute = minutes.includes(selected.minute) ? selected.minute : minutes[0] ?? "00";
  const displayValue = value || `${selected.hour}:${selectedMinute}`;

  const updateTime = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
  };

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const popupWidth = Math.max(rect.width, 252);
      const left = Math.min(rect.left, window.innerWidth - popupWidth - 14);

      setPosition({
        top: rect.bottom + 10,
        left: Math.max(14, left),
        width: popupWidth,
      });
    };

    updatePosition();

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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

  useEffect(() => {
    if (!open) return;

    const initial = splitTime(value);
    const initialMinute = minutes.includes(initial.minute) ? initial.minute : minutes[0] ?? "00";

    window.setTimeout(() => {
      hoursScrollRef.current?.querySelector(`[data-hour="${initial.hour}"]`)?.scrollIntoView({ block: "center" });
      minutesScrollRef.current?.querySelector(`[data-minute="${initialMinute}"]`)?.scrollIntoView({ block: "center" });
    }, 40);
    // Only when opening. Selection itself should not teleport the wheel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className={`glass-time-picker ${className}`.trim()}>
      <label>{label}</label>

      <button
        ref={triggerRef}
        type="button"
        className={`glass-time-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((currentValue) => !currentValue)}
      >
        <span>{displayValue || "Izaberi vreme"}</span>
        <span className="glass-time-chevron">⌵</span>
      </button>

      {open
        ? createPortal(
            <div
              ref={popupRef}
              className="glass-time-popup glass-time-wheel-popup"
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: position.width,
                zIndex: 12000,
              }}
            >
              <div className="glass-time-wheel-grid">
                <div className="glass-time-wheel-column">
                  <div className="glass-time-wheel-scroll custom-scrollbar" ref={hoursScrollRef}>
                    {hours.map((hour) => (
                      <button
                        key={hour}
                        data-hour={hour}
                        type="button"
                        className={`glass-time-wheel-option ${hour === selected.hour ? "active" : ""}`}
                        onClick={() => updateTime(hour, selectedMinute)}
                      >
                        {hour}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-time-wheel-column">
                  <div className="glass-time-wheel-scroll custom-scrollbar" ref={minutesScrollRef}>
                    {minutes.map((minute) => (
                      <button
                        key={minute}
                        data-minute={minute}
                        type="button"
                        className={`glass-time-wheel-option ${minute === selectedMinute ? "active" : ""}`}
                        onClick={() => updateTime(selected.hour, minute)}
                      >
                        {minute}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button type="button" className="glass-time-done" onClick={() => setOpen(false)}>
                Gotovo
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
