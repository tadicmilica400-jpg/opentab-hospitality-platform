// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { StaffGender, StaffMember } from "./staff.types";

export type { StaffGender } from "./staff.types";

export type StaffDetailsTab = "tables" | "schedule" | "performance";


export type StaffDetailsProfile = StaffMember & {
  email: string;
  phone: string;
  hireDate: string;
  birthday: string;
  salary: string;
  shiftType: string;
  rating: number;
  note: string;
};

export type StaffTableAssignment = {
  id: string;
  tableNumber: string;
  sector: string;
  status: "active" | "waiting" | "reserved" | "closed";
  guests: number;
  currentBill: number;
  openedAt: string;
};

export type StaffShift = {
  id: string;
  day: string;
  date: string;
  inputDate: string;
  startTime: string;
  endTime: string;
  time: string;
  sector: string;
  type: "Jutarnja" | "Popodnevna" | "Večernja" | "Drugo";
  status: "confirmed" | "pending";
};

export type StaffPerformancePoint = {
  label: string;
  revenue: number;
  orders: number;
  tables: number;
};

export type StaffTopItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
};


export type StaffGoalSummary = {
  id: string;
  label: string;
  metric: "revenue" | "orders" | "tables";
  targetValue: number;
  currentValue: number;
  startDate: string;
  endDate: string;
  bonus: string;
};

export type StaffDetailsData = {
  profile: StaffDetailsProfile;
  tables: StaffTableAssignment[];
  schedule: StaffShift[];
  scheduleHistory?: StaffShift[];
  performance: StaffPerformancePoint[];
  topItems: StaffTopItem[];
  goals?: StaffGoalSummary[];
};

export type StaffDetailsFormValues = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  salary: string;
  hireDate: string;
  birthday: string;
  gender: StaffGender;
  shiftType: string;
  status: "active" | "inactive";
  note: string;
};
