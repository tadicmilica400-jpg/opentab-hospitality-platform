// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
export type AnalyticsPeriod = "day" | "week" | "month" | "custom";

export type GoalTargetMode = "all" | "single" | "multiple";

export type GoalMetric = "revenue" | "orders" | "tables";

export type TopItemsSort = "revenue" | "quantity";

export type StaffSortColumn = "name" | "revenue" | "orders" | "tables" | "rating" | "goal";

export type SortDirection = "asc" | "desc";

export type AnalyticsKpi = {
  id: string;
  title: string;
  icon: string;
  value: string;
  trend?: {
    value: string;
    direction: "up" | "down";
    label: string;
  };
};

export type RevenuePoint = {
  label: string;
  value: number;
};

export type TopMenuItemAnalytics = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
};

export type HeatmapCell = {
  day: string;
  hour: number;
  value: number;
  intensity: number;
};

export type StaffAnalyticsBase = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  rating: number;
  avatarUrl: string;
};

export type StaffPerformanceRow = StaffAnalyticsBase & {
  revenue: number;
  orders: number;
  tables: number;
  goalAmount: number | null;
  goalMetric: GoalMetric | null;
  goalStartDate: string | null;
  goalEndDate: string | null;
  goalBonus: string | null;
  goalProgress: number;
  goalCompleted: boolean;
};

export type StaffDetailAnalytics = StaffPerformanceRow & {
  activityByDay: {
    label: string;
    revenue: number;
    orders: number;
  }[];
  topItems: {
    name: string;
    quantity: number;
  }[];
  ratingTrend: {
    label: string;
    rating: number;
  }[];
};

export type RevenueGoal = {
  id: string;
  staffId: string;
  amount: number;
  metric: GoalMetric;
  startDate: string;
  endDate: string;
  bonus: string;
  createdAt: string;
};

export type GoalFormValues = {
  targetMode: GoalTargetMode;
  singleStaffId: string;
  selectedStaffIds: string[];
  amount: number;
  metric: GoalMetric;
  startDate: string;
  endDate: string;
  bonus: string;
};

export type CustomAnalyticsRange = {
  startDate: string;
  endDate: string;
};

export type StaffSortState = {
  column: StaffSortColumn;
  direction: SortDirection;
};