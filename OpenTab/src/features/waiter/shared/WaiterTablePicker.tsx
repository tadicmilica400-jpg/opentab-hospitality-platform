// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { useMemo } from "react";
import type { WaiterTable, WaiterTableStatus } from "../../../entities/waiter/waiter.types";
import { TableVisual } from "../../owner/venue-map/components/TableVisual";

type WaiterTablePickerProps = {
  tables: WaiterTable[];
  selectedTableId?: string;
  sourceTableId?: string;
  destinationTableId?: string;
  allowedStatuses?: WaiterTableStatus[];
  allowDisabledClick?: boolean;
  isTableDisabled?: (table: WaiterTable) => boolean;
  shakeTableId?: string;
  onSelectTable: (tableId: string) => void;
};

const statusLabels: Record<WaiterTableStatus, string> = {
  free: "Slobodan",
  occupied: "Zauzet",
  reserved: "Rezervisan",
  payment: "Čeka naplatu",
};

const sectorOrder = ["Terasa", "Glavna sala", "Sala", "Bar", "Bašta", "Basta", "VIP soba"];

function groupBySector(tables: WaiterTable[]) {
  const groups = new Map<string, WaiterTable[]>();

  tables.forEach((table) => {
    const group = groups.get(table.sectorName) ?? [];
    group.push(table);
    groups.set(table.sectorName, group);
  });

  return Array.from(groups.entries()).sort(([firstSector], [secondSector]) => {
    const firstIndex = sectorOrder.indexOf(firstSector);
    const secondIndex = sectorOrder.indexOf(secondSector);

    if (firstIndex === -1 && secondIndex === -1) {
      return firstSector.localeCompare(secondSector, "sr");
    }

    if (firstIndex === -1) return 1;
    if (secondIndex === -1) return -1;
    return firstIndex - secondIndex;
  });
}

export function WaiterTablePicker({
  tables,
  selectedTableId,
  sourceTableId,
  destinationTableId,
  allowedStatuses,
  allowDisabledClick = false,
  isTableDisabled,
  shakeTableId,
  onSelectTable,
}: WaiterTablePickerProps) {
  const sectorGroups = useMemo(() => groupBySector(tables), [tables]);

  return (
    <section className="waiter-static-picker" aria-label="Izbor stola">
      {sectorGroups.map(([sector, sectorTables]) => (
        <div className="waiter-static-picker-sector" key={sector}>
          <div className="waiter-static-picker-sector-header">
            <span>{sector}</span>
            <small>{sectorTables.length === 1 ? "1 sto" : `${sectorTables.length} stolova`}</small>
          </div>

          <div className="waiter-static-picker-grid">
            {sectorTables.map((table) => {
              const disabled = Boolean(
                (allowedStatuses?.length && !allowedStatuses.includes(table.status) && table.id !== sourceTableId)
                  || isTableDisabled?.(table),
              );
              const selected = selectedTableId === table.id;
              const isSource = sourceTableId === table.id;
              const isDestination = destinationTableId === table.id;

              return (
                <button
                  type="button"
                  className={`waiter-static-picker-table waiter-status-${table.status} ${selected ? "selected" : ""} ${isSource ? "t-sel-from" : ""} ${isDestination ? "t-sel-to" : ""} ${allowedStatuses?.includes(table.status) && table.id !== sourceTableId ? "t-available" : ""} ${disabled ? "action-disabled t-dimmed" : ""} ${shakeTableId === table.id ? "shake" : ""}`.trim()}
                  key={table.id}
                  aria-disabled={disabled}
                  onClick={() => {
                    if (!disabled || allowDisabledClick) {
                      onSelectTable(table.id);
                    }
                  }}
                >
                  <div className="waiter-static-table-visual-wrap">
                    <TableVisual
                      number={table.number}
                      shape={table.shape}
                      seats={table.seats}
                      activeOrder={false}
                    />
                  </div>
                  <span className="waiter-static-picker-table-status">{statusLabels[table.status]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
