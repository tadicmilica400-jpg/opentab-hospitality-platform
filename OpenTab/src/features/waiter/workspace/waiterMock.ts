import type { MenuOrderItem, PendingOrder, TableActiveOrder } from "../../../entities/order/order.types";
import type { CheckoutLine } from "../../../entities/payment/payment.types";
import type { VenueSector, VenueTable } from "../../../entities/venue-map/venueMap.types";
import type { TableGuest, WaiterSession, WaiterTable } from "../../../entities/waiter/waiter.types";

const now = "2026-04-15T10:00:00.000Z";

function makeMockGuests(tableId: string, count: number): TableGuest[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${tableId}-guest-${index + 1}`,
    guestName: `Gost ${index + 1}`,
    registered: false,
    paid: false,
    items: [],
  }));
}

export const waiterSession: WaiterSession = {
  id: "w-01",
  username: "marko",
  fullName: "Marko Todorović",
  shiftLabel: "Na smeni · Kafana Central",
  status: "active",
  activeTableIds: ["t-07", "t-18", "t-21"],
};

export const waiterTables: WaiterTable[] = [
  { id: "t-01", number: "1", sector: "Terasa", status: "free", seats: 4, guests: makeMockGuests("t-01", 0), currentBill: 0, pendingOrders: 0 },
  { id: "t-03", number: "3", sector: "Terasa", status: "free", seats: 4, guests: makeMockGuests("t-03", 0), currentBill: 0, pendingOrders: 0 },
  { id: "t-05", number: "5", sector: "Terasa", status: "occupied", seats: 4, guests: makeMockGuests("t-05", 2), openedAt: "20:15", currentBill: 1040, pendingOrders: 0 },
  { id: "t-07", number: "7", sector: "Glavna sala", status: "occupied", seats: 4, guests: makeMockGuests("t-07", 4), openedAt: "19:05", currentBill: 5240, pendingOrders: 1 },
  { id: "t-12", number: "12", sector: "Terasa", status: "occupied", seats: 4, guests: makeMockGuests("t-12", 3), openedAt: "19:40", currentBill: 3040, pendingOrders: 1 },
  { id: "t-14", number: "14", sector: "Glavna sala", status: "occupied", seats: 6, guests: makeMockGuests("t-14", 5), openedAt: "18:50", currentBill: 3970, pendingOrders: 0 },
  { id: "t-15", number: "15", sector: "Glavna sala", status: "free", seats: 6, guests: makeMockGuests("t-15", 0), currentBill: 0, pendingOrders: 0 },
  { id: "t-17", number: "17", sector: "Glavna sala", status: "payment", seats: 4, guests: makeMockGuests("t-17", 3), openedAt: "18:35", currentBill: 4280, pendingOrders: 0 },
  { id: "t-18", number: "18", sector: "Terasa", status: "occupied", seats: 6, guests: makeMockGuests("t-18", 4), openedAt: "19:18", currentBill: 3510, pendingOrders: 1 },
  { id: "t-20", number: "20", sector: "Glavna sala", status: "free", seats: 4, guests: makeMockGuests("t-20", 0), currentBill: 0, pendingOrders: 0 },
  { id: "t-21", number: "21", sector: "Glavna sala", status: "payment", seats: 4, guests: makeMockGuests("t-21", 2), openedAt: "18:20", currentBill: 4460, pendingOrders: 0 },
  { id: "t-22", number: "22", sector: "Glavna sala", status: "reserved", seats: 2, guests: makeMockGuests("t-22", 0), currentBill: 0, pendingOrders: 0 },
  { id: "t-23", number: "23", sector: "Glavna sala", status: "free", seats: 4, guests: makeMockGuests("t-23", 0), currentBill: 0, pendingOrders: 0 },] as unknown as WaiterTable[];

export const waiterVenueSectors: VenueSector[] = [
  {
    id: "sector-main",
    name: "Glavna sala",
    emoji: "🏠",
    x: 34,
    y: 38,
    width: 760,
    height: 310,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "sector-terrace",
    name: "Terasa",
    emoji: "🌿",
    x: 832,
    y: 38,
    width: 500,
    height: 310,
    createdAt: now,
    updatedAt: now,
  },
];

export const waiterVenueTables: VenueTable[] = [
  { id: "t-07", sectorId: "sector-main", number: "7", seats: 4, shape: "round", x: 28, y: 78, qrCodeUrl: "/qr/t-07", hasActiveOrder: true, createdAt: now, updatedAt: now },
  { id: "t-14", sectorId: "sector-main", number: "14", seats: 6, shape: "square", x: 158, y: 76, qrCodeUrl: "/qr/t-14", hasActiveOrder: true, createdAt: now, updatedAt: now },
  { id: "t-15", sectorId: "sector-main", number: "15", seats: 6, shape: "rectangle", x: 292, y: 78, qrCodeUrl: "/qr/t-15", hasActiveOrder: false, createdAt: now, updatedAt: now },
  { id: "t-17", sectorId: "sector-main", number: "17", seats: 4, shape: "square", x: 444, y: 76, qrCodeUrl: "/qr/t-17", hasActiveOrder: true, createdAt: now, updatedAt: now },
  { id: "t-21", sectorId: "sector-main", number: "21", seats: 4, shape: "round", x: 576, y: 78, qrCodeUrl: "/qr/t-21", hasActiveOrder: true, createdAt: now, updatedAt: now },
  { id: "t-22", sectorId: "sector-main", number: "22", seats: 2, shape: "square", x: 690, y: 86, qrCodeUrl: "/qr/t-22", hasActiveOrder: false, createdAt: now, updatedAt: now },
  { id: "t-23", sectorId: "sector-main", number: "23", seats: 4, shape: "round", x: 820, y: 78, qrCodeUrl: "/qr/t-23", hasActiveOrder: false, createdAt: now, updatedAt: now },
  { id: "t-01", sectorId: "sector-terrace", number: "1", seats: 4, shape: "round", x: 36, y: 82, qrCodeUrl: "/qr/t-01", hasActiveOrder: false, createdAt: now, updatedAt: now },
  { id: "t-03", sectorId: "sector-terrace", number: "3", seats: 4, shape: "rectangle", x: 176, y: 80, qrCodeUrl: "/qr/t-03", hasActiveOrder: false, createdAt: now, updatedAt: now },
  { id: "t-05", sectorId: "sector-terrace", number: "5", seats: 4, shape: "round", x: 338, y: 82, qrCodeUrl: "/qr/t-05", hasActiveOrder: true, createdAt: now, updatedAt: now },
  { id: "t-12", sectorId: "sector-terrace", number: "12", seats: 4, shape: "square", x: 60, y: 188, qrCodeUrl: "/qr/t-12", hasActiveOrder: true, createdAt: now, updatedAt: now },
  { id: "t-18", sectorId: "sector-terrace", number: "18", seats: 6, shape: "rectangle", x: 220, y: 188, qrCodeUrl: "/qr/t-18", hasActiveOrder: true, createdAt: now, updatedAt: now },
];

export const pendingOrders: PendingOrder[] = [
  {
    id: "po-101",
    tableId: "t-18",
    tableNumber: "18",
    source: "qr",
    status: "pending",
    receivedAt: "pre 42 sek",
    items: [
      { id: "i-1", name: "Jagnjeća čorba", quantity: 2, price: 550, note: "Bez luka, dobro začinjena", approved: true },
      { id: "i-2", name: "Teleća džigerica na žaru", quantity: 1, price: 1450, note: "Medium rare · molim bez alergenskog umaka", approved: true },
      { id: "i-3", name: "Domaća limonada", quantity: 3, price: 320, note: "Bez šećera", approved: true },
    ],
  },
  {
    id: "po-102",
    tableId: "t-12",
    tableNumber: "12",
    source: "qr",
    status: "pending",
    receivedAt: "pre 2 min",
    items: [
      { id: "i-4", name: "Teleća čorba", quantity: 1, price: 520, note: "Bistra, sa domaćim rezancima", approved: true },
      { id: "i-5", name: "Punjena pljeskavica", quantity: 1, price: 1120, note: "Bez luka", approved: true },
    ],
  },
  {
    id: "po-103",
    tableId: "t-07",
    tableNumber: "7",
    source: "qr",
    status: "partial",
    receivedAt: "pre 4 min",
    guestNote: "Ako nema maline, može limunada.",
    items: [
      { id: "i-6", name: "Cheesecake malina", quantity: 2, price: 490, note: "Nema maline", approved: false },
      { id: "i-7", name: "Espresso", quantity: 2, price: 220, note: "Kratki", approved: true },
    ],
  },
];

export const waiterMenuItems: MenuOrderItem[] = [
  { id: "m-1", name: "Meze tanjir", category: "food", quantity: 1, price: 850, note: "Kajmak, urnebes, ajvar, pečenica" },
  { id: "m-2", name: "Kajmak sa lepinjom", category: "food", quantity: 1, price: 490, note: "Domaći kajmak, sveža lepinja" },
  { id: "m-3", name: "Domaće meze", category: "food", quantity: 1, price: 620, note: "Sremska kobasica, sir, maslina" },
  { id: "m-4", name: "Pečena paprika sa sirom", category: "food", quantity: 1, price: 520, note: "Pečena, ohlađena, maslinovo ulje" },
  { id: "m-5", name: "Jagnjeća čorba", category: "food", quantity: 1, price: 550, note: "Domaća, aromatična, sa povrćem" },
  { id: "m-6", name: "Teleća čorba", category: "food", quantity: 1, price: 520, note: "Bistra, sa domaćim rezancima" },
  { id: "m-7", name: "Riblja čorba", category: "food", quantity: 1, price: 580, note: "Šaran i klen, začinjena paprika" },
  { id: "m-8", name: "Roštiljski mix", category: "food", quantity: 1, price: 1950, note: "Ćevapi, pljeskavica, kobasica, vrat" },
  { id: "m-9", name: "Teleća džigerica na žaru", category: "food", quantity: 1, price: 1450, note: "Sa roštilja, garniran povrćem" },
  { id: "m-10", name: "Jagnjeće rebro", category: "food", quantity: 1, price: 1750, note: "Marinirana, pečena na žaru" },
  { id: "m-11", name: "Svinjski vrat sa žara", category: "food", quantity: 1, price: 1200, note: "Mariniran, sočan, sa prilogom" },
  { id: "m-12", name: "Srpska pljeskavica", category: "food", quantity: 1, price: 980, note: "Punjena kajmakom i urnebesom" },
  { id: "m-13", name: "Domaća limonada", category: "drink", quantity: 1, price: 320, note: "Limun, nana, led" },
  { id: "m-14", name: "Domaće vino 0.5L", category: "drink", quantity: 1, price: 980, note: "Crno ili belo" },
  { id: "m-15", name: "Espresso", category: "drink", quantity: 1, price: 220, note: "Kratka kafa" },
  { id: "m-16", name: "Cheesecake malina", category: "dessert", quantity: 1, price: 490, note: "Krem sir, malina" },
];

export const checkoutLines: CheckoutLine[] = [
  { id: "c-1", name: "Roštiljski mix (mešano)", quantity: 1, price: 2500, paid: true },
  { id: "c-2", name: "Srpska salata", quantity: 2, price: 490, paid: true },
  { id: "c-3", name: "Domaće vino 0.5L", quantity: 1, price: 980, paid: true },
];

// Single source of truth for "who ordered what" on each active table. Both
// CheckoutFeature and TableTransferFeature read from this instead of each
// keeping their own hardcoded list, so the numbers and items always agree
// no matter which table you pick.
export const tableActiveOrders: Record<string, TableActiveOrder> = {
  "t-05": {
    tableId: "t-05",
    lines: [
      { id: "t05-1", guestId: "g-ana", guestName: "Ana Petrović", name: "Jagnjeća čorba", quantity: 1, price: 550, note: "Bez luka" },
      { id: "t05-2", guestId: "g-ana", guestName: "Ana Petrović", name: "Kajmak sa lepinjom", quantity: 1, price: 490, note: "Domaći kajmak" },
    ],
  },
  "t-07": {
    tableId: "t-07",
    lines: [
      { id: "t07-1", guestId: "g-nikola", guestName: "Nikola Đorđević", name: "Jagnjeća čorba", quantity: 2, price: 900, note: "Bez luka" },
      { id: "t07-2", guestId: "g-nikola", guestName: "Nikola Đorđević", name: "Domaće crno vino", quantity: 1, price: 980, note: "0.5L" },
      { id: "t07-3", guestId: "g-bez-naloga-7", guestName: "Gost (bez naloga)", name: "Teleće pečenje", quantity: 1, price: 2200, note: "Medium" },
      { id: "t07-4", guestId: "g-bez-naloga-7", guestName: "Gost (bez naloga)", name: "Mineralna voda 0.75L", quantity: 1, price: 260 },
    ],
  },
  "t-12": {
    tableId: "t-12",
    lines: [
      { id: "t12-1", guestId: "g-jovana", guestName: "Jovana Ilić", name: "Teleća čorba", quantity: 1, price: 520, note: "Bistra, sa domaćim rezancima" },
      { id: "t12-2", guestId: "g-jovana", guestName: "Jovana Ilić", name: "Punjena pljeskavica", quantity: 1, price: 1120, note: "Bez luka" },
      { id: "t12-3", guestId: "g-bez-naloga-12", guestName: "Gost (bez naloga)", name: "Domaća limonada", quantity: 3, price: 320, note: "Bez šećera" },
      { id: "t12-4", guestId: "g-bez-naloga-12", guestName: "Gost (bez naloga)", name: "Espresso", quantity: 2, price: 220, note: "Kratki" },
    ],
  },
  "t-14": {
    tableId: "t-14",
    lines: [
      { id: "t14-1", guestId: "g-milos", guestName: "Miloš Stanković", name: "Central burger", quantity: 2, price: 980 },
      { id: "t14-2", guestId: "g-milos", guestName: "Miloš Stanković", name: "Domaći krompir", quantity: 2, price: 360 },
      { id: "t14-3", guestId: "g-milos", guestName: "Miloš Stanković", name: "IPA točeno 0.5", quantity: 3, price: 430 },
    ],
  },
  "t-17": {
    tableId: "t-17",
    lines: [
      { id: "t17-1", guestId: "g-jelena", guestName: "Jelena Marković", name: "Riblja čorba", quantity: 1, price: 580 },
      { id: "t17-2", guestId: "g-jelena", guestName: "Jelena Marković", name: "Roštiljski mix", quantity: 1, price: 1950, note: "Ćevapi, pljeskavica, kobasica" },
      { id: "t17-3", guestId: "g-jelena", guestName: "Jelena Marković", name: "Jagnjeće rebro", quantity: 1, price: 1750, note: "Pečeno na žaru" },
    ],
  },
  "t-18": {
    tableId: "t-18",
    lines: [
      { id: "t18-1", guestId: "g-stefan", guestName: "Stefan Nikolić", name: "Jagnjeća čorba", quantity: 2, price: 550, note: "Dobro začinjena" },
      { id: "t18-2", guestId: "g-stefan", guestName: "Stefan Nikolić", name: "Teleća džigerica na žaru", quantity: 1, price: 1450, note: "Medium rare" },
      { id: "t18-3", guestId: "g-stefan", guestName: "Stefan Nikolić", name: "Domaća limonada", quantity: 3, price: 320, note: "Bez šećera" },
    ],
  },
  "t-21": {
    tableId: "t-21",
    lines: [
      { id: "t21-1", guestId: "g-anon-21", guestName: "Anonimni gost", name: "Roštiljski mix (mešano)", quantity: 1, price: 2500 },
      { id: "t21-2", guestId: "g-anon-21", guestName: "Anonimni gost", name: "Srpska salata", quantity: 2, price: 490 },
      { id: "t21-3", guestId: "g-anon-21", guestName: "Anonimni gost", name: "Domaće vino 0.5L", quantity: 1, price: 980 },
    ],
  },
};

export function getTableActiveOrder(tableId: string): TableActiveOrder {
  return tableActiveOrders[tableId] ?? { tableId, lines: [] };
}

export function formatRsd(value: number) {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "RSD",
    maximumFractionDigits: 0,
  }).format(value);
}
