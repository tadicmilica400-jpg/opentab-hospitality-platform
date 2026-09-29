// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../shared/api/client";
import type { StaffDetailsData, StaffShift } from "../../../../entities/staff/staff-details.types";
import type { StaffFormValues, StaffMember } from "../../../../entities/staff/staff.types";

export type ApiStaffRole = {
  id: string;
  name: string;
  icon: string;
  worker_count: number;
};

export type StaffRolesResponse = {
  roles: ApiStaffRole[];
  role_names: string[];
  role_icons: Record<string, string>;
};

export type RoleMutationPayload = {
  name: string;
  icon: string;
  workerIds: string[];
};

export type StaffMutationPayload = StaffFormValues & {
  email?: string;
  phone?: string;
  salary?: string;
  hireDate?: string;
  birthday?: string;
  shiftType?: string;
  status?: StaffMember["status"];
  note?: string;
};

export type StaffShiftPayload = {
  date: string;
  startTime: string;
  endTime: string;
  sector: string;
  type: StaffShift["type"];
  status?: StaffShift["status"];
};

export function getStaffMembers() {
  return apiGet<StaffMember[]>("/staff/");
}

export function createStaffMember(payload: StaffMutationPayload) {
  return apiPost<StaffMember>("/staff/", payload);
}

export function updateStaffMember(workerId: string, payload: Partial<StaffMutationPayload>) {
  return apiPatch<StaffMember>(`/staff/${workerId}/`, payload);
}

export function deleteStaffMember(workerId: string) {
  return apiDelete<{ ok: true }>(`/staff/${workerId}/`);
}

export function activateStaffMember(workerId: string) {
  return apiPost<StaffMember>(`/staff/${workerId}/activate/`, {});
}

export function deactivateStaffMember(workerId: string) {
  return apiPost<StaffMember>(`/staff/${workerId}/deactivate/`, {});
}

export function getStaffRoles() {
  return apiGet<StaffRolesResponse>("/staff-roles/");
}

export function createStaffRole(payload: RoleMutationPayload) {
  return apiPost<ApiStaffRole>("/staff-roles/", payload);
}

export function updateStaffRole(roleName: string, payload: RoleMutationPayload) {
  return apiPatch<ApiStaffRole>(`/staff-roles/${encodeURIComponent(roleName)}/`, payload);
}

export function deleteStaffRole(roleName: string) {
  return apiDelete<{ ok: true }>(`/staff-roles/${encodeURIComponent(roleName)}/`);
}

export function getStaffDetails(workerId: string) {
  return apiGet<StaffDetailsData>(`/staff/${workerId}/details/`);
}

export function createStaffShift(workerId: string, payload: StaffShiftPayload) {
  return apiPost<StaffShift>(`/staff/${workerId}/shifts/`, payload);
}

export function updateStaffShift(workerId: string, shiftId: string, payload: StaffShiftPayload) {
  return apiPatch<StaffShift>(`/staff/${workerId}/shifts/${shiftId}/`, payload);
}

export function deleteStaffShift(workerId: string, shiftId: string) {
  return apiDelete<{ ok: true }>(`/staff/${workerId}/shifts/${shiftId}/`);
}
