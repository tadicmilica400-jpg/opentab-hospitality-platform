// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { apiGet, apiPost } from "../../../../shared/api/client";
import type { GoalMetric, GoalTargetMode } from "../../../../entities/analytics/analytics.types";

export type AnalyticsApiPeriod = {
  period: string;
  start: string;
  end: string;
  group_by: "hour" | "day";
};

export type AnalyticsSummaryApi = {
  total_revenue: number;
  revenue_change_percent: number | null;
  orders_count: number;
  orders_change_percent: number | null;
  average_order_value: number;
  paid_payments_count: number;
  active_tables_count: number;
  closed_tables_count: number;
  has_data: boolean;
};

export type AnalyticsRevenuePointApi = {
  label: string;
  date: string;
  hour: number | null;
  revenue: number;
  orders: number;
};

export type AnalyticsTopItemApi = {
  id: string;
  name: string;
  category: string;
  quantity_sold: number;
  revenue: number;
  share_percent: number;
};

export type AnalyticsHeatmapCellApi = {
  day: number;
  day_label: string;
  hour: number;
  active_tables: number;
  orders: number;
};

export type AnalyticsGoalProgressApi = {
  id: string;
  target_mode: GoalTargetMode;
  target_metric: GoalMetric;
  period_start: string;
  period_end: string;
  target: number;
  progress: number;
  progress_percent: number;
  completed: boolean;
  bonus: string;
};

export type AnalyticsStaffPerformanceApi = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  status: "active" | "inactive";
  revenue: number;
  orders_count: number;
  tables_count: number;
  average_rating: number;
  goal: AnalyticsGoalProgressApi | null;
};

export type AnalyticsGoalApi = {
  id: string;
  targetMode: GoalTargetMode;
  targetMetric: GoalMetric;
  waiterId: string | null;
  waiterIds: string[];
  periodStart: string;
  periodEnd: string;
  targetRevenue: number;
  targetOrderCount: number | null;
  targetTableCount: number | null;
  bonus: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AnalyticsDashboardApiResponse = {
  period: AnalyticsApiPeriod;
  summary: AnalyticsSummaryApi;
  revenue_series: AnalyticsRevenuePointApi[];
  top_items: AnalyticsTopItemApi[];
  occupancy_heatmap: AnalyticsHeatmapCellApi[];
  staff_performance: AnalyticsStaffPerformanceApi[];
  goals: AnalyticsGoalApi[];
};

export type CreateAnalyticsGoalPayload = {
  targetMode: GoalTargetMode;
  targetMetric: GoalMetric;
  waiterId?: string;
  waiterIds?: string[];
  periodStart: string;
  periodEnd: string;
  targetRevenue?: number;
  targetOrderCount?: number;
  targetTableCount?: number;
  bonus?: string;
};

export function getAnalyticsDashboard(queryString: string) {
  return apiGet<AnalyticsDashboardApiResponse>(`/analytics/dashboard/${queryString}`);
}

export function createAnalyticsGoal(payload: CreateAnalyticsGoalPayload) {
  return apiPost<AnalyticsGoalApi>("/analytics/goals/", payload);
}
