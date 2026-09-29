// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnalyticsKpi,
  AnalyticsPeriod,
  CustomAnalyticsRange,
  GoalFormValues,
  GoalMetric,
  RevenuePoint,
  StaffAnalyticsBase,
  StaffDetailAnalytics,
  StaffPerformanceRow,
  StaffSortColumn,
  StaffSortState,
  TopItemsSort,
  TopMenuItemAnalytics,
} from "../../../../entities/analytics/analytics.types";
import type { ActionResult } from "../../../../shared/types/action.types";
import type { CurrentGoalCardItem } from "../components/CurrentGoalsCard";
import {
  createAnalyticsGoal,
  getAnalyticsDashboard,
  type AnalyticsDashboardApiResponse,
  type AnalyticsHeatmapCellApi,
  type AnalyticsStaffPerformanceApi,
  type CreateAnalyticsGoalPayload,
} from "../api/analyticsApi";

const analyticsDays = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("sr-RS")} RSD`;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getMetricValue(row: Pick<StaffPerformanceRow, "revenue" | "orders" | "tables">, metric: GoalMetric) {
  if (metric === "orders") return row.orders;
  if (metric === "tables") return row.tables;
  return row.revenue;
}

function getTrend(changePercent: number | null | undefined) {
  if (changePercent === null || changePercent === undefined) {
    return undefined;
  }

  const isDown = changePercent < 0;
  const normalizedValue = Math.abs(changePercent).toLocaleString("sr-RS", {
    maximumFractionDigits: 1,
  });

  return {
    value: `${isDown ? "▼" : "▲"} ${normalizedValue}%`,
    direction: isDown ? "down" : "up",
    label: "u odnosu na prethodni period",
  } satisfies AnalyticsKpi["trend"];
}

function getQueryPeriod(period: AnalyticsPeriod) {
  if (period === "day") return "today";
  return period;
}

function buildDashboardQuery(period: AnalyticsPeriod, customRange: CustomAnalyticsRange) {
  const params = new URLSearchParams();
  params.set("period", getQueryPeriod(period));

  if (period === "custom") {
    params.set("start", customRange.startDate);
    params.set("end", customRange.endDate);
  }

  return `?${params.toString()}`;
}

function getPeriodLabel(period: AnalyticsPeriod, customRange: CustomAnalyticsRange, data: AnalyticsDashboardApiResponse | null) {
  if (period === "day") return "Danas";
  if (period === "week") return "Ova nedelja";
  if (period === "month") return "Ovaj mesec";

  if (customRange.startDate && customRange.endDate) {
    return `${customRange.startDate} · ${customRange.endDate}`;
  }

  if (data?.period.start && data.period.end) {
    return `${data.period.start} · ${data.period.end}`;
  }

  return "Prilagođeni period";
}

function mapRevenuePoints(data: AnalyticsDashboardApiResponse | null): RevenuePoint[] {
  return (data?.revenue_series ?? []).map((point) => ({
    label: point.label,
    value: Number(point.revenue) || 0,
  }));
}

function mapTopItems(data: AnalyticsDashboardApiResponse | null): TopMenuItemAnalytics[] {
  return (data?.top_items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category || "Bez kategorije",
    quantity: Number(item.quantity_sold) || 0,
    revenue: Number(item.revenue) || 0,
  }));
}

function getDayShortLabel(cell: AnalyticsHeatmapCellApi) {
  if (cell.day >= 0 && cell.day < analyticsDays.length) {
    return analyticsDays[cell.day];
  }

  return cell.day_label.slice(0, 3);
}

function mapHeatmap(data: AnalyticsDashboardApiResponse | null) {
  const rawCells = data?.occupancy_heatmap ?? [];
  const values = rawCells.map((cell) => Number(cell.active_tables || 0) + Number(cell.orders || 0));
  const maxValue = Math.max(0, ...values);

  return rawCells.map((cell) => {
    const value = Number(cell.active_tables || 0) + Number(cell.orders || 0);

    return {
      day: getDayShortLabel(cell),
      hour: Number(cell.hour) || 0,
      value,
      intensity: maxValue > 0 ? value / maxValue : 0,
    };
  });
}

function mapStaffBase(row: AnalyticsStaffPerformanceApi): StaffAnalyticsBase {
  return {
    id: row.id,
    fullName: row.full_name || row.username,
    username: row.username,
    role: row.role || "Konobar",
    rating: Number(row.average_rating) || 0,
    avatarUrl: "",
  };
}

function mapStaffRows(data: AnalyticsDashboardApiResponse | null, staffSort: StaffSortState): StaffPerformanceRow[] {
  const rows = (data?.staff_performance ?? []).map((row) => {
    const revenue = Number(row.revenue) || 0;
    const orders = Number(row.orders_count) || 0;
    const tables = Number(row.tables_count) || 0;
    const goal = row.goal;
    const goalAmount = goal ? Number(goal.target) || 0 : null;
    const goalMetric = goal?.target_metric ?? null;
    const goalProgress = goal ? Math.min(Number(goal.progress_percent) || 0, 100) : 0;

    return {
      ...mapStaffBase(row),
      revenue,
      orders,
      tables,
      goalAmount,
      goalMetric,
      goalStartDate: goal?.period_start ?? null,
      goalEndDate: goal?.period_end ?? null,
      goalBonus: goal?.bonus ?? null,
      goalProgress,
      goalCompleted: Boolean(goal?.completed),
    };
  });

  return [...rows].sort((firstRow, secondRow) => {
    const direction = staffSort.direction === "asc" ? 1 : -1;

    if (staffSort.column === "name") {
      return firstRow.fullName.localeCompare(secondRow.fullName, "sr") * direction;
    }

    const getValue = (row: StaffPerformanceRow, column: StaffSortColumn) => {
      if (column === "revenue") return row.revenue;
      if (column === "orders") return row.orders;
      if (column === "tables") return row.tables;
      if (column === "rating") return row.rating;
      if (column === "goal") return row.goalAmount ?? 0;
      return 0;
    };

    return (getValue(firstRow, staffSort.column) - getValue(secondRow, staffSort.column)) * direction;
  });
}

function getTargetStaffIds(values: GoalFormValues, staffMembers: StaffAnalyticsBase[]) {
  if (values.targetMode === "all") {
    return staffMembers.map((staffMember) => staffMember.id);
  }

  if (values.targetMode === "single") {
    return values.singleStaffId ? [values.singleStaffId] : [];
  }

  return values.selectedStaffIds;
}

function buildGoalPayload(values: GoalFormValues): CreateAnalyticsGoalPayload {
  const targetStaffIds =
    values.targetMode === "single"
      ? values.singleStaffId
        ? [values.singleStaffId]
        : []
      : values.selectedStaffIds;

  return {
    targetMode: values.targetMode,
    targetMetric: values.metric,
    waiterId: values.targetMode === "single" ? values.singleStaffId : undefined,
    waiterIds: values.targetMode === "multiple" ? targetStaffIds : undefined,
    periodStart: values.startDate,
    periodEnd: values.endDate,
    targetRevenue: values.metric === "revenue" ? values.amount : 0,
    targetOrderCount: values.metric === "orders" ? values.amount : undefined,
    targetTableCount: values.metric === "tables" ? values.amount : undefined,
    bonus: normalizeText(values.bonus),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Analitika trenutno nije dostupna.";
}

export function getGoalMetricLabel(metric: GoalMetric | null) {
  if (metric === "orders") return "Narudžbine";
  if (metric === "tables") return "Stolovi";
  return "Prihod";
}

export function formatGoalValue(value: number, metric: GoalMetric | null) {
  if (metric === "orders") {
    return value === 1 ? "1 narudžbina" : `${value.toLocaleString("sr-RS")} narudžbina`;
  }

  if (metric === "tables") {
    return value === 1 ? "1 sto" : `${value.toLocaleString("sr-RS")} stolova`;
  }

  return `${value.toLocaleString("sr-RS")} RSD`;
}

export function formatGoalDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return "Period nije podešen";
  }

  return `${startDate} · ${endDate}`;
}

export function useAnalyticsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("day");
  const [customRange, setCustomRange] = useState<CustomAnalyticsRange>({
    startDate: "",
    endDate: "",
  });
  const [topItemsSort, setTopItemsSort] = useState<TopItemsSort>("revenue");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [staffSort, setStaffSort] = useState<StaffSortState>({
    column: "name",
    direction: "asc",
  });
  const [data, setData] = useState<AnalyticsDashboardApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    if (period === "custom" && (!customRange.startDate || !customRange.endDate)) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await getAnalyticsDashboard(buildDashboardQuery(period, customRange));
      setData(response);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, [customRange, period]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const revenuePoints = useMemo(() => mapRevenuePoints(data), [data]);
  const allTopItems = useMemo(() => mapTopItems(data), [data]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    allTopItems.forEach((item) => values.add(item.category));
    return Array.from(values).sort((first, second) => first.localeCompare(second, "sr"));
  }, [allTopItems]);

  const topItems = useMemo(() => {
    return [...allTopItems]
      .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
      .sort((firstItem, secondItem) =>
        topItemsSort === "quantity"
          ? secondItem.quantity - firstItem.quantity
          : secondItem.revenue - firstItem.revenue,
      );
  }, [allTopItems, categoryFilter, topItemsSort]);

  const heatmap = useMemo(() => mapHeatmap(data), [data]);
  const staffRows = useMemo(() => mapStaffRows(data, staffSort), [data, staffSort]);

  const staffMembers = useMemo<StaffAnalyticsBase[]>(() => {
    return (data?.staff_performance ?? []).map(mapStaffBase);
  }, [data]);

  const currentGoals = useMemo<CurrentGoalCardItem[]>(() => {
    return staffRows
      .filter((row) => row.goalAmount !== null && row.goalMetric !== null)
      .map((row) => ({
        id: `${row.id}-${row.goalStartDate ?? "goal"}`,
        staffId: row.id,
        staffName: row.fullName,
        username: row.username,
        amount: row.goalAmount ?? 0,
        currentValue: getMetricValue(row, row.goalMetric ?? "revenue"),
        metric: row.goalMetric ?? "revenue",
        progress: row.goalProgress,
        completed: row.goalCompleted,
        startDate: row.goalStartDate ?? "",
        endDate: row.goalEndDate ?? "",
        bonus: row.goalBonus ?? "",
      }));
  }, [staffRows]);

  const summary = data?.summary;
  const noData = Boolean(data && summary && !summary.has_data);

  const kpis = useMemo<AnalyticsKpi[]>(
    () => [
      {
        id: "revenue",
        title: "Ukupan prihod",
        icon: "💰",
        value: formatCurrency(summary?.total_revenue ?? 0),
        trend: getTrend(summary?.revenue_change_percent),
      },
      {
        id: "orders",
        title: "Broj narudžbina",
        icon: "📦",
        value: (summary?.orders_count ?? 0).toLocaleString("sr-RS"),
        trend: getTrend(summary?.orders_change_percent),
      },
      {
        id: "average-ticket",
        title: "Prosečan račun",
        icon: "📊",
        value: formatCurrency(summary?.average_order_value ?? 0),
      },
      {
        id: "staff",
        title: "Aktivni konobari",
        icon: "👥",
        value: staffMembers.length.toLocaleString("sr-RS"),
      },
    ],
    [staffMembers.length, summary],
  );

  const periodLabel = useMemo(
    () => getPeriodLabel(period, customRange, data),
    [customRange, data, period],
  );

  const setSortColumn = (column: StaffSortColumn) => {
    setStaffSort((currentSort) =>
      currentSort.column === column
        ? {
            column,
            direction: currentSort.direction === "asc" ? "desc" : "asc",
          }
        : {
            column,
            direction: column === "name" ? "asc" : "desc",
          },
    );
  };

  const setCustomPeriod = (range: CustomAnalyticsRange): ActionResult => {
    if (!range.startDate || !range.endDate) {
      return {
        ok: false,
        message: "Unesite početni i krajnji datum.",
      };
    }

    if (range.startDate > range.endDate) {
      return {
        ok: false,
        message: "Početni datum ne može biti posle krajnjeg datuma.",
      };
    }

    setCustomRange(range);
    setPeriod("custom");

    return {
      ok: true,
    };
  };

  const createGoal = async (values: GoalFormValues): Promise<ActionResult> => {
    if (!Number.isFinite(values.amount) || values.amount <= 0) {
      return {
        ok: false,
        message: "Vrednost cilja mora biti veća od nule.",
      };
    }

    if (!values.startDate || !values.endDate) {
      return {
        ok: false,
        message: "Izaberite početni i krajnji datum cilja.",
      };
    }

    if (values.startDate > values.endDate) {
      return {
        ok: false,
        message: "Početni datum cilja ne može biti posle krajnjeg datuma.",
      };
    }

    if (getTargetStaffIds(values, staffMembers).length === 0) {
      return {
        ok: false,
        message: "Izaberite bar jednog konobara.",
      };
    }

    try {
      await createAnalyticsGoal(buildGoalPayload(values));
      await fetchDashboard();

      return {
        ok: true,
      };
    } catch (submitError) {
      return {
        ok: false,
        message: getErrorMessage(submitError),
      };
    }
  };

  const getStaffDetail = (staffId: string): StaffDetailAnalytics | null => {
    const row = staffRows.find((staffMember) => staffMember.id === staffId);

    if (!row) {
      return null;
    }

    return {
      ...row,
      activityByDay: revenuePoints.slice(0, 7).map((point) => ({
        label: point.label,
        revenue: Math.round(point.value / Math.max(staffRows.length, 1)),
        orders: Math.max(0, Math.round((summary?.orders_count ?? 0) / Math.max(staffRows.length * 7, 1))),
      })),
      topItems: topItems.slice(0, 3).map((item) => ({
        name: item.name,
        quantity: item.quantity,
      })),
      ratingTrend: [
        { label: "Pre", rating: Math.max(0, row.rating - 0.2) },
        { label: "Sada", rating: row.rating },
      ],
    };
  };

  return {
    period,
    periodLabel,
    customRange,
    isLoading,
    error,
    noData,
    kpis,
    revenuePoints,
    topItems,
    topItemsSort,
    categoryFilter,
    categories,
    heatmap,
    staffRows,
    staffSort,
    staffMembers,
    currentGoals,
    setPeriod,
    setCustomPeriod,
    setTopItemsSort,
    setCategoryFilter,
    setSortColumn,
    createGoal,
    getStaffDetail,
    reload: fetchDashboard,
  };
}
