// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useMemo, useState } from "react";
import type {
  StaffDetailsData,
  StaffDetailsTab,
  StaffPerformancePoint,
  StaffShift,
  StaffTopItem,
} from "../../../../../entities/staff/staff-details.types";
import type {
  GoalMetric,
  TopItemsSort,
} from "../../../../../entities/analytics/analytics.types";
import { TopItemsCard } from "../../../analytics/components/TopItemsCard";
import { GlassDatePicker } from "../../../../../shared/forms/GlassDatePicker";
import { SegmentedSlider } from "../../../../../shared/ui/SegmentedSlider";
import { RevenueTrendChart } from "../../../../../shared/ui/RevenueTrendChart";
import { IconButton } from "../../../../../shared/ui/IconButton";
import { MetricSummaryCard } from "../../../../../shared/ui/MetricSummaryCard";
import { GlassBadge } from "../../../../../shared/ui/GlassBadge";

export type StaffDetailsGoalSummary = {
  id: string;
  label: string;
  metric: GoalMetric;
  targetValue: number;
  currentValue: number;
  startDate: string;
  endDate: string;
  bonus: string;
};

type StaffDetailsContentProps = {
  data: StaffDetailsData;
  activeTab: StaffDetailsTab;
  goals: StaffDetailsGoalSummary[];
  onEditShift: (shiftId: string) => void;
  onDeleteShift: (shiftId: string) => void;
};

type PerformanceMode = "7" | "30" | "365" | "custom";

const performanceModeOptions = [
  { value: "7", label: "7 dana" },
  { value: "30", label: "Mesec" },
  { value: "365", label: "Godina" },
  { value: "custom", label: "Ručno" },
] satisfies {
  value: PerformanceMode;
  label: string;
}[];

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];

function getSafeNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("sr-RS")} RSD`;
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getToday() {
  return formatInputDate(new Date());
}

function formatDisplayDate(value: string) {
  const date = parseInputDate(value);

  if (!date) return value;

  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${date.getFullYear()}.`;
}

function getDaysBetween(startDate: string, endDate: string) {
  const start = parseInputDate(startDate);
  const end = parseInputDate(endDate);

  if (!start || !end) {
    return 7;
  }

  return Math.max(Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1, 1);
}

function getStartForMode(mode: Exclude<PerformanceMode, "custom">) {
  const today = new Date();

  if (mode === "365") {
    today.setMonth(today.getMonth() - 11);
    today.setDate(1);
    return formatInputDate(today);
  }

  today.setDate(today.getDate() - Number(mode) + 1);

  return formatInputDate(today);
}

function getStatusLabel(status: string) {
  if (status === "active") return "Aktivan";
  if (status === "waiting") return "Čeka";
  if (status === "reserved") return "Rezervisan";
  return "Zatvoren";
}

function getStatusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "waiting") return "warning" as const;
  if (status === "reserved") return "info" as const;
  return "muted" as const;
}

function getGoalValue(value: number, metric: GoalMetric) {
  if (metric === "orders") {
    return value === 1 ? "1 narudžbina" : `${value.toLocaleString("sr-RS")} narudžbina`;
  }

  if (metric === "tables") {
    return value === 1 ? "1 sto" : `${value.toLocaleString("sr-RS")} stolova`;
  }

  return formatCurrency(value);
}

function buildDailyPoints(points: StaffPerformancePoint[], count: number) {
  const dayNames = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

  if (points.length === 0) {
    return Array.from({ length: count }, (_, index) => ({
      label: count <= 7 ? dayNames[index % 7] : `${index + 1}. dan`,
      value: 0,
    }));
  }

  return Array.from({ length: count }, (_, index) => {
    const basePoint = points[index % points.length];
    const multiplier = 0.86 + ((index % 6) * 0.045);

    return {
      label: count <= 7 ? dayNames[index % 7] : `${index + 1}. dan`,
      value: Math.round(getSafeNumber(basePoint.revenue) * multiplier),
    };
  });
}

function buildWeeklyPoints(points: StaffPerformancePoint[]) {
  if (points.length === 0) {
    return Array.from({ length: 5 }, (_, index) => ({
      label: `Ned. ${index + 1}`,
      value: 0,
    }));
  }

  return Array.from({ length: 5 }, (_, index) => {
    const basePoint = points[index % points.length];

    return {
      label: `Ned. ${index + 1}`,
      value: Math.round(getSafeNumber(basePoint.revenue) * (5.2 + index * 0.18)),
    };
  });
}

function buildMonthlyPoints(points: StaffPerformancePoint[], months: number) {
  if (points.length === 0) {
    return Array.from({ length: months }, (_, index) => ({
      label: monthLabels[index % monthLabels.length],
      value: 0,
    }));
  }

  const now = new Date();
  const startMonth = now.getMonth() - months + 1;

  return Array.from({ length: months }, (_, index) => {
    const monthIndex = (startMonth + index + 12) % 12;
    const basePoint = points[index % points.length];

    return {
      label: monthLabels[monthIndex],
      value: Math.round(getSafeNumber(basePoint.revenue) * (23 + index * 0.42)),
    };
  });
}

function buildCustomPoints(points: StaffPerformancePoint[], startDate: string, endDate: string) {
  const days = getDaysBetween(startDate, endDate);

  if (days <= 14) {
    return buildDailyPoints(points, days);
  }

  if (days <= 70) {
    const weeks = Math.min(Math.ceil(days / 7), 10);

    if (points.length === 0) {
      return Array.from({ length: weeks }, (_, index) => ({
        label: `Ned. ${index + 1}`,
        value: 0,
      }));
    }

    return Array.from({ length: weeks }, (_, index) => {
      const basePoint = points[index % points.length];

      return {
        label: `Ned. ${index + 1}`,
        value: Math.round(getSafeNumber(basePoint.revenue) * (5.1 + index * 0.2)),
      };
    });
  }

  if (days <= 730) {
    const months = Math.min(Math.ceil(days / 30), 12);
    return buildMonthlyPoints(points, months);
  }

  const years = Math.min(Math.ceil(days / 365), 5);
  const currentYear = new Date().getFullYear();

  if (points.length === 0) {
    return Array.from({ length: years }, (_, index) => ({
      label: `${currentYear - years + index + 1}`,
      value: 0,
    }));
  }

  return Array.from({ length: years }, (_, index) => {
    const basePoint = points[index % points.length];

    return {
      label: `${currentYear - years + index + 1}`,
      value: Math.round(getSafeNumber(basePoint.revenue) * (260 + index * 8)),
    };
  });
}

function buildPerformancePoints(
  points: StaffPerformancePoint[],
  mode: PerformanceMode,
  startDate: string,
  endDate: string,
) {
  if (mode === "7") return buildDailyPoints(points, 7);
  if (mode === "30") return buildWeeklyPoints(points);
  if (mode === "365") return buildMonthlyPoints(points, 12);

  return buildCustomPoints(points, startDate, endDate);
}

function StaffMetricCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <MetricSummaryCard
      className="staff-details-metric-card"
      icon={icon}
      label={label}
      value={value}
    />
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="staff-details-section-title">
      <span>{title}</span>
      <p>{description}</p>
    </div>
  );
}

function TablesTab({ data }: { data: StaffDetailsData }) {
  const activeTables = data.tables.filter((table) => table.status === "active").length;
  const totalBill = data.tables.reduce((sum, table) => sum + getSafeNumber(table.currentBill), 0);

  return (
    <div className="staff-details-tab-content custom-scrollbar">
      <div className="staff-details-metric-grid">
        <StaffMetricCard icon="🍽" value={activeTables.toString()} label="Aktivni stolovi" />
        <StaffMetricCard icon="💰" value={formatCurrency(totalBill)} label="Otvoren promet" />
        <StaffMetricCard icon="⭐" value={getSafeNumber(data.profile.rating).toFixed(1)} label="Ocena rada" />
      </div>

      <section className="staff-details-list-section">
        <SectionHeader title="Aktivni stolovi" description="Stolovi koje ovaj radnik trenutno opslužuje" />

        <div className="staff-details-card-list">
          {data.tables.map((table) => (
            <div className="staff-details-table-card" key={table.id}>
              <div className="staff-details-table-top">
                <div>
                  <strong>Sto {table.tableNumber}</strong>
                  <span>{table.sector}</span>
                </div>

                <GlassBadge tone={getStatusTone(table.status)} dot className={`staff-details-table-status ${table.status}`}>
                  {getStatusLabel(table.status)}
                </GlassBadge>
              </div>

              <div className="staff-details-table-meta">
                <span>{table.guests} gostiju</span>
                <span>Otvoreno: {table.openedAt}</span>
                <strong>{getSafeNumber(table.currentBill) > 0 ? formatCurrency(getSafeNumber(table.currentBill)) : "Bez računa"}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EditGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function ShiftCard({
  shift,
  history = false,
  onEdit,
  onDelete,
}: {
  shift: StaffShift;
  history?: boolean;
  onEdit?: (shiftId: string) => void;
  onDelete?: (shiftId: string) => void;
}) {
  return (
    <div className={`staff-details-shift-card ${history ? "history" : "with-actions"}`}>
      <div className="staff-details-shift-date">
        <span>{shift.day}</span>
        <strong>{shift.date}</strong>
      </div>

      <div className="staff-details-shift-main">
        <span>{shift.sector}</span>
        <strong>{shift.time}</strong>
      </div>

      <div className="staff-details-shift-side">
        <span>{shift.type}</span>
        <GlassBadge tone={history ? "muted" : shift.status === "pending" ? "warning" : "success"} dot className={`staff-details-shift-status ${shift.status === "pending" ? "pending" : ""}`}>
          {history ? "Odradio" : shift.status === "pending" ? "Na potvrdi" : "Potvrđeno"}
        </GlassBadge>
      </div>

      {!history ? (
        <div className="staff-details-shift-actions">
          <IconButton aria-label="Izmeni smenu" title="Izmeni smenu" onClick={() => onEdit?.(shift.id)}>
            <EditGlyph />
          </IconButton>
          <IconButton variant="danger" aria-label="Ukloni smenu" title="Ukloni smenu" onClick={() => onDelete?.(shift.id)}>
            <TrashGlyph />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleTab({
  data,
  onEditShift,
  onDeleteShift,
}: {
  data: StaffDetailsData;
  onEditShift: (shiftId: string) => void;
  onDeleteShift: (shiftId: string) => void;
}) {
  const history = data.scheduleHistory ?? [];

  return (
    <div className="staff-details-tab-content custom-scrollbar">
      <section className="staff-details-list-section">
        <SectionHeader title="Predstojeće smene" description="Raspored koji je trenutno aktivan za ovog radnika" />

        <div className="staff-details-card-list">
          {data.schedule.length > 0 ? (
            data.schedule.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} onEdit={onEditShift} onDelete={onDeleteShift} />
            ))
          ) : (
            <div className="staff-details-empty-card">Nema zakazanih smena.</div>
          )}
        </div>
      </section>

      <section className="staff-details-list-section">
        <SectionHeader title="Istorija" description="Prethodne smene koje je radnik već odradio" />

        <div className="staff-details-card-list">
          {history.length > 0 ? (
            history.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} history />
            ))
          ) : (
            <div className="staff-details-empty-card">Nema prethodnih smena.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function GoalSummaryCard({ goals }: { goals: StaffDetailsGoalSummary[] }) {
  if (goals.length === 0) {
    return (
      <div className="chart-card staff-details-goals-panel">
        <div className="chart-header">
          <div>
            <span className="chart-title">Cilj radnika</span>
            <p>Trenutno nema postavljenog cilja</p>
          </div>
        </div>

        <div className="staff-details-goal-empty">
          <span>🎯</span>
          <p>Radnik trenutno nema postavljen cilj.</p>
        </div>
      </div>
    );
  }

  const activeGoal = goals[0];
  const progress =
    activeGoal.targetValue > 0
      ? Math.min((activeGoal.currentValue / activeGoal.targetValue) * 100, 100)
      : 0;

  return (
    <div className="chart-card staff-details-goals-panel">
      <div className="chart-header">
        <div>
          <span className="chart-title">Cilj radnika</span>
          <p>Aktivni cilj i napredak</p>
        </div>
      </div>

      <div className="staff-details-goals-list">
        <div className="staff-details-goal-card" key={activeGoal.id}>
          <div className="staff-details-goal-top">
            <div>
              <strong>{activeGoal.label}</strong>
              <span>
                {activeGoal.startDate} · {activeGoal.endDate}
              </span>
            </div>

            <small className={progress >= 100 ? "done" : ""}>
              {Math.round(progress)}%
            </small>
          </div>

          <div className="staff-details-goal-progress">
            <div
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div className="staff-details-goal-bottom">
            <span>{getGoalValue(activeGoal.currentValue, activeGoal.metric)}</span>
            <strong>{getGoalValue(activeGoal.targetValue, activeGoal.metric)}</strong>
          </div>

          {activeGoal.bonus ? (
            <div className="staff-details-goal-bonus">🎁 {activeGoal.bonus}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PerformanceTab({
  data,
  goals,
}: {
  data: StaffDetailsData;
  goals: StaffDetailsGoalSummary[];
}) {
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>("7");
  const [startDate, setStartDate] = useState(() => getStartForMode("7"));
  const [endDate, setEndDate] = useState(() => getToday());
  const [topItemsSort, setTopItemsSort] = useState<TopItemsSort>("revenue");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const chartPoints = useMemo(
    () => buildPerformancePoints(data.performance, performanceMode, startDate, endDate),
    [data.performance, endDate, performanceMode, startDate],
  );

  const totalRevenue = chartPoints.reduce((sum, point) => sum + point.value, 0);
  const totalOrders = data.performance.reduce((sum, point) => sum + getSafeNumber(point.orders), 0);
  const totalTables = data.performance.reduce((sum, point) => sum + getSafeNumber(point.tables), 0);

  const categories = useMemo(() => {
    return Array.from(new Set(data.topItems.map((item) => item.category))).sort((first, second) =>
      first.localeCompare(second, "sr"),
    );
  }, [data.topItems]);

  const filteredTopItems = useMemo<StaffTopItem[]>(() => {
    return [...data.topItems]
      .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
      .sort((firstItem, secondItem) =>
        topItemsSort === "quantity"
          ? getSafeNumber(secondItem.quantity) - getSafeNumber(firstItem.quantity)
          : getSafeNumber(secondItem.revenue) - getSafeNumber(firstItem.revenue),
      );
  }, [categoryFilter, data.topItems, topItemsSort]);

  const handleModeChange = (nextMode: PerformanceMode) => {
    setPerformanceMode(nextMode);

    if (nextMode !== "custom") {
      setStartDate(getStartForMode(nextMode));
      setEndDate(getToday());
    }
  };

  return (
    <div className="staff-details-tab-content custom-scrollbar">
      <div className="staff-details-performance-filters">
        <div className="staff-details-performance-filter-row">
          <div className="staff-details-performance-filter-copy">
            <span>Performanse konobara</span>
            <p>Izaberi period za grafikon i metrike.</p>
          </div>
        </div>

        <SegmentedSlider
          value={performanceMode}
          options={performanceModeOptions}
          onChange={handleModeChange}
          className="staff-details-range-slider"
        />

        {performanceMode === "custom" ? (
          <div className="staff-details-performance-custom-panel">
            <div className="staff-details-performance-custom-copy">
              <span>Ručni period</span>
              <p>Izaberi datume za prikaz učinka radnika.</p>
            </div>

            <div className="staff-details-performance-dates">
              <GlassDatePicker
                label="Od"
                value={startDate}
                onChange={setStartDate}
                max={endDate}
              />

              <GlassDatePicker
                label="Do"
                value={endDate}
                onChange={setEndDate}
                min={startDate}
              />
            </div>
          </div>
        ) : (
          <div className="staff-details-active-range compact">
            <div>
              <span>Period prikaza</span>
              <p>{formatDisplayDate(startDate)} · {formatDisplayDate(endDate)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="staff-details-metric-grid performance">
        <StaffMetricCard icon="💰" value={formatCurrency(totalRevenue)} label="Prihod" />
        <StaffMetricCard icon="📦" value={totalOrders.toLocaleString("sr-RS")} label="Narudžbine" />
        <StaffMetricCard icon="🍽" value={totalTables.toLocaleString("sr-RS")} label="Zatvoreni stolovi" />
      </div>

      <div className="staff-details-performance-chart-row">
        <div className="chart-card revenue-chart-card">
          <div className="chart-header revenue-chart-header">
            <div>
              <span className="chart-title">Prihod po periodu</span>
              <p>Broj tačaka se prilagođava izabranom periodu</p>
            </div>
          </div>

          <RevenueTrendChart points={chartPoints} />
        </div>
      </div>

      <div className="staff-details-performance-full-row">
        <TopItemsCard
          items={filteredTopItems}
          categories={categories}
          sort={topItemsSort}
          categoryFilter={categoryFilter}
          onSortChange={setTopItemsSort}
          onCategoryChange={setCategoryFilter}
        />
      </div>

      <div className="staff-details-performance-full-row">
        <GoalSummaryCard goals={goals} />
      </div>
    </div>
  );
}

export function StaffDetailsContent({
  data,
  activeTab,
  goals,
  onEditShift,
  onDeleteShift,
}: StaffDetailsContentProps) {
  if (activeTab === "schedule") {
    return <ScheduleTab data={data} onEditShift={onEditShift} onDeleteShift={onDeleteShift} />;
  }

  if (activeTab === "performance") {
    return <PerformanceTab data={data} goals={goals} />;
  }

  return <TablesTab data={data} />;
}
