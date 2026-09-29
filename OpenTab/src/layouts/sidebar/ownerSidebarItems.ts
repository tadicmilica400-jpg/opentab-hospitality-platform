// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { routes } from "../../app/routes";
import type { OwnerSidebarSummary } from "./ownerSidebarApi";

export type SidebarItemConfig = {
  label: string;
  icon: string;
  path?: string;
  badge?: string;
  danger?: boolean;
};

export type SidebarSectionConfig = {
  label: string;
  items: SidebarItemConfig[];
};

function formatBadge(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value > 99 ? "99+" : String(value);
}

export function getOwnerSidebarSections(summary?: OwnerSidebarSummary | null): SidebarSectionConfig[] {
  return [
    {
      label: "Pregled",
      items: [
        {
          label: "Analitički dashboard",
          icon: "◫",
          path: routes.owner.analytics,
        },
      ],
    },
    {
      label: "Meni",
      items: [
        {
          label: "Upravljanje menijem",
          icon: "≡",
          path: routes.owner.menu,
        },
        {
          label: "Kategorije",
          icon: "☷",
          path: `${routes.owner.menu}?modal=categories`,
        },
      ],
    },
    {
      label: "Prostor",
      items: [
        {
          label: "Mapa lokala",
          icon: "⊞",
          path: routes.owner.venueMap,
        },
        {
          label: "Sektori",
          icon: "☷",
          path: `${routes.owner.venueMap}?modal=sectors`,
        },
      ],
    },
    {
      label: "Osoblje",
      items: [
        {
          label: "Upravljanje osobljem",
          icon: "◎",
          path: routes.owner.staff,
          badge: formatBadge(summary?.staffCount),
        },
        {
          label: "Uloge",
          icon: "◈",
          path: `${routes.owner.staff}?modal=roles`,
        },
      ],
    },
  ];
}

export const ownerSidebarSections = getOwnerSidebarSections();
