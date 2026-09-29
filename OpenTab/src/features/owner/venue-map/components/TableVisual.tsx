// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { TableShape } from "../../../../entities/venue-map/venueMap.types";
import { GlassBadge } from "../../../../shared/ui/GlassBadge";
import { getChairPositions } from "../utils/tableGeometry";

type TableVisualProps = {
  number: string;
  shape: TableShape;
  seats: number;
  preview?: boolean;
  activeOrder?: boolean;
  showActiveOrderChip?: boolean;
};

export function TableVisual({
  number,
  shape,
  seats,
  preview,
  activeOrder,
  showActiveOrderChip = true,
}: TableVisualProps) {
  const chairs = getChairPositions(shape, seats, preview);

  return (
    <div
      className={[
        "venue-table",
        `venue-table-${shape}`,
        preview ? "venue-table-preview" : "",
        activeOrder ? "venue-table-active-order" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{number || "?"}</span>

      {activeOrder && !preview && showActiveOrderChip ? <GlassBadge tone="success" className="venue-table-order-chip">Otvoren</GlassBadge> : null}

      <div className="venue-table-chairs">
        {chairs.map((chair, index) => (
          <span
            key={`${chair.left}-${chair.top}-${index}`}
            className="venue-table-chair"
            style={{
              left: chair.left,
              top: chair.top,
            }}
          />
        ))}
      </div>
    </div>
  );
}