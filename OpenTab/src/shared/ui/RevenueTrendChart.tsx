import { useEffect, useId, useRef, useState } from "react";

export type RevenueTrendPoint = {
  label: string;
  value: number;
};

type HoveredPoint = RevenueTrendPoint & {
  x: number;
  y: number;
};

type RevenueTrendChartProps = {
  points: RevenueTrendPoint[];
  emptyText?: string;
  formatValue?: (value: number) => string;
};

function defaultFormatValue(value: number) {
  return `${Math.round(value).toLocaleString("sr-RS")} RSD`;
}

function formatShort(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return `${Math.round(value)}`;
}

function shouldShowXAxisLabel(index: number, total: number) {
  if (total <= 12) {
    return true;
  }

  if (index === 0 || index === total - 1) {
    return true;
  }

  if (total <= 24) {
    return index % 2 === 0;
  }

  return index % Math.ceil(total / 10) === 0;
}

export function RevenueTrendChart({
  points,
  emptyText = "Nema dostupnih podataka.",
  formatValue = defaultFormatValue,
}: RevenueTrendChartProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId().replace(/:/g, "");
  const areaId = `${rawId}-area`;
  const lineId = `${rawId}-line`;

  const [chartSize, setChartSize] = useState({
    width: 760,
    height: 320,
  });
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);

  useEffect(() => {
    const element = wrapperRef.current;

    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();

      setChartSize({
        width: Math.max(Math.round(rect.width), 760),
        height: Math.max(Math.round(rect.height), 320),
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const width = chartSize.width;
  const height = chartSize.height;
  const paddingLeft = 58;
  const paddingRight = 34;
  const paddingTop = 34;
  const paddingBottom = 48;

  if (points.length === 0) {
    return (
      <div ref={wrapperRef} className="revenue-trend-wrapper">
        <div className="analytics-empty-state">
          <span>◌</span>
          <p>{emptyText}</p>
        </div>
      </div>
    );
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const range = Math.max(max - min, 1);

  const coordinates = points.map((point, index) => {
    const x =
      paddingLeft +
      (index / Math.max(points.length - 1, 1)) * (width - paddingLeft - paddingRight);

    const y =
      height -
      paddingBottom -
      ((point.value - min) / range) * (height - paddingTop - paddingBottom);

    return {
      ...point,
      x,
      y,
    };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - paddingBottom} L ${coordinates[0].x} ${height - paddingBottom} Z`
      : "";

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!coordinates.length) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;

    const closestPoint = coordinates.reduce((closest, point) =>
      Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest,
    );

    setHoveredPoint(closestPoint);
  };

  return (
    <div ref={wrapperRef} className="revenue-trend-wrapper">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="revenue-trend-chart"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(197, 161, 91, 0.28)" />
            <stop offset="70%" stopColor="rgba(197, 161, 91, 0.07)" />
            <stop offset="100%" stopColor="rgba(197, 161, 91, 0)" />
          </linearGradient>

          <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(154, 116, 53, 1)" />
            <stop offset="50%" stopColor="rgba(235, 205, 145, 1)" />
            <stop offset="100%" stopColor="rgba(197, 161, 91, 1)" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((line) => {
          const y = paddingTop + line * ((height - paddingTop - paddingBottom) / 3);
          const value = max - line * (range / 3);

          return (
            <g key={line}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                className="revenue-grid-line"
                vectorEffect="non-scaling-stroke"
              />

              <text x={paddingLeft - 10} y={y + 4} className="revenue-y-label">
                {formatShort(value)}
              </text>
            </g>
          );
        })}

        <path
          d={areaPath}
          className="revenue-area-path"
          style={{
            fill: `url(#${areaId})`,
          }}
        />

        <path
          d={linePath}
          className="revenue-line-path"
          vectorEffect="non-scaling-stroke"
          style={{
            fill: "none",
            stroke: `url(#${lineId})`,
          }}
        />

        {hoveredPoint ? (
          <line
            x1={hoveredPoint.x}
            x2={hoveredPoint.x}
            y1={paddingTop}
            y2={height - paddingBottom}
            className="revenue-hover-line"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {coordinates.map((point, index) => {
          const active = hoveredPoint?.label === point.label;

          return (
            <g key={`${point.label}-${point.value}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? "7" : "5"}
                className={`revenue-point ${active ? "active" : ""}`}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={point.x} cy={point.y} r="16" className="revenue-point-hit" />

              {shouldShowXAxisLabel(index, points.length) ? (
                <text x={point.x} y={height - 18} className="revenue-x-label">
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {hoveredPoint ? (
        <div
          className="revenue-tooltip"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
          }}
        >
          <span>{hoveredPoint.label}</span>
          <strong>{formatValue(hoveredPoint.value)}</strong>
        </div>
      ) : null}
    </div>
  );
}