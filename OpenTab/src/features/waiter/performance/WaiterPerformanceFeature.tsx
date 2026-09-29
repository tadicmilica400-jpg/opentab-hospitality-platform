import { useEffect, useMemo, useState } from "react";
import type { AnalyticsKpi } from "../../../entities/analytics/analytics.types";
import type { StaffShift, StaffTableAssignment } from "../../../entities/staff/staff-details.types";
import { GlassDatePicker } from "../../../shared/forms/GlassDatePicker";
import { GlassBadge, type GlassBadgeTone } from "../../../shared/ui/GlassBadge";
import { RevenueTrendChart } from "../../../shared/ui/RevenueTrendChart";
import { SegmentedSlider } from "../../../shared/ui/SegmentedSlider";
import { TopItemsGlassList } from "../../../shared/ui/TopItemsGlassList";
import { KpiCard } from "../../owner/analytics/components/KpiCard";
import {
  buildPerformancePoints,
  formatDisplayDate,
  getSafeNumber,
  getStartForMode,
  getToday,
  performanceModeOptions,
  type PerformanceMode,
} from "../../owner/staff-management/details/staffPerformanceUtils";
import { formatRsd } from "../workspace/formatRsd";
import { getWaiterPerformanceApi, type WaiterPerformanceResponse } from "../workspace/waiterApi";
import { useWaiterData } from "../workspace/useWaiterData";

const tableStatusTones: Record<StaffTableAssignment["status"], GlassBadgeTone> = {
  active: "success",
  waiting: "warning",
  reserved: "info",
  closed: "muted",
};

function tableStatusLabel(status: StaffTableAssignment["status"]) {
  if (status === "waiting") return "Čeka naplatu";
  if (status === "reserved") return "Rezervisan";
  if (status === "closed") return "Zatvoren";
  return "Aktivan";
}

function shiftDurationMinutes(shift: StaffShift) {
  const [startHour, startMinute] = shift.startTime.split(":").map(Number);
  const [endHour, endMinute] = shift.endTime.split(":").map(Number);

  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) {
    return 0;
  }

  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;

  if (end <= start) {
    end += 24 * 60;
  }

  return end - start;
}

function getShiftLabel(start: string | null | undefined, end: string | null | undefined) {
  const formatTime = (value: string | null | undefined) => {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat("sr-RS", { hour: "2-digit", minute: "2-digit" }).format(date);
  };

  const startLabel = formatTime(start);
  const endLabel = formatTime(end);

  if (!startLabel) return "Nema aktivne smene";
  return `${startLabel} - ${endLabel ?? "u toku"}`;
}

function formatHours(minutes: number) {
  return `${(minutes / 60).toLocaleString("sr-RS", { maximumFractionDigits: 1 })} h`;
}

function formatGoalValue(value: number, metric: "revenue" | "orders" | "tables") {
  if (metric === "revenue") return formatRsd(value);
  if (metric === "orders") return `${value.toLocaleString("sr-RS")} nar.`;
  return `${value.toLocaleString("sr-RS")} stol.`;
}

export function WaiterPerformanceFeature() {
  const waiter = useWaiterData();
  const [performance, setPerformance] = useState<WaiterPerformanceResponse | null>(null);
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>("7");
  const [startDate, setStartDate] = useState(() => getStartForMode("7"));
  const [endDate, setEndDate] = useState(() => getToday());

  useEffect(() => {
    let ignore = false;

    getWaiterPerformanceApi()
      .then((payload) => {
        if (!ignore) {
          setPerformance(payload);
        }
      })
      .catch(() => {
        if (!ignore) {
          setPerformance(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const details = performance?.details;
  const ownerPerformance = useMemo(() => details?.performance ?? [], [details?.performance]);
  const chartPoints = useMemo(
    () => buildPerformancePoints(ownerPerformance, performanceMode, startDate, endDate),
    [endDate, ownerPerformance, performanceMode, startDate],
  );

  const totalRevenue = chartPoints.reduce((sum, point) => sum + getSafeNumber(point.value), 0);
  const totalOrders = ownerPerformance.reduce((sum, point) => sum + getSafeNumber(point.orders), 0);
  const totalTables = ownerPerformance.reduce((sum, point) => sum + getSafeNumber(point.tables), 0);
  const averageBill = totalTables > 0 ? totalRevenue / totalTables : 0;
  const averageRating = getSafeNumber(details?.profile.rating, 0);
  const activeTables = (details?.tables ?? []).filter((table) => table.status !== "closed");
  const activeGoal = details?.goals?.[0];
  const goalProgress = activeGoal && activeGoal.targetValue > 0
    ? Math.min(Math.round((activeGoal.currentValue / activeGoal.targetValue) * 100), 100)
    : 0;
  const goalValue = activeGoal
    ? `${formatGoalValue(activeGoal.currentValue, activeGoal.metric)} / ${formatGoalValue(activeGoal.targetValue, activeGoal.metric)}`
    : "Nema cilja";

  const shiftsInPeriod = useMemo(() => {
    const uniqueShifts = new Map<string, StaffShift>();

    [...(details?.scheduleHistory ?? []), ...(details?.schedule ?? [])].forEach((shift) => {
      if (shift.inputDate >= startDate && shift.inputDate <= endDate && shift.status === "confirmed") {
        uniqueShifts.set(shift.id, shift);
      }
    });

    return Array.from(uniqueShifts.values());
  }, [details?.schedule, details?.scheduleHistory, endDate, startDate]);

  const shiftMinutes = shiftsInPeriod.reduce((sum, shift) => sum + shiftDurationMinutes(shift), 0);

  const kpis: AnalyticsKpi[] = [
    {
      id: "tables",
      title: "Opsluženi stolovi",
      icon: "▦",
      value: totalTables.toLocaleString("sr-RS"),
      trend: { value: String(shiftsInPeriod.length), direction: "up", label: "smena u periodu" },
    },
    {
      id: "revenue",
      title: "Ukupan promet",
      icon: "◇",
      value: formatRsd(totalRevenue),
      trend: { value: formatRsd(averageBill), direction: "up", label: "prosečan račun" },
    },
    {
      id: "orders",
      title: "Narudžbine",
      icon: "◷",
      value: totalOrders.toLocaleString("sr-RS"),
      trend: { value: formatHours(shiftMinutes), direction: "up", label: "trajanje smena" },
    },
    {
      id: "rating",
      title: "Prosečna ocena",
      icon: "★",
      value: averageRating > 0 ? averageRating.toFixed(1) : "N/A",
      trend: { value: `${goalProgress}%`, direction: "up", label: "ostvarenje cilja" },
    },
  ];

  const handleModeChange = (nextMode: PerformanceMode) => {
    setPerformanceMode(nextMode);

    if (nextMode !== "custom") {
      setStartDate(getStartForMode(nextMode));
      setEndDate(getToday());
    }
  };

  return (
    <div className="dashboard-main waiter-analytics-page waiter-performance-dashboard">
      <div className="map-header dashboard-header waiter-analytics-header">
        <div className="header-row-top dashboard-header-row">
          <div className="map-title">
            <h1>Moje performanse</h1>
            <p>Isti podaci, proračuni i periodi kao u owner detaljima radnika</p>
          </div>

          <div className="waiter-performance-period-controls">
            <SegmentedSlider
              value={performanceMode}
              options={performanceModeOptions}
              onChange={handleModeChange}
              className="waiter-performance-period-slider"
            />

            {performanceMode === "custom" ? (
              <div className="waiter-performance-custom-dates">
                <GlassDatePicker label="Od" value={startDate} onChange={setStartDate} max={endDate} />
                <GlassDatePicker label="Do" value={endDate} onChange={setEndDate} min={startDate} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="dashboard-scroll-area custom-scrollbar waiter-analytics-scroll">
        <div className="kpi-grid">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>

        <div className="dashboard-row waiter-analytics-row">
          <section className="chart-card revenue-chart-card">
            <div className="chart-header revenue-chart-header">
              <div>
                <span className="chart-title">Prihod po periodu</span>
                <p>{formatDisplayDate(startDate)} · {formatDisplayDate(endDate)}</p>
              </div>
              <div className="revenue-chart-summary">
                <div>
                  <span>Smene</span>
                  <strong>{shiftsInPeriod.length} · {formatHours(shiftMinutes)}</strong>
                </div>
                <div>
                  <span>Cilj</span>
                  <strong>{goalValue}</strong>
                </div>
              </div>
            </div>
            <RevenueTrendChart points={chartPoints} emptyText="Nema prometa u izabranom periodu." />
          </section>

          <section className="chart-card top-items-card">
            <div className="chart-header top-items-header">
              <div>
                <span className="chart-title">Najčešće stavke</span>
                <p>Isti podaci o artiklima kao u owner detaljima radnika</p>
              </div>
            </div>
            <TopItemsGlassList items={details?.topItems ?? []} emptyText="Nema stavki za prikaz." />
          </section>
        </div>

        <section className="chart-card waiter-analytics-table-card">
          <div className="chart-header">
            <div>
              <span className="chart-title">Aktivni stolovi</span>
              <p>Stolovi iz istog owner detalja radnika</p>
            </div>
            <div className="waiter-live-chip">{getShiftLabel(waiter.activeShift?.start, waiter.activeShift?.end)}</div>
          </div>

          <div className="waiter-analytics-table-wrap custom-scrollbar">
            <table className="waiter-analytics-table">
              <thead>
                <tr>
                  <th>Sto</th>
                  <th>Gosti</th>
                  <th>Status</th>
                  <th>Iznos</th>
                  <th>Otvoren</th>
                </tr>
              </thead>
              <tbody>
                {activeTables.map((table) => (
                  <tr key={table.id}>
                    <td>Sto {table.tableNumber}</td>
                    <td>{table.guests} gostiju</td>
                    <td><GlassBadge tone={tableStatusTones[table.status]} dot>{tableStatusLabel(table.status)}</GlassBadge></td>
                    <td>{formatRsd(table.currentBill)}</td>
                    <td>{table.openedAt || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {activeTables.length === 0 ? (
              <div className="analytics-empty-state compact">
                <span>◌</span>
                <p>Nema aktivnih stolova za ovog radnika.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
