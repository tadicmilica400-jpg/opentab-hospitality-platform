// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { useMemo, useState } from "react";
import type { WaiterTable, WaiterTableStatus } from "../../../entities/waiter/waiter.types";
import { GlassSearchInput } from "../../../shared/forms/GlassSearchInput";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { PreviewDivider } from "../../../shared/ui/PreviewDivider";
import { StatusPills } from "../../../shared/ui/StatusPills";
import { TableVisual } from "../../owner/venue-map/components/TableVisual";
import { TableStatusLegend } from "./TableStatusLegend";
import { formatRsd } from "../workspace/formatRsd";

type TableFilter = "all" | WaiterTableStatus;

type StepItem = {
  label: string;
  active?: boolean;
  done?: boolean;
};

type WaiterTablePickerPanelProps = {
  title: string;
  subtitle: string;
  selectedTableId: string;
  onSelectTable: (tableId: string) => void;
  steps?: StepItem[];
  liveLabel?: string;
  primaryActionLabel?: string;
  primaryActionDisabled?: boolean;
  primaryActionHint?: string;
  onPrimaryAction?: () => void;
  allowedStatuses?: WaiterTableStatus[];
  selectedPanelTitle?: string;
  selectedPanelKicker?: string;
  tables?: WaiterTable[];
  children?: React.ReactNode;
};

const statusLabels: Record<WaiterTableStatus, string> = {
  free: "Slobodan",
  occupied: "Zauzet",
  reserved: "Rezervisan",
  payment: "Čeka naplatu",
};

const statusOptions: { label: string; value: TableFilter }[] = [
  { label: "Svi", value: "all" },
  { label: "Zauzeti", value: "occupied" },
  { label: "Slobodni", value: "free" },
  { label: "Naplata", value: "payment" },
  { label: "Rezervisani", value: "reserved" },
];

const statusHelperText: Record<WaiterTableStatus, string> = {
  free: "Može da primi novu narudžbinu.",
  occupied: "Ima aktivne goste.",
  reserved: "Rezervisan sto.",
  payment: "Spreman za naplatu.",
};

const sectorOrder = ["Terasa", "Glavna sala", "Sala", "Bar", "Bašta", "Basta", "VIP soba"];

function getActionDisabledByStatus(table: WaiterTable, allowedStatuses?: WaiterTableStatus[]) {
  return Boolean(allowedStatuses?.length && !allowedStatuses.includes(table.status));
}

function groupBySector(tables: WaiterTable[]) {
  const groups = new Map<string, WaiterTable[]>();

  tables.forEach((table) => {
    const group = groups.get(table.sector) ?? [];
    group.push(table);
    groups.set(table.sector, group);
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

export function WaiterTablePickerPanel({
  title,
  subtitle,
  selectedTableId,
  onSelectTable,
  steps = [],
  liveLabel = "",
  primaryActionLabel,
  primaryActionDisabled,
  primaryActionHint,
  onPrimaryAction,
  allowedStatuses,
  selectedPanelTitle = "Izabrani sto",
  selectedPanelKicker = "Izbor stola",
  tables = [],
  children,
}: WaiterTablePickerPanelProps) {
  const [filter, setFilter] = useState<TableFilter>("all");
  const [search, setSearch] = useState("");

  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      const matchesFilter = filter === "all" || table.status === filter;
      const matchesSearch = `${table.number} ${table.sector}`.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, tables]);

  const sectorGroups = useMemo(() => groupBySector(filteredTables), [filteredTables]);
  const firstAllowedTable = filteredTables.find((table) => !getActionDisabledByStatus(table, allowedStatuses)) ?? filteredTables[0] ?? tables[0];
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? firstAllowedTable;
  const disabledByStatus = selectedTable ? getActionDisabledByStatus(selectedTable, allowedStatuses) : true;
  const selectedGuestCount = selectedTable ? (Array.isArray(selectedTable.guests) ? selectedTable.guests.length : selectedTable.guests) : 0;
  const actionDisabled = Boolean(primaryActionDisabled || disabledByStatus);
  const statusHint = disabledByStatus
    ? `Izaberite sto: ${allowedStatuses?.map((status) => statusLabels[status]).join(" ili ")}.`
    : primaryActionHint;

  return (
    <section className="waiter-operation-shell">
      <div className="map-header waiter-operation-header">
        <div className="header-row-top">
          <div className="map-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="waiter-header-tools">
            {steps.length > 0 ? (
              <div className="waiter-step-breadcrumb" aria-label="Koraci">
                {steps.map((step, index) => (
                  <span
                    key={`${step.label}-${index}`}
                    className={`waiter-step-breadcrumb-item ${step.active ? "active" : ""} ${step.done ? "done" : ""}`.trim()}
                  >
                    {index + 1}. {step.label}
                  </span>
                ))}
              </div>
            ) : null}

            {liveLabel ? <div className="waiter-live-chip">{liveLabel}</div> : null}
          </div>
        </div>

        <div className="header-row-middle waiter-operation-controls">
          <GlassSearchInput value={search} onChange={setSearch} placeholder="Pretraži sto..." />
          <StatusPills
            value={filter}
            onChange={(value) => setFilter(value)}
            options={statusOptions.map((option) => ({
              ...option,
              count: option.value === "all" ? tables.length : tables.filter((table) => table.status === option.value).length,
            }))}
          />
        </div>

        <TableStatusLegend />
      </div>

      <div className="map-canvas-container waiter-workspace waiter-prototype-picker-shell">
        <section className="waiter-prototype-table-picker" aria-label="Izbor stola">
          {sectorGroups.length === 0 ? <p className="waiter-empty">Nema rezultata.</p> : null}

          {sectorGroups.map(([sector, sectorTables]) => (
            <div className="waiter-prototype-sector" key={sector}>
              <div className="waiter-prototype-sector-label">
                <span>{sector}</span>
                <small>{sectorTables.length === 1 ? "1 sto" : `${sectorTables.length} stolova`}</small>
              </div>

              <div className="waiter-prototype-tables-row">
                {sectorTables.map((table) => {
                  const selected = selectedTable?.id === table.id;
                  const disabled = getActionDisabledByStatus(table, allowedStatuses);

                  return (
                    <button
                      type="button"
                      className={`waiter-prototype-table ${table.status} ${selected ? "selected" : ""} ${disabled ? "action-disabled" : ""}`.trim()}
                      key={table.id}
                      aria-disabled={disabled}
                      onClick={() => {
                        if (!disabled) onSelectTable(table.id);
                      }}
                    >
                      <TableVisual
                        number={table.number}
                        shape={table.shape ?? "round"}
                        seats={table.seats}
                        activeOrder={table.status === "occupied" || table.status === "payment"}
                        showActiveOrderChip={false}
                      />

                      {table.pendingOrders > 0 ? <span className="waiter-table-orders-badge">{table.pendingOrders}</span> : null}
                      <span className="waiter-prototype-table-status">{statusLabels[table.status]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <aside className="waiter-side-panel waiter-selected-table-panel">
          {selectedTable ? (
            <>
              <div className="table-qr-card waiter-table-summary-card">
                <div className="table-qr-preview-box">
                  <span className="table-qr-corner top-left" />
                  <span className="table-qr-corner top-right" />
                  <span className="table-qr-corner bottom-left" />
                  <strong>{selectedTable.number}</strong>
                </div>

                <div className="table-qr-copy">
                  <span>{selectedPanelKicker}</span>
                  <strong>{selectedPanelTitle} {selectedTable.number}</strong>
                  <small>{selectedTable.sector} · {selectedGuestCount}/{selectedTable.seats} gostiju</small>
                </div>
              </div>

              <div className="waiter-panel-stats waiter-summary-list compact">
                <span><b>Status</b> {statusLabels[selectedTable.status]}</span>
                <span><b>Račun</b> {formatRsd(selectedTable.currentBill)}</span>
                <span><b>Od</b> {selectedTable.openedAt ?? "—"}</span>
                <span><b>Info</b> {statusHelperText[selectedTable.status]}</span>
              </div>
            </>
          ) : (
            <div className="analytics-empty-state compact">
              <span>◌</span>
              <p>Nema učitanih stolova.</p>
            </div>
          )}

          {children ? (
            <>
              <PreviewDivider label="Detalji" />
              {children}
            </>
          ) : null}

          {primaryActionLabel && onPrimaryAction ? (
            <div className="waiter-picker-actions">
              <GlassButton variant="primary" disabled={actionDisabled} onClick={onPrimaryAction}>
                {primaryActionLabel}
              </GlassButton>
              {statusHint ? <p className="waiter-note">{statusHint}</p> : null}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
