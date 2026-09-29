// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth } from "../features/auth/RequireAuth";
import { OwnerLayout } from "../layouts/OwnerLayout";
import { WaiterLayout } from "../layouts/WaiterLayout";
import { AnalyticsDashboardPage } from "../pages/owner/AnalyticsDashboardPage";
import { MenuPage } from "../pages/owner/MenuPage";
import { StaffDetailsPage } from "../pages/owner/StaffDetailsPage";
import { StaffPage } from "../pages/owner/StaffPage";
import { VenueMapPage } from "../pages/owner/VenueMapPage";
import { WaiterCheckoutPage } from "../pages/waiter/WaiterCheckoutPage";
import { WaiterLoginPage } from "../pages/waiter/WaiterLoginPage";
import { WaiterManualOrderPage } from "../pages/waiter/WaiterManualOrderPage";
import { WaiterPendingOrdersPage } from "../pages/waiter/WaiterPendingOrdersPage";
import { WaiterPerformancePage } from "../pages/waiter/WaiterPerformancePage";
import { WaiterShiftHistoryPage } from "../pages/waiter/WaiterShiftHistoryPage";
import { WaiterTablesPage } from "../pages/waiter/WaiterTablesPage";
import { WaiterTransferTablePage } from "../pages/waiter/WaiterTransferTablePage";
import { routes } from "./routes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to={routes.auth.login} replace />,
  },
  {
    path: routes.auth.login,
    element: <WaiterLoginPage />,
  },
  {
    path: routes.waiter.login,
    element: <WaiterLoginPage />,
  },
  {
    path: "/owner",
    element: (
      <RequireAuth role="owner">
        <OwnerLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to={routes.owner.menu} replace />,
      },
      {
        path: "analytics",
        element: <AnalyticsDashboardPage />,
      },
      {
        path: "menu",
        element: <MenuPage />,
      },
      {
        path: "staff",
        element: <StaffPage />,
      },
      {
        path: "staff/:workerId",
        element: <StaffDetailsPage />,
      },
      {
        path: "venue-map",
        element: <VenueMapPage />,
      },
    ],
  },
  {
    path: "/waiter",
    element: (
      <RequireAuth role="waiter">
        <WaiterLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to={routes.waiter.tables} replace />,
      },
      {
        path: "tables",
        element: <WaiterTablesPage />,
      },
      {
        path: "orders/pending",
        element: <WaiterPendingOrdersPage />,
      },
      {
        path: "order/new",
        element: <WaiterManualOrderPage />,
      },
      {
        path: "tables/:tableId/order/new",
        element: <WaiterManualOrderPage />,
      },
      {
        path: "tables/:tableId/transfer",
        element: <WaiterTransferTablePage />,
      },
      {
        path: "transfer",
        element: <WaiterTransferTablePage />,
      },
      {
        path: "tables/:tableId/checkout",
        element: <WaiterCheckoutPage />,
      },
      {
        path: "checkout",
        element: <WaiterCheckoutPage />,
      },
      {
        path: "performance",
        element: <WaiterPerformancePage />,
      },
      {
        path: "shifts",
        element: <WaiterShiftHistoryPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to={routes.auth.login} replace />,
  },
]);
