// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { routes } from "../app/routes";
import { useAuth } from "../features/auth/AuthProvider";
import { useWaiterData } from "../features/waiter/workspace/useWaiterData";
import { WaiterDataProvider } from "../features/waiter/workspace/WaiterDataProvider";
import type { WaiterNotification } from "../entities/waiter/waiter.types";
import { Sidebar } from "./sidebar/Sidebar";
import { getWaiterSidebarSections } from "./sidebar/waiterSidebarItems";

function getInitials(firstName?: string, lastName?: string, username?: string) {
  const firstInitial = firstName?.trim()[0] ?? "";
  const lastInitial = lastName?.trim()[0] ?? "";
  const initials = `${firstInitial}${lastInitial}`.trim();

  return initials || username?.slice(0, 2).toUpperCase() || "OT";
}

function notificationTypeLabel(type: WaiterNotification["type"]) {
  return type === "PAYMENT_REQUESTED" ? "Naplata" : "Narudzbina";
}

function notificationIcon(type: WaiterNotification["type"]) {
  return type === "PAYMENT_REQUESTED" ? "$" : "!";
}

function notificationTime(notification: WaiterNotification) {
  if (!notification.createdAt) {
    return "sada";
  }

  const parsed = new Date(notification.createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return notification.createdAt;
  }

  return parsed.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });
}

function WaiterNotificationsControl() {
  const navigate = useNavigate();
  const waiter = useWaiterData();
  const [open, setOpen] = useState(false);

  const openNotification = (notification: WaiterNotification) => {
    waiter.markNotificationRead(notification.id);
    setOpen(false);

    const targetTable = waiter.getTable(notification.tableId);

    if (waiter.assignedSector && targetTable && targetTable.sectorId !== waiter.assignedSector.id) {
      return;
    }

    if (notification.type === "ORDER_CREATED") {
      navigate(routes.waiter.pendingOrders);
      return;
    }

    if (notification.tableId) {
      navigate(routes.waiter.checkout.replace(":tableId", notification.tableId));
      return;
    }

    navigate(routes.waiter.checkoutBase);
  };

  return (
    <div className="waiter-sidebar-notifications">
      <button
        type="button"
        className={`waiter-notification-bell ${open ? "open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="waiter-notification-bell-icon">!</span>
        <span>Obavestenja</span>
        {waiter.unreadNotificationsCount > 0 ? (
          <b>{waiter.unreadNotificationsCount > 99 ? "99+" : waiter.unreadNotificationsCount}</b>
        ) : null}
      </button>

      {open ? (
        <div className="waiter-notification-panel">
          <div className="waiter-notification-panel-head">
            <span>Obavestenja</span>
            <button type="button" onClick={waiter.markAllNotificationsRead}>Procitano</button>
          </div>

          {waiter.notifications.length === 0 ? (
            <div className="waiter-notification-empty">Nema novih dogadjaja.</div>
          ) : null}

          {waiter.notifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              className={`waiter-notification-item ${notification.read ? "read" : "unread"} ${notification.type === "PAYMENT_REQUESTED" ? "payment" : "order"}`}
              onClick={() => openNotification(notification)}
            >
              <span className="waiter-notification-type">{notificationIcon(notification.type)}</span>
              <span className="waiter-notification-copy">
                <strong>{notificationTypeLabel(notification.type)} - sto {notification.tableNumber}</strong>
                <small>{notification.message}</small>
              </span>
              <time>{notificationTime(notification)}</time>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WaiterLiveAlert() {
  const waiter = useWaiterData();
  const alert = waiter.activeAlert;

  if (!alert) {
    return null;
  }

  return (
    <div className={`waiter-live-alert ${alert.type === "PAYMENT_REQUESTED" ? "payment" : "order"}`} role="status">
      <div className="waiter-live-alert-icon">{notificationIcon(alert.type)}</div>
      <div className="waiter-live-alert-copy">
        <strong>{alert.type === "PAYMENT_REQUESTED" ? "Zahtev za naplatu" : "Nova narudzbina"}</strong>
        <span>Sto {alert.tableNumber} · {notificationTime(alert)}</span>
      </div>
      <button type="button" onClick={waiter.dismissActiveAlert}>x</button>
    </div>
  );
}

function WaiterLayoutShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const waiter = useWaiterData();
  const venueName = waiter.profile?.venue.name ?? "Lokal nije dostupan";
  const profileName = waiter.profile?.fullName || (user ? `${user.first_name} ${user.last_name}` : "Konobar");
  const profileMeta = waiter.activeShift
    ? waiter.assignedSector
      ? `Sektor: ${waiter.assignedSector.name} · ${venueName}`
      : `Sektor nije dodeljen · ${venueName}`
    : `Nema aktivne smene · ${venueName}`;

  const sidebarSections = useMemo(
    () => getWaiterSidebarSections(waiter.pendingOrders.length),
    [waiter.pendingOrders.length],
  );

  const handleLogout = async () => {
    await logout();
    navigate(routes.auth.login, { replace: true });
  };

  return (
    <div className="app">
      <Sidebar
        roleLabel="Konobar"
        useGlassRoleBadge
        profile={{
          initials: getInitials(user?.first_name, user?.last_name, user?.username),
          name: profileName,
          meta: profileMeta,
        }}
        sections={sidebarSections}
        notificationsSlot={<WaiterNotificationsControl />}
        onLogout={handleLogout}
      />

      <main className="app-main">
        <Outlet />
      </main>
      <WaiterLiveAlert />
    </div>
  );
}

export function WaiterLayout() {
  return (
    <WaiterDataProvider>
      <WaiterLayoutShell />
    </WaiterDataProvider>
  );
}
