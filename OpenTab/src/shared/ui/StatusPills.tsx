import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type StatusPillOption<T extends string> = {
  label: string;
  value: T;
  count?: number;
};

type StatusPillsProps<T extends string> = {
  value: T;
  options: StatusPillOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

type GhostStyle = {
  left: number;
  top: number;
  width: number;
  height: number;
  smearX: number;
  tick: number;
};

export function StatusPills<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: StatusPillsProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const previousGhostRef = useRef<Omit<GhostStyle, "tick" | "smearX"> | null>(null);
  const [ghostStyle, setGhostStyle] = useState<GhostStyle | null>(null);

  const updateGhost = useCallback(() => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current[value];

    if (!container || !activeButton) {
      setGhostStyle(null);
      previousGhostRef.current = null;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    const nextGhost = {
      left: buttonRect.left - containerRect.left,
      top: buttonRect.top - containerRect.top,
      width: buttonRect.width,
      height: buttonRect.height,
    };

    const previousGhost = previousGhostRef.current;
    const deltaX = previousGhost ? nextGhost.left - previousGhost.left : 0;
    const smearX = Math.max(-1, Math.min(1, deltaX / 120));

    previousGhostRef.current = nextGhost;

    setGhostStyle((currentGhost) => ({
      ...nextGhost,
      smearX,
      tick: currentGhost ? currentGhost.tick + 1 : 0,
    }));
  }, [value]);

  useLayoutEffect(() => {
    updateGhost();
  }, [options.length, updateGhost]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const updateOnFrame = () => requestAnimationFrame(updateGhost);

    window.addEventListener("resize", updateOnFrame);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateOnFrame);
    }

    const resizeObserver = new ResizeObserver(updateOnFrame);
    resizeObserver.observe(container);

    Object.values(buttonRefs.current).forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        resizeObserver.observe(button);
      }
    });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOnFrame);
    };
  }, [options.length, updateGhost]);

  const ghostInlineStyle = ghostStyle
    ? ({
        left: `${ghostStyle.left}px`,
        top: `${ghostStyle.top}px`,
        width: `${ghostStyle.width}px`,
        height: `${ghostStyle.height}px`,
        "--status-pill-smear-x": ghostStyle.smearX,
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`status-pills ${ghostStyle ? "has-liquid-ghost" : ""} ${className}`.trim()}
    >
      {ghostStyle ? (
        <div className="status-pills-active-bg" style={ghostInlineStyle}>
          <span key={`burst-${ghostStyle.tick}`} className="status-pill-liquid-burst" />
          <span key={`glow-${ghostStyle.tick}`} className="status-pill-liquid-glow" />
        </div>
      ) : null}

      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            ref={(element) => {
              buttonRefs.current[option.value] = element;
            }}
            type="button"
            className={`status-pill ${active ? "active" : ""}`.trim()}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>

            {typeof option.count === "number" ? (
              <span className="status-badge status-pill-count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
