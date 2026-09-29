import type { PendingOrder } from "../../../entities/waiter/waiter.types";

export const PENDING_ORDER_EXPIRATION_SECONDS = 15 * 60;

function isValidDate(value: string | undefined): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

export function getSessionPendingTimerStartedAt(elapsedSeconds = 0, nowMs = Date.now()) {
  return new Date(nowMs - Math.max(0, elapsedSeconds) * 1000).toISOString();
}

export function getOrderStartTimestamp(order: PendingOrder) {
  return order.timerStartedAt ?? order.createdAt ?? order.timestamp;
}

export function getOrderEndTimestamp(order: PendingOrder) {
  return order.processedAt ?? order.expiredAt ?? order.closedAt ?? order.paidAt;
}

export function getOrderExpirationTimestamp(order: PendingOrder) {
  const startTimestamp = order.timerStartedAt;
  const startMs = startTimestamp ? Date.parse(startTimestamp) : Number.NaN;

  if (!Number.isFinite(startMs)) {
    return undefined;
  }

  return new Date(startMs + PENDING_ORDER_EXPIRATION_SECONDS * 1000).toISOString();
}

export function isPendingOrderExpired(order: PendingOrder, nowMs = Date.now()) {
  return order.status === "pending" && getOrderElapsedSeconds(order, nowMs) >= PENDING_ORDER_EXPIRATION_SECONDS;
}

export function getOrderElapsedSeconds(order: PendingOrder, nowMs = Date.now()) {
  if (order.status !== "pending") {
    return Math.max(0, order.elapsedSeconds);
  }

  const startTimestamp = order.timerStartedAt;
  const startMs = startTimestamp ? Date.parse(startTimestamp) : Number.NaN;

  if (!Number.isFinite(startMs)) {
    return Math.max(0, order.elapsedSeconds);
  }

  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

export function formatOrderDateTime(timestamp: string | undefined) {
  if (!isValidDate(timestamp)) {
    return "—";
  }

  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
