// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import { routes } from "../../app/routes";
import type { SidebarSectionConfig } from "./ownerSidebarItems";

function formatBadge(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value > 99 ? "99+" : String(value);
}

export function getWaiterSidebarSections(pendingOrdersCount?: number): SidebarSectionConfig[] {
  return [
    {
      label: "Glavne operacije",
      items: [
        {
          label: "Mapa stolova",
          icon: "▦",
          path: routes.waiter.tables,
        },
        {
          label: "Narudžbine na čekanju",
          icon: "◷",
          path: routes.waiter.pendingOrders,
          badge: formatBadge(pendingOrdersCount),
        },
      ],
    },
    {
      label: "Upravljanje stolom",
      items: [
        {
          label: "Premeštanje stola",
          icon: "⇄",
          path: routes.waiter.transferBase,
        },
        {
          label: "Naplata i zatvaranje",
          icon: "$",
          path: routes.waiter.checkoutBase,
        },
      ],
    },
    {
      label: "Moj rad",
      items: [
        {
          label: "Moje performanse",
          icon: "%",
          path: routes.waiter.performance,
        },
        {
          label: "Istorija smena",
          icon: "◷",
          path: routes.waiter.shiftHistory,
        },
      ],
    },
  ];
}

export const waiterSidebarSections = getWaiterSidebarSections();
