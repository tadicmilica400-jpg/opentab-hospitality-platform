// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type {
  AnalyticsPeriod,
  StaffAnalyticsBase,
  TopMenuItemAnalytics,
} from "../../../../entities/analytics/analytics.types";

export const analyticsRevenueData: Record<Exclude<AnalyticsPeriod, "custom">, number[]> = {
  day: [
    8500, 10200, 9300, 11800, 14500, 18900, 16200, 13400, 15600, 17800, 20500, 22400,
    19800, 21200, 23500, 25800, 24200,
  ],
  week: [98500, 112300, 108700, 125400, 142800, 168500, 152300],
  month: [385000, 412000, 448000, 475000, 510000, 545000],
};

export const analyticsTopItemsData: Record<Exclude<AnalyticsPeriod, "custom">, TopMenuItemAnalytics[]> = {
  day: [
    { id: "item-espresso", name: "Espresso", quantity: 82, revenue: 14760, category: "Kafa" },
    { id: "item-limunada", name: "Domaća limunada", quantity: 65, revenue: 18200, category: "Sokovi" },
    { id: "item-cola", name: "Coca Cola", quantity: 55, revenue: 13200, category: "Hladna pića" },
    { id: "item-palacinke", name: "Palačinke sa nutelom", quantity: 41, revenue: 15990, category: "Hrana" },
    { id: "item-cappuccino", name: "Cappuccino", quantity: 39, revenue: 8580, category: "Kafa" },
  ],
  week: [
    { id: "item-espresso", name: "Espresso", quantity: 342, revenue: 61560, category: "Kafa" },
    { id: "item-cappuccino", name: "Cappuccino", quantity: 298, revenue: 65560, category: "Kafa" },
    { id: "item-limunada", name: "Domaća limunada", quantity: 256, revenue: 71680, category: "Sokovi" },
    { id: "item-palacinke", name: "Palačinke sa nutelom", quantity: 189, revenue: 73710, category: "Hrana" },
    { id: "item-cheesecake", name: "NY Cheesecake", quantity: 145, revenue: 60900, category: "Deserti" },
    { id: "item-sok-borovnica", name: "Sok od borovnice", quantity: 138, revenue: 41400, category: "Sokovi" },
  ],
  month: [
    { id: "item-espresso", name: "Espresso", quantity: 1245, revenue: 224100, category: "Kafa" },
    { id: "item-cappuccino", name: "Cappuccino", quantity: 1120, revenue: 246400, category: "Kafa" },
    { id: "item-limunada", name: "Domaća limunada", quantity: 980, revenue: 274400, category: "Sokovi" },
    { id: "item-palacinke", name: "Palačinke sa nutelom", quantity: 810, revenue: 315900, category: "Hrana" },
    { id: "item-cola", name: "Coca Cola", quantity: 790, revenue: 189600, category: "Hladna pića" },
    { id: "item-cheesecake", name: "NY Cheesecake", quantity: 640, revenue: 268800, category: "Deserti" },
  ],
};

export const analyticsStaff: StaffAnalyticsBase[] = [
  {
    id: "staff-marko",
    fullName: "Marko Todorović",
    username: "marko.t",
    role: "Konobar",
    rating: 4.8,
    avatarUrl: "",
  },
  {
    id: "staff-nikola",
    fullName: "Nikola Jović",
    username: "nikola.j",
    role: "Konobar",
    rating: 4.6,
    avatarUrl: "",
  },
  {
    id: "staff-ana",
    fullName: "Ana Petrović",
    username: "ana.p",
    role: "Konobar",
    rating: 4.9,
    avatarUrl: "",
  },
  {
    id: "staff-vladimir",
    fullName: "Vladimir Simić",
    username: "vladimir.s",
    role: "Konobar",
    rating: 4.5,
    avatarUrl: "",
  },
  {
    id: "staff-stefan",
    fullName: "Stefan Lukić",
    username: "stefan.l",
    role: "Konobar",
    rating: 4.7,
    avatarUrl: "",
  },
];

export const analyticsStaffMultipliers: Record<Exclude<AnalyticsPeriod, "custom">, {
  revenue: number;
  orders: number;
  tables: number;
}> = {
  day: {
    revenue: 14000,
    orders: 12,
    tables: 5,
  },
  week: {
    revenue: 98000,
    orders: 75,
    tables: 35,
  },
  month: {
    revenue: 380000,
    orders: 310,
    tables: 145,
  },
};

export const analyticsHeatmapBase = [
  [2, 3, 5, 8, 12, 18, 22, 25, 28, 30, 32, 35, 38, 40, 42, 38, 32],
  [3, 4, 6, 10, 15, 20, 25, 30, 35, 38, 42, 45, 48, 50, 52, 48, 42],
  [2, 3, 5, 9, 14, 18, 22, 28, 32, 36, 40, 42, 45, 48, 50, 45, 40],
  [3, 5, 8, 12, 18, 22, 28, 35, 40, 45, 50, 55, 58, 60, 62, 55, 48],
  [5, 8, 12, 18, 25, 35, 45, 55, 65, 75, 85, 90, 95, 100, 105, 95, 80],
  [8, 12, 18, 25, 35, 50, 65, 80, 95, 110, 120, 130, 135, 140, 145, 130, 110],
  [3, 5, 8, 12, 18, 25, 32, 40, 48, 55, 60, 65, 68, 70, 72, 65, 55],
];

export const analyticsHeatmapMultipliers: Record<Exclude<AnalyticsPeriod, "custom">, number> = {
  day: 0.3,
  week: 1,
  month: 4.2,
};

export const analyticsDays = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

export const analyticsHours = Array.from({ length: 17 }, (_, index) => index + 7);