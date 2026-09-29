// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { VenueFloorType, VenueSector, VenueTable } from "../../../../entities/venue-map/venueMap.types";
import type { WaiterTable, WaiterTableStatus } from "../../../../entities/waiter/waiter.types";
import { TableVisual } from "../../../owner/venue-map/components/TableVisual";

type WaiterVenueMapCanvasProps = {
  sectors: VenueSector[];
  tables: VenueTable[];
  waiterTables: WaiterTable[];
  selectedTableId?: string;
  sourceTableId?: string;
  destinationTableId?: string;
  floor?: VenueFloorType;
  onSelectTable: (tableId: string) => void;
  allowedStatuses?: WaiterTableStatus[];
};

type PanDragState = {
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
} | null;

const statusLabels: Record<WaiterTableStatus, string> = {
  free: "Slobodan",
  occupied: "Zauzet",
  reserved: "Rezervisan",
  payment: "Čeka naplatu",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function WaiterVenueMapCanvas({
  sectors,
  tables,
  waiterTables,
  selectedTableId,
  sourceTableId,
  destinationTableId,
  floor = "parket",
  onSelectTable,
  allowedStatuses,
}: WaiterVenueMapCanvasProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef<PanDragState>(null);
  const waiterTableById = useMemo(
    () => new Map(waiterTables.map((table) => [table.id, table])),
    [waiterTables],
  );

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const dragState = dragRef.current;

      if (!dragState) {
        return;
      }

      setPan({
        x: dragState.startX + event.clientX - dragState.startClientX,
        y: dragState.startY + event.clientY - dragState.startClientY,
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const zoom = (delta: number) => {
    setScale((currentScale) => clamp(Number((currentScale + delta).toFixed(2)), 0.45, 1.8));
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const startPan = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;

    if (
      !target.classList.contains("venue-map-zoom-wrapper")
      && !target.classList.contains("venue-map-world")
    ) {
      return;
    }

    dragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: pan.x,
      startY: pan.y,
    };
    setIsPanning(true);
  };

  return (
    <div className={`venue-map-canvas waiter-venue-map-canvas venue-map-floor-${floor}`}>
      <div className="zoom-badge">{Math.round(scale * 100)}%</div>

      <div className={`venue-map-zoom-wrapper ${isPanning ? "panning" : ""}`} onMouseDown={startPan}>
        <div
          className="venue-map-world"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {sectors.map((sector) => {
            const sectorTables = tables.filter((table) => table.sectorId === sector.id);

            return (
              <section
                key={sector.id}
                className="venue-sector waiter-venue-sector"
                style={{ left: sector.x, top: sector.y, width: sector.width, height: sector.height }}
              >
                <div className="venue-sector-header waiter-sector-header">
                  <span className="venue-sector-name">
                    {sector.emoji} {sector.name}
                  </span>
                  <span className="venue-sector-count">
                    {sectorTables.length === 1 ? "1 sto" : `${sectorTables.length} stolova`}
                  </span>
                </div>

                <div className="venue-tables-grid">
                  {sectorTables.map((table) => {
                    const operationalTable = waiterTableById.get(table.id);
                    const status = operationalTable?.status ?? "free";
                    const isSelected = selectedTableId === table.id;
                    const isSource = sourceTableId === table.id;
                    const isDestination = destinationTableId === table.id;
                    const isDisabled = Boolean(allowedStatuses?.length && !allowedStatuses.includes(status));

                    return (
                      <button
                        key={table.id}
                        type="button"
                        aria-disabled={isDisabled}
                        className={`venue-table-wrapper waiter-venue-table-wrapper waiter-status-${status} ${isSelected ? "selected" : ""} ${isSource ? "t-sel-from" : ""} ${isDestination ? "t-sel-to" : ""} ${allowedStatuses?.includes("free") && status === "free" ? "t-available" : ""} ${isDisabled ? "action-disabled t-dimmed" : ""}`.trim()}
                        style={{ left: table.x, top: table.y }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          if (!isDisabled) {
                            onSelectTable(table.id);
                          }
                        }}
                      >
                        <TableVisual
                          number={table.number}
                          shape={table.shape}
                          seats={table.seats}
                          activeOrder={false}
                        />
                        <span className="table-edit-hint waiter-table-hint">{statusLabels[status]}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="canvas-controls right waiter-canvas-controls">
        <button type="button" className="ctrl-btn" title="Odzoomiraj" onClick={() => zoom(-0.15)}>
          -
        </button>

        <button type="button" className="ctrl-btn" title="Zumiraj" onClick={() => zoom(0.15)}>
          +
        </button>

        <div className="ctrl-divider" />

        <button type="button" className="ctrl-btn" title="Resetuj prikaz" onClick={resetView}>
          ⌂
        </button>
      </div>
    </div>
  );
}
