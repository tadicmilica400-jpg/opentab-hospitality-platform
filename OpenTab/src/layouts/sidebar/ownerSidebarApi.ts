// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { apiGet } from "../../shared/api/client";

export type OwnerSidebarSummary = {
  menuItemsCount: number;
  menuCategoriesCount: number;
  venueTablesCount: number;
  venueSectorsCount: number;
  staffCount: number;
  staffRolesCount: number;
};

export const OWNER_SIDEBAR_REFRESH_EVENT = "opentab:owner-sidebar-refresh";

export function getOwnerSidebarSummary() {
  return apiGet<OwnerSidebarSummary>("/owner/sidebar-summary/");
}

export function notifyOwnerSidebarChanged() {
  window.dispatchEvent(new Event(OWNER_SIDEBAR_REFRESH_EVENT));
}
