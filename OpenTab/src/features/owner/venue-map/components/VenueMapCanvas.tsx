// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useRef, useState } from "react";
import type {
  VenueFloorType,
  VenueSector,
  VenueTable,
} from "../../../../entities/venue-map/venueMap.types";
import { getTableDimensions } from "../utils/tableGeometry";
import { TableVisual } from "./TableVisual";

type VenueMapCanvasProps = {
  sectors: VenueSector[];
  tables: VenueTable[];
  floor: VenueFloorType;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onBeginLayoutChange: () => void;
  onEndLayoutChange: () => void;
  onMoveSector: (sectorId: string, x: number, y: number) => void;
  onResizeSector: (sectorId: string, x: number, y: number, width: number, height: number) => void;
  onMoveTable: (tableId: string, x: number, y: number) => void;
  onEditTable: (table: VenueTable) => void;
  onSaveLayout: () => void;
  onResetChanges: () => void;
};

type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

type DragState =
  | {
      type: "sector";
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
    }
  | {
      type: "sector-resize";
      id: string;
      direction: ResizeDirection;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
    }
  | {
      type: "table";
      id: string;
      sectorId: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
    }
  | {
      type: "pan";
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
    }
  | null;

const minSectorWidth = 260;
const minSectorHeight = 190;
const resizeDirections: ResizeDirection[] = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getResizedSector(
  direction: ResizeDirection,
  startX: number,
  startY: number,
  startWidth: number,
  startHeight: number,
  deltaX: number,
  deltaY: number,
) {
  let x = startX;
  let y = startY;
  let width = startWidth;
  let height = startHeight;

  if (direction.includes("e")) {
    width = Math.max(minSectorWidth, startWidth + deltaX);
  }

  if (direction.includes("s")) {
    height = Math.max(minSectorHeight, startHeight + deltaY);
  }

  if (direction.includes("w")) {
    const nextWidth = Math.max(minSectorWidth, startWidth - deltaX);
    x = startX + (startWidth - nextWidth);
    width = nextWidth;

    if (x < 0) {
      width += x;
      x = 0;
    }
  }

  if (direction.includes("n")) {
    const nextHeight = Math.max(minSectorHeight, startHeight - deltaY);
    y = startY + (startHeight - nextHeight);
    height = nextHeight;

    if (y < 0) {
      height += y;
      y = 0;
    }
  }

  return {
    x,
    y,
    width: Math.max(minSectorWidth, width),
    height: Math.max(minSectorHeight, height),
  };
}

export function VenueMapCanvas({
  sectors,
  tables,
  floor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onBeginLayoutChange,
  onEndLayoutChange,
  onMoveSector,
  onResizeSector,
  onMoveTable,
  onEditTable,
  onSaveLayout,
  onResetChanges,
}: VenueMapCanvasProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef<DragState>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragRef.current;

      if (!dragState) {
        return;
      }

      if (dragState.type === "pan") {
        setPan({
          x: dragState.startX + event.clientX - dragState.startClientX,
          y: dragState.startY + event.clientY - dragState.startClientY,
        });

        return;
      }

      const deltaX = (event.clientX - dragState.startClientX) / scale;
      const deltaY = (event.clientY - dragState.startClientY) / scale;

      if (dragState.type === "sector") {
        const nextX = Math.max(0, dragState.startX + deltaX);
        const nextY = Math.max(0, dragState.startY + deltaY);

        onMoveSector(dragState.id, nextX, nextY);
        return;
      }

      if (dragState.type === "sector-resize") {
        const nextSector = getResizedSector(
          dragState.direction,
          dragState.startX,
          dragState.startY,
          dragState.startWidth,
          dragState.startHeight,
          deltaX,
          deltaY,
        );

        onResizeSector(
          dragState.id,
          nextSector.x,
          nextSector.y,
          nextSector.width,
          nextSector.height,
        );

        return;
      }

      const table = tables.find((currentTable) => currentTable.id === dragState.id);
      const sector = sectors.find((currentSector) => currentSector.id === dragState.sectorId);

      if (!table || !sector) {
        return;
      }

      const dimensions = getTableDimensions(table.shape);
      const maxX = Math.max(0, sector.width - dimensions.width - 24);
      const maxY = Math.max(0, sector.height - dimensions.height - 74);

      const nextX = clamp(dragState.startX + deltaX, 0, maxX);
      const nextY = clamp(dragState.startY + deltaY, 0, maxY);

      onMoveTable(dragState.id, nextX, nextY);
    };

    const handleMouseUp = () => {
      const dragState = dragRef.current;

      if (dragState && dragState.type !== "pan") {
        onEndLayoutChange();
      }

      dragRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onEndLayoutChange, onMoveSector, onMoveTable, onResizeSector, scale, sectors, tables]);

  const zoom = (delta: number) => {
    setScale((currentScale) => clamp(Number((currentScale + delta).toFixed(2)), 0.45, 1.8));
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const startPan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;

    if (!target.classList.contains("venue-map-zoom-wrapper") && !target.classList.contains("venue-map-world")) {
      return;
    }

    dragRef.current = {
      type: "pan",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: pan.x,
      startY: pan.y,
    };

    setIsPanning(true);
  };

  const startSectorDrag = (event: React.MouseEvent, sector: VenueSector) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onBeginLayoutChange();

    dragRef.current = {
      type: "sector",
      id: sector.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: sector.x,
      startY: sector.y,
    };
  };

  const startSectorResize = (
    event: React.MouseEvent,
    sector: VenueSector,
    direction: ResizeDirection,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onBeginLayoutChange();

    dragRef.current = {
      type: "sector-resize",
      id: sector.id,
      direction,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: sector.x,
      startY: sector.y,
      startWidth: sector.width,
      startHeight: sector.height,
    };
  };

  const startTableDrag = (event: React.MouseEvent, table: VenueTable) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onBeginLayoutChange();

    dragRef.current = {
      type: "table",
      id: table.id,
      sectorId: table.sectorId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: table.x,
      startY: table.y,
    };
  };

  return (
    <div className={`venue-map-canvas venue-map-floor-${floor}`}>
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
                className="venue-sector"
                style={{
                  left: sector.x,
                  top: sector.y,
                  width: sector.width,
                  height: sector.height,
                }}
              >
                <div className="venue-sector-header" onMouseDown={(event) => startSectorDrag(event, sector)}>
                  <span className="venue-sector-name">
                    {sector.emoji} {sector.name}
                  </span>
                  <span className="venue-sector-count">
                    {sectorTables.length === 1 ? "1 sto" : `${sectorTables.length} stolova`}
                  </span>
                </div>

                <div className="venue-tables-grid">
                  {sectorTables.map((table) => (
                    <div
                      key={table.id}
                      className="venue-table-wrapper"
                      style={{
                        left: table.x,
                        top: table.y,
                      }}
                      onMouseDown={(event) => startTableDrag(event, table)}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        onEditTable(table);
                      }}
                    >
                      <TableVisual
                        number={table.number}
                        shape={table.shape}
                        seats={table.seats}
                        activeOrder={table.hasActiveOrder}
                      />

                      <span className="table-edit-hint">
                        {table.hasActiveOrder ? "otvoren račun / aktivna narudžbina" : "dupli klik za izmenu"}
                      </span>
                    </div>
                  ))}
                </div>

                {resizeDirections.map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    className={`sector-resize-handle sector-resize-${direction}`}
                    aria-label={`Promeni veličinu sektora ${direction}`}
                    onMouseDown={(event) => startSectorResize(event, sector, direction)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>

      <div className="canvas-controls left">
        <button type="button" className="ctrl-btn" onClick={onUndo} disabled={!canUndo} title="Poništi (Undo)">
          ↩
        </button>

        <button type="button" className="ctrl-btn" onClick={onRedo} disabled={!canRedo} title="Ponovo (Redo)">
          ↪
        </button>

        <div className="ctrl-divider" />

        <button type="button" className="ctrl-text" onClick={onResetChanges}>
          Odustani
        </button>

        <button type="button" className="btn-glass primary" onClick={onSaveLayout}>
          Sačuvaj
        </button>
      </div>

      <div className="canvas-controls right">
        <button type="button" className="ctrl-btn" title="Odzoomiraj" onClick={() => zoom(-0.15)}>
          −
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