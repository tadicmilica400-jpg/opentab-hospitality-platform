// Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU16-20)
export const routes = {
  owner: {
    analytics: "/owner/analytics",
    menu: "/owner/menu",
    venueMap: "/owner/venue-map",
    staff: "/owner/staff",
    transactions: "/owner/transactions",
    reports: "/owner/reports",
  },
  waiter: {
    login: "/waiter/login",
    tables: "/waiter/tables",
    pendingOrders: "/waiter/orders/pending",
    manualOrderBase: "/waiter/order/new",
    manualOrder: "/waiter/tables/:tableId/order/new",
    transferBase: "/waiter/transfer",
    transferTable: "/waiter/tables/:tableId/transfer",
    checkoutBase: "/waiter/checkout",
    checkout: "/waiter/tables/:tableId/checkout",
    performance: "/waiter/performance",
    shiftHistory: "/waiter/shifts",
  },
  auth: {
    login: "/login",
  },
} as const;
