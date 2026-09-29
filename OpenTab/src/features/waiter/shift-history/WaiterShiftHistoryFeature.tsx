import type { AnalyticsKpi, RevenuePoint } from "../../../entities/analytics/analytics.types";
import { GlassBadge } from "../../../shared/ui/GlassBadge";
import { RevenueTrendChart } from "../../../shared/ui/RevenueTrendChart";
import { SegmentedSlider } from "../../../shared/ui/SegmentedSlider";
import { KpiCard } from "../../owner/analytics/components/KpiCard";
import { formatRsd } from "../workspace/formatRsd";
import { getWaiterShiftsApi, type WaiterShiftResponse } from "../workspace/waiterApi";
import { useWaiterData } from "../workspace/useWaiterData";
import { useEffect, useMemo, useState } from "react";

type ShiftHistoryPeriod = "last" | "month";

type PreviousShift = {
  id: string;
  date: string;
  time: string;
  tables: number;
  orders: number;
  revenue: number;
  tips: number;
  rating: number | null;
};

type MonthlyShiftSummary = {
  id: string;
  label: string;
  shifts: number;
  tables: number;
  orders: number;
  revenue: number;
  tips: number;
  rating: number;
};

const periodOptions = [
  { label: "Poslednje smene", value: "last" },
  { label: "Mesec", value: "month" },
] satisfies { label: string; value: ShiftHistoryPeriod }[];

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Avg",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

function parseShiftDate(date: string) {
  const [day, month, year] = date.split(".").map(Number);
  return { day, month, year };
}

function monthLabel(date: string) {
  const { month, year } = parseShiftDate(date);
  return `${monthNames[Math.max(0, month - 1)]} ${year}`;
}

function monthKey(date: string) {
  const { month, year } = parseShiftDate(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildMonthlySummaries(shifts: PreviousShift[]): MonthlyShiftSummary[] {
  const map = new Map<string, MonthlyShiftSummary & { ratingSum: number }>();

  shifts.forEach((shift) => {
    const key = monthKey(shift.date);
    const existing = map.get(key);

    if (existing) {
      existing.shifts += 1;
      existing.tables += shift.tables;
      existing.orders += shift.orders;
      existing.revenue += shift.revenue;
      existing.tips += shift.tips;
      existing.ratingSum += shift.rating ?? 0;
      existing.rating = existing.ratingSum / existing.shifts;
      return;
    }

    map.set(key, {
      id: key,
      label: monthLabel(shift.date),
      shifts: 1,
      tables: shift.tables,
      orders: shift.orders,
      revenue: shift.revenue,
      tips: shift.tips,
      rating: shift.rating ?? 0,
      ratingSum: shift.rating ?? 0,
    });
  });

  return Array.from(map.values())
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((summary) => ({
      id: summary.id,
      label: summary.label,
      shifts: summary.shifts,
      tables: summary.tables,
      orders: summary.orders,
      revenue: summary.revenue,
      tips: summary.tips,
      rating: summary.rating,
    }));
}

function formatShiftDate(iso: string | null | undefined) {
  if (!iso) return "N/A";

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatShiftTime(shift: WaiterShiftResponse) {
  const start = shift.startLabel ?? (shift.start ? new Intl.DateTimeFormat("sr-RS", { hour: "2-digit", minute: "2-digit" }).format(new Date(shift.start)) : "N/A");
  const end = shift.endLabel ?? (shift.end ? new Intl.DateTimeFormat("sr-RS", { hour: "2-digit", minute: "2-digit" }).format(new Date(shift.end)) : "u toku");

  return `${start} - ${end}`;
}

function mapShiftToRow(shift: WaiterShiftResponse): PreviousShift {
  const metrics = shift as WaiterShiftResponse & {
    tables?: number;
    orders?: number;
    revenue?: number;
    tips?: number;
    rating?: number;
  };

  return {
    id: shift.id,
    date: formatShiftDate(shift.start),
    time: formatShiftTime(shift),
    tables: Number(metrics.tables ?? 0),
    orders: Number(metrics.orders ?? 0),
    revenue: Number(metrics.revenue ?? 0),
    tips: Number(metrics.tips ?? 0),
    rating: metrics.rating ?? null,
  };
}

export function WaiterShiftHistoryFeature() {
  const waiter = useWaiterData();
  const [period, setPeriod] = useState<ShiftHistoryPeriod>("last");
  const [shifts, setShifts] = useState<WaiterShiftResponse[]>([]);
  const shiftRows = useMemo(() => shifts.map(mapShiftToRow), [shifts]);
  const monthlySummaries = buildMonthlySummaries(shiftRows);
  const totalRevenue = shiftRows.reduce((sum, shift) => sum + shift.revenue, 0);
  const totalTips = shiftRows.reduce((sum, shift) => sum + shift.tips, 0);
  const totalOrders = shiftRows.reduce((sum, shift) => sum + shift.orders, 0);
  const ratedShifts = shiftRows.filter((shift) => shift.rating !== null);
  const avgRating = ratedShifts.length
    ? ratedShifts.reduce((sum, shift) => sum + (shift.rating ?? 0), 0) / ratedShifts.length
    : null;
  const periodLabel = period === "month" ? "po mesecima" : "zadnje četiri smene";

  useEffect(() => {
    let ignore = false;

    getWaiterShiftsApi()
      .then((payload) => {
        if (!ignore) {
          setShifts(payload);
        }
      })
      .catch(() => {
        if (!ignore) {
          setShifts([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const kpis: AnalyticsKpi[] = [
    {
      id: "shifts",
      title: "Broj smena",
      icon: "◷",
      value: String(shiftRows.length),
      trend: { value: period === "month" ? `${monthlySummaries.length}` : "+1", direction: "up", label: period === "month" ? "aktivnih meseci" : "u odnosu na prošlu nedelju" },
    },
    {
      id: "revenue",
      title: "Ukupan promet",
      icon: "◇",
      value: formatRsd(totalRevenue),
      trend: { value: "+9%", direction: "up", label: periodLabel },
    },
    {
      id: "orders",
      title: "Narudžbine",
      icon: "◷",
      value: String(totalOrders),
      trend: { value: "+14", direction: "up", label: "ukupno obrađeno" },
    },
    {
      id: "rating",
      title: "Prosečna ocena",
      icon: "★",
      value: avgRating === null ? "N/A" : avgRating.toFixed(1),
      trend: { value: String(ratedShifts.length), direction: "up", label: "ocenjenih smena" },
    },
  ];

  const revenuePoints: RevenuePoint[] = period === "month"
    ? monthlySummaries.map((summary) => ({ label: summary.label, value: summary.revenue }))
    : shiftRows
      .slice()
      .reverse()
      .map((shift) => ({ label: shift.date.slice(0, 5), value: shift.revenue }));

  return (
    <div className="dashboard-main waiter-analytics-page waiter-shifts-dashboard">
      <div className="map-header dashboard-header waiter-analytics-header">
        <div className="header-row-top dashboard-header-row">
          <div className="map-title">
            <h1>Istorija smena</h1>
            <p>Pregled prethodnih smena sa metrikama, prometom i ocenama</p>
          </div>

          <SegmentedSlider<ShiftHistoryPeriod>
            value={period}
            options={periodOptions}
            onChange={setPeriod}
            className="staff-details-range-slider waiter-shift-period-slider"
          />
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
                <span className="chart-title">{period === "month" ? "Promet po mesecu" : "Promet po smeni"}</span>
                <p>{period === "month" ? "Agregirani prihodi po mesecima" : "Trend prihoda kroz poslednje smene"}</p>
              </div>
              <div className="revenue-chart-summary">
                <div>
                  <span>Ukupno</span>
                  <strong>{formatRsd(totalRevenue)}</strong>
                </div>
                <div>
                  <span>Napojnice</span>
                  <strong>{formatRsd(totalTips)}</strong>
                </div>
              </div>
            </div>
            <RevenueTrendChart points={revenuePoints} emptyText="Nema zapisa smena." />
          </section>

          <section className="chart-card waiter-current-session-card">
            <div className="chart-header">
              <div>
                <span className="chart-title">Trenutna sesija</span>
                <p>Obrađene narudžbine tokom ovog rada u aplikaciji</p>
              </div>
            </div>

            <div className="waiter-session-list custom-scrollbar">
              {waiter.archive.length === 0 ? (
                <div className="analytics-empty-state compact">
                  <span>◌</span>
                  <p>Još nema obrađenih narudžbina u ovoj sesiji.</p>
                </div>
              ) : null}
              {waiter.archive.map((order) => (
                <div className="top-item-row waiter-session-row" key={`${order.id}-${order.status}`}>
                  <div className="top-item-rank">{order.tableNumber}</div>
                  <div className="top-item-main">
                    <div className="top-item-title-row">
                      <span>{order.guestName}</span>
                      <small>{order.status}</small>
                    </div>
                    <div className="top-item-meta">
                      <strong>{order.sectorName}</strong>
                      <span>{order.items.length} stavki</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="chart-card waiter-analytics-table-card">
          <div className="chart-header">
            <div>
              <span className="chart-title">{period === "month" ? "Mesečni pregled" : "Tabela prethodnih smena"}</span>
              <p>{period === "month" ? "Agregirani podaci po mesecima, po uzoru na owner analitiku" : "Detalji po smeni kao u owner analitici, prilagođeno konobaru"}</p>
            </div>
          </div>

          <div className="waiter-analytics-table-wrap custom-scrollbar">
            <table className="waiter-analytics-table">
              <thead>
                <tr>
                  <th>{period === "month" ? "Mesec" : "Datum"}</th>
                  <th>{period === "month" ? "Smena" : "Vreme"}</th>
                  <th>Stolovi</th>
                  <th>Narudžbine</th>
                  <th>Promet</th>
                  <th>Napojnice</th>
                  <th>Ocena</th>
                </tr>
              </thead>
              <tbody>
                {period === "month" ? monthlySummaries.map((summary) => (
                  <tr key={summary.id}>
                    <td>{summary.label}</td>
                    <td>{summary.shifts}</td>
                    <td>{summary.tables}</td>
                    <td>{summary.orders}</td>
                    <td>{formatRsd(summary.revenue)}</td>
                    <td>{formatRsd(summary.tips)}</td>
                  <td><GlassBadge tone="gold">{summary.rating > 0 ? `★ ${summary.rating.toFixed(1)}` : "N/A"}</GlassBadge></td>
                </tr>
              )) : shiftRows.map((shift) => (
                  <tr key={shift.id}>
                    <td>{shift.date}</td>
                    <td>{shift.time}</td>
                    <td>{shift.tables}</td>
                    <td>{shift.orders}</td>
                    <td>{formatRsd(shift.revenue)}</td>
                    <td>{formatRsd(shift.tips)}</td>
                    <td><GlassBadge tone="gold">{shift.rating === null ? "N/A" : `★ ${shift.rating.toFixed(1)}`}</GlassBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
