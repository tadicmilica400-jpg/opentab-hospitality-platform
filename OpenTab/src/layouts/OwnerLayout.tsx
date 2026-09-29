// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { routes } from "../app/routes";
import { useAuth } from "../features/auth/AuthProvider";
import { Sidebar } from "./sidebar/Sidebar";
import {
  getOwnerSidebarSummary,
  OWNER_SIDEBAR_REFRESH_EVENT,
  type OwnerSidebarSummary,
} from "./sidebar/ownerSidebarApi";
import { getOwnerSidebarSections } from "./sidebar/ownerSidebarItems";

function getInitials(firstName?: string, lastName?: string, username?: string) {
  const firstInitial = firstName?.trim()[0] ?? "";
  const lastInitial = lastName?.trim()[0] ?? "";
  const initials = `${firstInitial}${lastInitial}`.trim();

  return initials || username?.slice(0, 2).toUpperCase() || "OT";
}

export function OwnerLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const venueName = user?.venue?.name ?? "OpenTab lokal";
  const [sidebarSummary, setSidebarSummary] = useState<OwnerSidebarSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSidebarSummary() {
      try {
        const summary = await getOwnerSidebarSummary();

        if (!cancelled) {
          setSidebarSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setSidebarSummary(null);
        }
      }
    }

    const refreshSidebarSummary = () => {
      void loadSidebarSummary();
    };

    loadSidebarSummary();
    window.addEventListener(OWNER_SIDEBAR_REFRESH_EVENT, refreshSidebarSummary);

    return () => {
      cancelled = true;
      window.removeEventListener(OWNER_SIDEBAR_REFRESH_EVENT, refreshSidebarSummary);
    };
  }, [user?.id]);

  const sidebarSections = useMemo(() => getOwnerSidebarSections(sidebarSummary), [sidebarSummary]);

  const handleLogout = async () => {
    await logout();
    navigate(routes.auth.login, { replace: true });
  };

  return (
    <div className="app">
      <Sidebar
        roleLabel="Vlasnik"
        profile={{
          initials: getInitials(user?.first_name, user?.last_name, user?.username),
          name: user ? `${user.first_name} ${user.last_name}` : "Owner",
          meta: `Administrator · ${venueName}`,
        }}
        sections={sidebarSections}
        onLogout={handleLogout}
      />

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
