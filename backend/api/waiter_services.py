# Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU20)
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.db import connection, transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from .models import (
    Bills,
    MenuCategories,
    MenuItems,
    OrderItemOptions,
    OrderItems,
    Orders,
    PaymentOrderItems,
    Payments,
    TableAssignments,
    TableSessionGuests,
    TableSessions,
    VenueSectors,
    VenueTables,
    WaiterShifts,
)
from .reservation_services import (
    get_imminent_reservations_by_table,
    get_reservation_guest_name,
    sync_due_reservations,
)
from .serializers import MenuCategorySerializer, MenuItemSerializer
from .waiter_serializers import (
    get_paid_item_ids,
    local_time_label,
    money,
    serialize_unknown_guest,
    serialize_waiter_guest,
    serialize_waiter_profile,
    serialize_waiter_sector,
    serialize_waiter_shift,
)
from .views import (
    ANALYTICS_ITEM_EXCLUDED_STATUSES,
    ANALYTICS_ORDER_EXCLUDED_STATUSES,
    get_staff_details_payload,
)


ACTIVE_SESSION_STATUSES = {"active", "waiting_payment"}
PENDING_ORDER_STATUSES = {"pending_approval"}
ACTIVE_ORDER_STATUSES = {"approved", "partial", "in_preparation", "ready", "served"}
PROCESSED_PENDING_ORDER_STATUSES = {"approved", "rejected", "partial"}
ARCHIVE_ORDER_STATUSES = {"in_preparation", "approved", "partial", "rejected", "expired", "completed", "ready", "served"}
PENDING_ORDER_EXPIRY_MINUTES = 15
MANUAL_ORDER_NO_SCOPE_MESSAGE = "Nemaš aktivnu smenu ili dodeljen sektor za ručni unos."
MANUAL_ORDER_FOREIGN_TABLE_MESSAGE = "Ručni unos je dozvoljen samo za stolove iz tvog trenutnog sektora."
APPROVED_ORDER_STATUS = "in_preparation"
PARTIAL_ORDER_STATUS = "partial"
REJECTED_ORDER_STATUS = "rejected"
APPROVED_ITEM_STATUS = "in_preparation"
REJECTED_ITEM_STATUS = "rejected"
EXPIRED_ORDER_STATUS = "expired"
_EXPIRED_STATUS_ENUM_SUPPORTED = None
_ACTIVE_SHIFT_UNSET = object()


def _enum_column_contains_value(table_name, column_name, value):
    with connection.cursor() as cursor:
        cursor.execute(f"SHOW COLUMNS FROM `{table_name}` LIKE %s", [column_name])
        row = cursor.fetchone()

    if not row:
        return False

    column_type = str(row[1]).lower()
    return f"'{value.lower()}'" in column_type


def db_supports_expired_order_status():
    global _EXPIRED_STATUS_ENUM_SUPPORTED

    if _EXPIRED_STATUS_ENUM_SUPPORTED is None:
        _EXPIRED_STATUS_ENUM_SUPPORTED = (
            _enum_column_contains_value("orders", "status", EXPIRED_ORDER_STATUS)
            and _enum_column_contains_value("order_items", "status", EXPIRED_ORDER_STATUS)
        )

    return _EXPIRED_STATUS_ENUM_SUPPORTED


def get_active_sessions_queryset(venue):
    return TableSessions.objects.select_related("table", "table__sector", "current_waiter").filter(
        table__sector__venue=venue,
        status__in=ACTIVE_SESSION_STATUSES,
    )


# SSU20 - Autor: Boško Trifunović ([student ID omitted]), servisni delovi mape konobara
def get_waiter_sessions(venue, waiter):
    active_shift = get_active_waiter_shift(venue, waiter)
    active_sector_id = (
        active_shift.sector_id
        if active_shift and active_shift.sector_id and active_shift.sector and active_shift.sector.venue_id == venue.id
        else None
    )

    if not active_sector_id:
        return {}

    sessions = list(get_active_sessions_queryset(venue).filter(table__sector_id=active_sector_id))

    return {session.table_id: session for session in sessions}


def get_active_waiter_shift(venue, waiter):
    now = timezone.now()

    return (
        WaiterShifts.objects.select_related("sector", "venue")
        .filter(
            waiter=waiter,
            venue=venue,
            status="confirmed",
            shift_start__lte=now,
        )
        .filter(Q(shift_end__isnull=True) | Q(shift_end__gte=now))
        .filter(Q(sector__isnull=True) | Q(sector__venue=venue))
        .order_by("-shift_start")
        .first()
    )


def get_active_waiter_shift_for_update(venue, waiter):
    now = timezone.now()

    return (
        WaiterShifts.objects.select_for_update()
        .select_related("sector", "venue")
        .filter(
            waiter=waiter,
            venue=venue,
            status="confirmed",
            shift_start__lte=now,
        )
        .filter(Q(shift_end__isnull=True) | Q(shift_end__gte=now))
        .filter(Q(sector__isnull=True) | Q(sector__venue=venue))
        .order_by("-shift_start")
        .first()
    )


def waiter_can_create_manual_order(waiter, venue, table, active_shift=_ACTIVE_SHIFT_UNSET):
    shift = get_active_waiter_shift(venue, waiter) if active_shift is _ACTIVE_SHIFT_UNSET else active_shift

    if (
        shift is None
        or not shift.sector_id
        or not shift.sector
        or shift.sector.venue_id != venue.id
    ):
        return False, MANUAL_ORDER_NO_SCOPE_MESSAGE

    if table.sector_id != shift.sector_id:
        return False, MANUAL_ORDER_FOREIGN_TABLE_MESSAGE

    return True, None


def get_waiter_active_charge_sector_id(venue, waiter):
    active_shift = get_active_waiter_shift(venue, waiter)

    if active_shift is None:
        return None, "Nema aktivnu smenu i ne moze da izvrsi naplatu."

    if not active_shift.sector_id:
        return None, "Nije ti dodeljen sektor za trenutnu smenu."

    if not active_shift.sector or active_shift.sector.venue_id != venue.id:
        return None, "Nije ti dodeljen sektor za trenutnu smenu."

    return active_shift.sector_id, None


def waiter_can_charge_table(waiter, venue, table):
    active_sector_id, error_message = get_waiter_active_charge_sector_id(venue, waiter)

    if error_message:
        return False, error_message

    if table.sector_id != active_sector_id:
        return False, "Mozes da naplatis samo stolove iz svog trenutnog sektora."

    return True, None


def waiter_authorization_error(message):
    return {"detail": message, "status": 403}


def waiter_not_found_error(message):
    return {"detail": message, "status": 404}


def get_waiter_active_transfer_sector_id(venue, waiter):
    active_sector_id, error_message = get_waiter_active_charge_sector_id(venue, waiter)

    if error_message == "Nema aktivnu smenu i ne moze da izvrsi naplatu.":
        return None, "Nemas aktivnu smenu i ne mozes da premestas stolove."

    return active_sector_id, error_message


def waiter_can_transfer_between_sectors(waiter, venue, source_table, target_table):
    if source_table is None or target_table is None:
        return False, None

    active_sector_id, error_message = get_waiter_active_transfer_sector_id(venue, waiter)

    if error_message:
        return False, error_message

    if source_table.sector_id == active_sector_id or target_table.sector_id == active_sector_id:
        return True, None

    return False, "Sto mozes da premestis samo iz svog sektora ili u svoj sektor."


def map_db_table_status(table, session=None, reservation=None):
    if session and session.status == "waiting_payment":
        return "payment"

    if session:
        return "occupied"

    if table.status == "waiting_payment":
        return "payment"

    if table.status in {"occupied", "waiting_order", "in_preparation"}:
        return "occupied"

    if reservation is not None:
        return "reserved"

    # Stari kod je status "reserved" trajno upisivao u venue_tables.
    # Rezervacija se sada izvodi iz konkretne rezervacije i vremena, ne iz
    # zalepljenog statusa stola.
    return "free"


def get_session_total(session):
    total = (
        OrderItems.objects.filter(order__table_session=session)
        .exclude(order__status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
        .exclude(status__in=ANALYTICS_ITEM_EXCLUDED_STATUSES)
        .aggregate(total=Sum("total_price"))["total"]
    )

    return money(total or Decimal("0"))


def get_waiter_pending_order_scope_q(venue, waiter):
    active_shift = get_active_waiter_shift(venue, waiter)

    if (
        not active_shift
        or not active_shift.sector_id
        or not active_shift.sector
        or active_shift.sector.venue_id != venue.id
    ):
        return Q(pk__isnull=True)

    return Q(table_session__table__sector_id=active_shift.sector_id)


def get_waiter_archive_shift_windows(venue, waiter):
    now = timezone.now()
    shifts = list(
        WaiterShifts.objects.filter(
            waiter=waiter,
            venue=venue,
            status="confirmed",
            sector__isnull=False,
            sector__venue=venue,
            shift_start__lte=now,
        )
        .order_by("shift_start", "id")
        .values("id", "sector_id", "shift_start", "shift_end")
    )
    windows = []

    for index, shift in enumerate(shifts):
        shift_start = shift["shift_start"]
        shift_end = shift["shift_end"] or now

        # Ako stara smena nema upisan kraj, sledeća potvrđena smena je
        # najpouzdanija dostupna granica i sprečava curenje istorije.
        if shift["shift_end"] is None and index + 1 < len(shifts):
            next_start = shifts[index + 1]["shift_start"]
            if next_start < shift_end:
                shift_end = next_start

        if shift_end < shift_start:
            continue

        windows.append(
            {
                "shift_id": shift["id"],
                "sector_id": shift["sector_id"],
                "shift_start": shift_start,
                "shift_end": shift_end,
            }
        )

    return windows


def build_waiter_archive_order_scope_q(shift_windows):
    scope = Q(pk__isnull=True)

    for window in shift_windows:
        scope |= Q(
            table_session__table__sector_id=window["sector_id"],
            created_at__gte=window["shift_start"],
            created_at__lte=window["shift_end"],
        )

    return scope


def get_waiter_archive_order_scope_q(venue, waiter):
    return build_waiter_archive_order_scope_q(get_waiter_archive_shift_windows(venue, waiter))


def get_pending_count_by_table(venue, waiter):
    rows = (
        Orders.objects.filter(
            table_session__table__sector__venue=venue,
            status__in=PENDING_ORDER_STATUSES,
        )
        .filter(get_waiter_pending_order_scope_q(venue, waiter))
        .values("table_session__table_id")
        .annotate(count=Count("id"))
    )

    return {row["table_session__table_id"]: row["count"] for row in rows}


def get_options_by_order_item(order_items):
    item_ids = [item.id for item in order_items]

    if not item_ids:
        return {}

    options_by_item = defaultdict(list)
    for option in OrderItemOptions.objects.filter(order_item_id__in=item_ids):
        options_by_item[option.order_item_id].append(option.name_snapshot)

    return dict(options_by_item)


def get_session_guests_payload(session):
    guests = list(
        TableSessionGuests.objects.filter(table_session=session, left_at__isnull=True).order_by("joined_at", "id")
    )
    guest_by_id = {guest.id: guest for guest in guests}
    items = list(
        OrderItems.objects.select_related("menu_item", "order")
        .filter(order__table_session=session)
        .exclude(order__status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
        .exclude(status__in=ANALYTICS_ITEM_EXCLUDED_STATUSES)
        .order_by("created_at", "id")
    )
    items_by_guest = defaultdict(list)

    for item in items:
        items_by_guest[item.table_guest_id or ""].append(item)

    paid_item_ids = get_paid_item_ids(items)
    options_by_item = get_options_by_order_item(items)
    result = []

    for guest in guests:
        result.append(serialize_waiter_guest(guest, items_by_guest.pop(guest.id, []), paid_item_ids, options_by_item))

    for table_guest_id, guest_items in items_by_guest.items():
        result.append(serialize_unknown_guest(table_guest_id, guest_items, paid_item_ids, options_by_item))

    return result


def get_guest_label(guests):
    active_guests = [guest for guest in guests if guest.get("items")]

    if not active_guests:
        return None

    if len(active_guests) == 1:
        return active_guests[0]["guestName"]

    return f"{len(active_guests)} gosta"


def serialize_waiter_table(table, session=None, pending_count=0, can_charge=False, reservation=None):
    guests = get_session_guests_payload(session) if session else []
    ui_status = map_db_table_status(table, session, reservation)
    reservation_label = None

    if reservation is not None and session is None:
        guest_name = get_reservation_guest_name(reservation)
        start_label = timezone.localtime(reservation.starts_at).strftime("%H:%M")
        reservation_label = f"{guest_name} · {start_label}"

    return {
        "id": table.id,
        "sectorId": table.sector_id,
        "sector": table.sector.name,
        "sectorName": table.sector.name,
        "number": table.table_number,
        "seats": table.capacity,
        "shape": table.shape,
        "status": ui_status,
        "x": money(table.position_x),
        "y": money(table.position_y),
        "width": money(table.width),
        "height": money(table.height),
        "qr_code_url": table.qr_url,
        "hasActiveOrder": bool(session),
        "guests": guests,
        "guestLabel": get_guest_label(guests),
        "reservationLabel": reservation_label,
        "reservationId": reservation.id if reservation is not None and session is None else None,
        "pendingOrders": pending_count,
        "currentBill": get_session_total(session) if session else 0,
        "paymentMode": "empty" if ui_status == "payment" and not guests else None,
        "openedAt": local_time_label(session.opened_at) if session else None,
        "active": table.active,
        "canCharge": can_charge,
    }


def get_waiter_me_payload(user, waiter, venue):
    active_shift = get_active_waiter_shift(venue, waiter)
    active_sector = active_shift.sector if active_shift and active_shift.sector_id else None

    if active_sector and active_sector.venue_id != venue.id:
        active_sector = None

    return {
        "profile": serialize_waiter_profile(user, waiter, venue),
        "activeShift": serialize_waiter_shift(active_shift) if active_shift else None,
        "sector": serialize_waiter_sector(active_sector) if active_sector else None,
        "activeTableIds": list(get_waiter_sessions(venue, waiter).keys()),
    }


def get_waiter_venue_map_payload(venue):
    sync_due_reservations(venue=venue)
    sectors = VenueSectors.objects.filter(venue=venue, active=1).order_by("display_order", "name")
    tables = VenueTables.objects.select_related("sector").filter(sector__venue=venue, active=1).order_by(
        "sector_id",
        "table_number",
    )
    sessions_by_table = {
        session.table_id: session
        for session in get_active_sessions_queryset(venue)
    }
    reservations_by_table = get_imminent_reservations_by_table(venue)

    return {
        "venue": {
            "id": venue.id,
            "name": venue.name,
            "address": venue.address,
            "description": venue.description,
            "floor": venue.floor_type,
            "active": venue.active,
        },
        "floor": venue.floor_type,
        "sectors": [serialize_waiter_sector(sector) for sector in sectors],
        "tables": [
            serialize_waiter_table(
                table,
                session=sessions_by_table.get(table.id),
                reservation=reservations_by_table.get(table.id),
            )
            for table in tables
        ],
    }


def get_waiter_tables_payload(venue, waiter):
    sync_due_reservations(venue=venue)
    sessions_by_table = get_waiter_sessions(venue, waiter)
    reservations_by_table = get_imminent_reservations_by_table(venue)
    pending_count_by_table = get_pending_count_by_table(venue, waiter)
    active_charge_sector_id, _ = get_waiter_active_charge_sector_id(venue, waiter)
    tables = VenueTables.objects.select_related("sector").filter(sector__venue=venue, active=1).order_by(
        "sector_id",
        "table_number",
    )

    return [
        serialize_waiter_table(
            table,
            sessions_by_table.get(table.id),
            pending_count_by_table.get(table.id, 0),
            can_charge=bool(active_charge_sector_id and table.sector_id == active_charge_sector_id),
            reservation=reservations_by_table.get(table.id),
        )
        for table in tables
    ]


def get_waiter_table_payload(venue, waiter, table):
    sync_due_reservations(venue=venue)
    active_charge_sector_id, _ = get_waiter_active_charge_sector_id(venue, waiter)
    reservation = get_imminent_reservations_by_table(venue).get(table.id)

    return serialize_waiter_table(
        table,
        get_waiter_sessions(venue, waiter).get(table.id),
        get_pending_count_by_table(venue, waiter).get(table.id, 0),
        can_charge=bool(active_charge_sector_id and table.sector_id == active_charge_sector_id),
        reservation=reservation,
    )


def get_waiter_menu_payload(venue):
    categories = MenuCategories.objects.filter(
        venue=venue,
        active=1,
        deleted_at__isnull=True,
    ).order_by("display_order", "name")
    items = MenuItems.objects.select_related("category").filter(
        category__venue=venue,
        category__active=1,
        category__deleted_at__isnull=True,
        active=1,
        available=1,
    ).order_by("category__display_order", "category__name", "name")

    return {
        "categories": MenuCategorySerializer(categories, many=True).data,
        "items": MenuItemSerializer(items, many=True).data,
    }


def get_order_elapsed_seconds(order):
    created_at = order.created_at
    if timezone.is_naive(created_at):
        created_at = timezone.make_aware(created_at, timezone.get_current_timezone())

    return max(0, int((timezone.now() - created_at).total_seconds()))


def map_waiter_order_status(order_status):
    if order_status == "pending_approval":
        return "pending"

    if order_status in {"in_preparation", "approved", "ready", "served"}:
        return "approved"

    if order_status == "completed":
        return "completed"

    if order_status == "expired":
        return "expired"

    if order_status == "partial":
        return "partial"

    if order_status == "rejected":
        return "rejected"

    return "approved"


def get_order_processed_timestamp(order):
    return order.approved_at or order.updated_at or order.created_at


def serialize_waiter_order(order, items_by_order, options_by_item, status=None):
    table = order.table_session.table
    ui_status = status or map_waiter_order_status(order.status)

    return {
        "id": order.id,
        "tableId": table.id,
        "tableNumber": table.table_number,
        "sectorName": table.sector.name,
        "guestName": "Gost",
        "guestMeta": "NarudÅ¾bina gosta" if order.creation_type == "guest" else "RuÄni unos",
        "elapsedSeconds": get_order_elapsed_seconds(order),
        "createdAt": order.created_at.isoformat() if order.created_at else None,
        "processedAt": get_order_processed_timestamp(order).isoformat() if get_order_processed_timestamp(order) else None,
        "status": ui_status,
        "items": [
            {
                "id": item.id,
                "name": item.menu_item.name,
                "quantity": item.quantity,
                "price": money(item.unit_price),
                "note": item.note or None,
                "options": options_by_item.get(item.id, []),
                "approved": item.status != REJECTED_ITEM_STATUS,
            }
            for item in items_by_order.get(order.id, [])
        ],
    }


def get_waiter_orders_payload(orders, status=None):
    orders = list(orders)
    order_items = (
        OrderItems.objects.select_related("menu_item", "order")
        .filter(order__in=orders)
        .order_by("created_at", "id")
    )
    items_by_order = defaultdict(list)

    for item in order_items:
        items_by_order[item.order_id].append(item)

    options_by_item = get_options_by_order_item(order_items)

    return [serialize_waiter_order(order, items_by_order, options_by_item, status=status) for order in orders]


def expire_stale_pending_orders(venue, waiter):
    if not db_supports_expired_order_status():
        return 0

    cutoff = timezone.now() - timedelta(minutes=PENDING_ORDER_EXPIRY_MINUTES)

    with transaction.atomic():
        stale_order_ids = list(
            Orders.objects.select_for_update()
            .filter(
                table_session__table__sector__venue=venue,
                status__in=PENDING_ORDER_STATUSES,
                created_at__lte=cutoff,
            )
            .filter(get_waiter_pending_order_scope_q(venue, waiter))
            .values_list("id", flat=True)
        )

        if not stale_order_ids:
            return 0

        now = timezone.now()
        Orders.objects.filter(id__in=stale_order_ids).update(status=EXPIRED_ORDER_STATUS, updated_at=now)
        OrderItems.objects.filter(order_id__in=stale_order_ids, status__in=PENDING_ORDER_STATUSES).update(
            status=EXPIRED_ORDER_STATUS,
            updated_at=now,
        )

    return len(stale_order_ids)


# SSU12 - Autor: Milica Tadić ([student ID omitted]), pending/archive narudžbine
def get_waiter_order_lists_payload(venue, waiter):
    """Return pending and archive from one consistent database snapshot.

    All relevant orders/items/options are loaded in a bounded number of queries.
    Pending is oldest-first; archive newest-first.
    """
    pending_orders = list(
        Orders.objects.select_related("table_session", "table_session__table", "table_session__table__sector")
        .filter(table_session__table__sector__venue=venue, status__in=PENDING_ORDER_STATUSES)
        .filter(get_waiter_pending_order_scope_q(venue, waiter))
    )
    archive_orders = list(
        Orders.objects.select_related("table_session", "table_session__table", "table_session__table__sector")
        .filter(table_session__table__sector__venue=venue, status__in=ARCHIVE_ORDER_STATUSES)
        .filter(get_waiter_archive_order_scope_q(venue, waiter))
    )
    orders = pending_orders + archive_orders

    serialized_by_id = {
        payload["id"]: payload
        for payload in get_waiter_orders_payload(orders)
    }
    pending_orders = sorted(
        (order for order in orders if order.status in PENDING_ORDER_STATUSES),
        key=lambda order: (order.created_at, order.id),
    )
    archive_orders = sorted(
        (order for order in orders if order.status in ARCHIVE_ORDER_STATUSES),
        key=lambda order: (get_order_processed_timestamp(order), order.created_at, order.id),
        reverse=True,
    )

    pending_payload = []
    for order in pending_orders:
        payload = dict(serialized_by_id[order.id])
        payload["status"] = "pending"
        pending_payload.append(payload)

    return {
        "pendingOrders": pending_payload,
        "archiveOrders": [serialized_by_id[order.id] for order in archive_orders],
    }


def get_waiter_pending_orders_payload(venue, waiter):
    return get_waiter_order_lists_payload(venue, waiter)["pendingOrders"]


def get_waiter_archive_orders_payload(venue, waiter):
    return get_waiter_order_lists_payload(venue, waiter)["archiveOrders"]


def _get_processable_pending_order(venue, waiter, order_id):
    return (
        Orders.objects.select_related("table_session", "table_session__table", "table_session__table__sector")
        .select_for_update()
        .filter(
            id=order_id,
            table_session__table__sector__venue=venue,
            status__in=PENDING_ORDER_STATUSES,
        )
        .filter(get_waiter_pending_order_scope_q(venue, waiter))
        .first()
    )


def _normalize_item_approvals(items, item_approvals):
    approvals = item_approvals if isinstance(item_approvals, dict) else {}
    normalized = {}

    for item in items:
        normalized[item.id] = bool(approvals.get(item.id, True))

    return normalized


def _resolve_processed_order_status(requested_status, normalized_approvals):
    if requested_status == "approved":
        return APPROVED_ORDER_STATUS

    if requested_status == "rejected":
        return REJECTED_ORDER_STATUS

    approved_count = sum(1 for approved in normalized_approvals.values() if approved)
    rejected_count = sum(1 for approved in normalized_approvals.values() if not approved)

    if approved_count > 0 and rejected_count > 0:
        return PARTIAL_ORDER_STATUS

    if approved_count > 0:
        return APPROVED_ORDER_STATUS

    return REJECTED_ORDER_STATUS


def process_waiter_pending_order(venue, waiter, order_id, requested_status, item_approvals=None, rejection_reason=""):
    if requested_status not in PROCESSED_PENDING_ORDER_STATUSES:
        return None, "NepodrÅ¾an status obrade narudÅ¾bine."

    with transaction.atomic():
        order = _get_processable_pending_order(venue, waiter, order_id)

        if order is None:
            return None, "NarudÅ¾bina nije pronaÄ‘ena ili viÅ¡e nije na Äekanju."

        items = list(OrderItems.objects.select_for_update().filter(order=order).order_by("created_at", "id"))

        if requested_status == "approved":
            normalized_approvals = {item.id: True for item in items}
        elif requested_status == "rejected":
            normalized_approvals = {item.id: False for item in items}
        else:
            normalized_approvals = _normalize_item_approvals(items, item_approvals)

        resolved_status = _resolve_processed_order_status(requested_status, normalized_approvals)
        now = timezone.now()

        rejection_text = rejection_reason.strip() if resolved_status == REJECTED_ORDER_STATUS else None

        # Namerno koristimo raw SQL za write deo: ovo pogaÄ‘a taÄno istu MySQL tabelu/kolone
        # koje koristi postojeÄ‡a baza i odmah proverava rowcount. Ako backend koji radi ne
        # promeni bazu, frontend dobija greÅ¡ku i ne moÅ¾e laÅ¾no da skloni narudÅ¾binu.
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE orders
                SET status = %s,
                    approved_by_waiter_id = %s,
                    approved_at = %s,
                    updated_at = %s,
                    rejection_reason = %s
                WHERE id = %s
                  AND status = 'pending_approval'
                """,
                [resolved_status, waiter.user_id, now, now, rejection_text, order.id],
            )
            updated_orders = cursor.rowcount

        if updated_orders != 1:
            return None, (
                "NarudÅ¾bina nije promenjena u bazi. Backend nije naÅ¡ao pending red za taj ID "
                "ili server nije restartovan na najnovijem kodu."
            )

        approved_item_ids = [item_id for item_id, approved in normalized_approvals.items() if approved]
        rejected_item_ids = [item_id for item_id, approved in normalized_approvals.items() if not approved]

        def update_item_statuses(item_ids, next_status):
            if not item_ids:
                return 0

            placeholders = ", ".join(["%s"] * len(item_ids))
            params = [next_status, now, order.id, *item_ids]

            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE order_items
                    SET status = %s,
                        updated_at = %s
                    WHERE order_id = %s
                      AND id IN ({placeholders})
                    """,
                    params,
                )
                return cursor.rowcount

        update_item_statuses(approved_item_ids, APPROVED_ITEM_STATUS)
        update_item_statuses(rejected_item_ids, REJECTED_ITEM_STATUS)

        order.refresh_from_db()

        if order.status == "pending_approval":
            return None, "Baza je i dalje vratila narudÅ¾binu kao pending posle UPDATE-a."

        order_item_statuses = dict(
            OrderItems.objects.filter(order_id=order.id).values_list("id", "status")
        )

        if any(status == "pending_approval" for status in order_item_statuses.values()):
            return None, "Baza je i dalje vratila neku stavku kao pending posle UPDATE-a."

    return {
        "id": order.id,
        "status": resolved_status,
        "approvedByWaiterId": waiter.user_id,
        "approvedAt": now.isoformat(),
        "itemStatuses": order_item_statuses,
    }, None



def _get_active_session_for_table_locked(venue, table_id):
    return (
        TableSessions.objects.select_for_update()
        .select_related("table", "table__sector", "current_waiter")
        .filter(
            table_id=table_id,
            table__sector__venue=venue,
            table__active=1,
            status__in=ACTIVE_SESSION_STATUSES,
        )
        .order_by("-opened_at", "-created_at", "id")
        .first()
    )


def _waiter_can_transfer_source_session(waiter, source_session):
    if source_session.current_waiter_id == waiter.user_id:
        return True

    return TableAssignments.objects.filter(
        table_session=source_session,
        waiter=waiter,
        assigned_to__isnull=True,
    ).exists()


def _new_waiter_id(prefix):
    return f"{prefix}_{uuid4().hex[:24]}"


def _create_waiter_session_for_table(table, waiter, now):
    session = TableSessions.objects.create(
        id=_new_waiter_id("waiter_sess"),
        table=table,
        current_waiter=waiter,
        group_id=None,
        status="active",
        opened_at=now,
        closed_at=None,
        created_at=now,
        updated_at=now,
    )
    TableAssignments.objects.create(
        id=_new_waiter_id("waiter_assign"),
        table_session=session,
        waiter=waiter,
        assigned_from=now,
        assigned_to=None,
        created_at=now,
        updated_at=now,
    )
    return session


def _get_table_for_update(venue, table_id):
    return (
        VenueTables.objects.select_for_update()
        .select_related("sector")
        .filter(id=table_id, sector__venue=venue, active=1)
        .first()
    )


def occupy_waiter_table(venue, waiter, table_id):
    table_id = str(table_id or "").strip()

    if not table_id:
        return None, "Nedostaje sto koji treba otvoriti."

    with transaction.atomic():
        table = _get_table_for_update(venue, table_id)

        if table is None:
            return None, "Sto nije pronaÄ‘en u ovom lokalu."

        existing_session = _get_active_session_for_table_locked(venue, table_id)

        if existing_session is not None:
            return None, "Sto veÄ‡ ima aktivnu sesiju i ne moÅ¾e se otvoriti duplo."

        if table.status not in {"free", "reserved"}:
            return None, "Sto mora biti slobodan ili rezervisan da bi se otvorio."

        now = timezone.now()
        session = _create_waiter_session_for_table(table, waiter, now)

        table.status = "occupied"
        table.save(update_fields=["status"])

    return {"tableId": table_id, "sessionId": session.id, "status": "occupied"}, None


def release_waiter_empty_table(venue, waiter, table_id):
    table_id = str(table_id or "").strip()

    if not table_id:
        return None, "Nedostaje sto koji treba osloboditi."

    with transaction.atomic():
        table = _get_table_for_update(venue, table_id)

        if table is None:
            return None, "Sto nije pronaÄ‘en u ovom lokalu."

        session = _get_active_session_for_table_locked(venue, table_id)

        if session is None:
            return None, "Sto nema aktivnu sesiju za oslobaÄ‘anje."

        if not _waiter_can_transfer_source_session(waiter, session):
            return None, "NemaÅ¡ dozvolu za oslobaÄ‘anje ovog stola."

        has_open_items = (
            OrderItems.objects.filter(order__table_session=session)
            .exclude(status__in={"rejected", "expired", "cancelled"})
            .exists()
        )
        has_open_orders = (
            Orders.objects.filter(table_session=session)
            .exclude(status__in={"rejected", "expired", "cancelled"})
            .exists()
        )

        if has_open_items or has_open_orders:
            return None, "Sto ima aktivne/neplaÄ‡ene narudÅ¾bine i ne moÅ¾e se osloboditi."

        now = timezone.now()
        TableSessionGuests.objects.filter(table_session=session, left_at__isnull=True).update(
            left_at=now,
            updated_at=now,
        )
        TableAssignments.objects.filter(table_session=session, assigned_to__isnull=True).update(
            assigned_to=now,
            updated_at=now,
        )
        session.status = "closed"
        session.closed_at = now
        session.updated_at = now
        session.save(update_fields=["status", "closed_at", "updated_at"])

        table.status = "free"
        table.save(update_fields=["status"])

    return {"tableId": table_id, "sessionId": session.id, "status": "free"}, None


def _get_bill_for_session_locked(session, total_amount, now):
    bill = Bills.objects.select_for_update().filter(table_session=session).order_by("-created_at", "id").first()

    if bill:
        bill.total_amount = total_amount
        bill.updated_at = now
        bill.save(update_fields=["total_amount", "updated_at"])
        return bill

    return Bills.objects.create(
        id=_new_waiter_id("waiter_bill"),
        table_session=session,
        status="open",
        total_amount=total_amount,
        created_at=now,
        closed_at=None,
        updated_at=now,
    )


def _get_bill_payable_items(session):
    return list(
        OrderItems.objects.select_for_update()
        .select_related("order")
        .filter(order__table_session=session)
        .exclude(order__status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
        .exclude(status__in=ANALYTICS_ITEM_EXCLUDED_STATUSES)
        .order_by("created_at", "id")
    )


def _get_paid_item_ids_locked(item_ids):
    if not item_ids:
        return set()

    return set(
        PaymentOrderItems.objects.select_for_update()
        .filter(order_item_id__in=item_ids, payment__status="paid")
        .values_list("order_item_id", flat=True)
    )


# SSU15 - Autor: Milica Tadić ([student ID omitted]), naplata i zatvaranje stola
def record_waiter_table_payment(venue, waiter, table_id, method="cash", mode="whole", item_ids=None):
    table_id = str(table_id or "").strip()
    method = str(method or "cash").strip()
    mode = str(mode or "whole").strip()
    requested_item_ids = set(str(item_id) for item_id in (item_ids or []) if item_id)

    if not table_id:
        return None, "Nedostaje sto za naplatu."

    if method not in {"cash", "card"}:
        return None, "Nacin placanja mora biti gotovina ili kartica."

    if mode not in {"whole", "split"}:
        return None, "Tip naplate mora biti sve zajedno ili podeljeno."

    with transaction.atomic():
        table = _get_table_for_update(venue, table_id)

        if table is None:
            return None, "Sto nije pronadjen u ovom lokalu."

        can_charge, charge_error = waiter_can_charge_table(waiter, venue, table)

        if not can_charge:
            return None, waiter_authorization_error(charge_error)

        session = _get_active_session_for_table_locked(venue, table_id)

        if session is None:
            return None, "Sto nema aktivnu sesiju za naplatu."

        items = _get_bill_payable_items(session)

        if not items:
            return None, "Sto nema stavke za naplatu."

        all_item_ids = {item.id for item in items}
        already_paid_item_ids = _get_paid_item_ids_locked(all_item_ids)
        unpaid_items = [item for item in items if item.id not in already_paid_item_ids]

        if not unpaid_items:
            return None, "Sve stavke su vec placene. Sto moze da se zatvori."

        if mode == "split":
            if not requested_item_ids:
                return None, "Izaberite stavke za podeljenu naplatu."

            if requested_item_ids - all_item_ids:
                return None, "Neke izabrane stavke ne pripadaju ovom stolu."

            payment_items = [item for item in unpaid_items if item.id in requested_item_ids]
            payment_type = "own_items"
        else:
            payment_items = unpaid_items
            payment_type = "whole_bill"

        if not payment_items:
            return None, "Izabrane stavke su vec placene."

        total_amount = sum((item.total_price or Decimal("0")) for item in items)
        payment_amount = sum((item.total_price or Decimal("0")) for item in payment_items)
        now = timezone.now()
        bill = _get_bill_for_session_locked(session, total_amount, now)

        payment = Payments.objects.create(
            id=_new_waiter_id("waiter_pay"),
            bill=bill,
            reservation=None,
            table_guest_id=None,
            waiter=waiter,
            method=method,
            type=payment_type,
            status="paid",
            amount=payment_amount,
            provider_reference=None,
            created_at=now,
            confirmed_at=now,
            updated_at=now,
        )

        PaymentOrderItems.objects.bulk_create(
            [
                PaymentOrderItems(
                    id=_new_waiter_id("waiter_poi"),
                    payment=payment,
                    order_item=item,
                    amount=item.total_price or Decimal("0"),
                    created_at=now,
                    updated_at=now,
                )
                for item in payment_items
            ]
        )

        paid_item_ids = already_paid_item_ids | {item.id for item in payment_items}
        all_paid = all_item_ids.issubset(paid_item_ids)

        bill.status = "paid" if all_paid else "partially_paid"
        bill.updated_at = now
        bill.save(update_fields=["status", "updated_at"])

        session.status = "waiting_payment"
        session.updated_at = now
        session.save(update_fields=["status", "updated_at"])

        table.status = "waiting_payment"
        table.save(update_fields=["status"])

    return {
        "tableId": table_id,
        "sessionId": session.id,
        "billId": bill.id,
        "paymentId": payment.id,
        "status": "waiting_payment",
        "billStatus": bill.status,
        "paidItemIds": list(paid_item_ids),
        "allPaid": all_paid,
    }, None


# SSU14 - Autor: Milica Tadić ([student ID omitted]), ručni unos narudžbine
def create_waiter_manual_order(venue, waiter, table_id, cart_items):
    table_id = str(table_id or "").strip()

    if not table_id:
        return None, "Nedostaje sto za rucni unos."

    if not isinstance(cart_items, list) or not cart_items:
        return None, "Narudzbina mora imati bar jednu stavku."

    with transaction.atomic():
        active_shift = get_active_waiter_shift_for_update(venue, waiter)
        table = _get_table_for_update(venue, table_id)

        if table is None:
            return None, "Sto nije pronadjen u ovom lokalu."

        can_create, permission_error = waiter_can_create_manual_order(
            waiter,
            venue,
            table,
            active_shift=active_shift,
        )

        if not can_create:
            return None, waiter_authorization_error(permission_error)

        # Validiraj i zaključaj sve stavke pre kreiranja sesije, gosta,
        # narudžbine, assignment-a ili promene statusa stola.
        prepared_items = []
        for raw_item in cart_items:
            if not isinstance(raw_item, dict):
                return None, "Svaka stavka narudzbine mora biti objekat."

            menu_item_id = str(raw_item.get("menuItemId") or raw_item.get("menu_item_id") or "").strip()
            if not menu_item_id:
                return None, "Svaka stavka mora imati menuItemId."

            menu_item = (
                MenuItems.objects.select_for_update()
                .filter(id=menu_item_id, category__venue=venue, active=1, available=1)
                .first()
            )
            if menu_item is None:
                return None, f"Stavka menija nije pronadjena: {menu_item_id}."

            try:
                quantity = int(raw_item.get("quantity") or 1)
            except (TypeError, ValueError):
                return None, "Kolicina mora biti ceo broj veci od nule."
            if quantity <= 0:
                return None, "Kolicina mora biti veca od nule."

            try:
                unit_price = Decimal(
                    str(raw_item.get("price") if raw_item.get("price") is not None else menu_item.price)
                )
            except Exception:
                return None, "Cena stavke nije ispravna."

            options = raw_item.get("options") or []
            if not isinstance(options, list):
                return None, "Opcije stavke moraju biti lista."

            prepared_items.append(
                {
                    "menu_item": menu_item,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "total_price": unit_price * Decimal(quantity),
                    "note": raw_item.get("note") or None,
                    "options": [str(option or "").strip() for option in options if str(option or "").strip()],
                }
            )

        session = _get_active_session_for_table_locked(venue, table_id)
        now = timezone.now()

        if session is None:
            if table.status not in {"free", "reserved"}:
                return None, "Sto nema aktivnu sesiju. Osvezi mapu stolova i pokusaj ponovo."

            session = _create_waiter_session_for_table(table, waiter, now)
            table.status = "occupied"
            table.save(update_fields=["status"])

        if session.status == "waiting_payment":
            return None, "Sto ceka naplatu i ne moze primiti novu narudzbinu."

        guest = TableSessionGuests.objects.create(
            id=_new_waiter_id("waiter_guest"),
            table_session=session,
            guest_id=None,
            anonymous_token=None,
            display_name="Rucni unos",
            type="anonymous",
            joined_at=now,
            left_at=None,
            created_at=now,
            updated_at=now,
        )
        order = Orders.objects.create(
            id=_new_waiter_id("waiter_order"),
            table_session=session,
            reservation=None,
            created_by_table_guest_id=guest.id,
            created_by_waiter=waiter,
            approved_by_waiter=waiter,
            creation_type="waiter",
            status=APPROVED_ORDER_STATUS,
            note=None,
            rejection_reason=None,
            created_at=now,
            approved_at=now,
            updated_at=now,
        )
        created_items = []

        for prepared in prepared_items:
            order_item = OrderItems.objects.create(
                id=_new_waiter_id("waiter_item"),
                order=order,
                menu_item=prepared["menu_item"],
                table_guest_id=guest.id,
                quantity=prepared["quantity"],
                unit_price=prepared["unit_price"],
                total_price=prepared["total_price"],
                note=prepared["note"],
                status=APPROVED_ITEM_STATUS,
                created_at=now,
                updated_at=now,
            )
            created_items.append(order_item)

            for option_name in prepared["options"]:
                OrderItemOptions.objects.create(
                    id=_new_waiter_id("waiter_opt"),
                    order_item=order_item,
                    menu_item_option=None,
                    name_snapshot=option_name,
                    extra_price=Decimal("0"),
                )

        session.updated_at = now
        session.save(update_fields=["updated_at"])
        table.status = "occupied"
        table.save(update_fields=["status"])

    return {
        "orderId": order.id,
        "guestId": guest.id,
        "tableId": table_id,
        "itemIds": [item.id for item in created_items],
        "status": order.status,
    }, None


def close_waiter_paid_table(venue, waiter, table_id):
    table_id = str(table_id or "").strip()

    if not table_id:
        return None, "Nedostaje sto koji treba zatvoriti."

    with transaction.atomic():
        table = _get_table_for_update(venue, table_id)

        if table is None:
            return None, "Sto nije pronadjen u ovom lokalu."

        can_charge, charge_error = waiter_can_charge_table(waiter, venue, table)

        if not can_charge:
            return None, waiter_authorization_error(charge_error)

        session = _get_active_session_for_table_locked(venue, table_id)

        if session is None:
            return None, "Sto nema aktivnu sesiju za zatvaranje."

        items = _get_bill_payable_items(session)
        total_amount = sum((item.total_price or Decimal("0")) for item in items)
        now = timezone.now()

        if not items or total_amount <= Decimal("0"):
            TableSessionGuests.objects.filter(table_session=session, left_at__isnull=True).update(
                left_at=now,
                updated_at=now,
            )
            TableAssignments.objects.filter(table_session=session, assigned_to__isnull=True).update(
                assigned_to=now,
                updated_at=now,
            )

            session.status = "closed"
            session.closed_at = now
            session.updated_at = now
            session.save(update_fields=["status", "closed_at", "updated_at"])

            table.status = "free"
            table.save(update_fields=["status"])

            return {
                "tableId": table_id,
                "sessionId": session.id,
                "billId": None,
                "status": "free",
                "billStatus": None,
                "paidItemIds": [],
            }, None

        item_ids = {item.id for item in items}
        paid_item_ids = _get_paid_item_ids_locked(item_ids)
        bill = _get_bill_for_session_locked(session, total_amount, now)

        if not item_ids.issubset(paid_item_ids):
            session.status = "waiting_payment"
            session.updated_at = now
            session.save(update_fields=["status", "updated_at"])
            table.status = "waiting_payment"
            table.save(update_fields=["status"])
            bill.status = "partially_paid" if paid_item_ids else "open"
            bill.updated_at = now
            bill.save(update_fields=["status", "updated_at"])
            return None, "Racun nije placen u celosti. Sto ostaje na naplati."

        bill.status = "paid"
        bill.closed_at = now
        bill.updated_at = now
        bill.save(update_fields=["status", "closed_at", "updated_at"])

        TableSessionGuests.objects.filter(table_session=session, left_at__isnull=True).update(
            left_at=now,
            updated_at=now,
        )
        TableAssignments.objects.filter(table_session=session, assigned_to__isnull=True).update(
            assigned_to=now,
            updated_at=now,
        )

        session.status = "closed"
        session.closed_at = now
        session.updated_at = now
        session.save(update_fields=["status", "closed_at", "updated_at"])

        table.status = "free"
        table.save(update_fields=["status"])

    return {
        "tableId": table_id,
        "sessionId": session.id,
        "billId": bill.id,
        "status": "free",
        "billStatus": "paid",
        "paidItemIds": list(item_ids),
    }, None


def _source_session_is_empty(session):
    has_active_guests = TableSessionGuests.objects.filter(table_session=session, left_at__isnull=True).exists()
    has_active_items = (
        OrderItems.objects.filter(order__table_session=session)
        .exclude(status__in={"rejected", "expired", "cancelled"})
        .exists()
    )
    has_active_orders = (
        Orders.objects.filter(table_session=session)
        .exclude(status__in={"rejected", "expired", "cancelled"})
        .exists()
    )
    return not has_active_guests and not has_active_items and not has_active_orders


def _close_empty_source_session(session, source_table, now):
    TableAssignments.objects.filter(table_session=session, assigned_to__isnull=True).update(
        assigned_to=now,
        updated_at=now,
    )
    session.status = "closed"
    session.closed_at = now
    session.updated_at = now
    session.save(update_fields=["status", "closed_at", "updated_at"])
    source_table.status = "free"
    source_table.save(update_fields=["status"])


def _clone_order_for_guest_transfer(order, target_session, fallback_guest_id, now):
    created_by_table_guest_id = order.created_by_table_guest_id or fallback_guest_id
    return Orders.objects.create(
        id=_new_waiter_id("waiter_order"),
        table_session=target_session,
        reservation=order.reservation,
        created_by_table_guest_id=created_by_table_guest_id,
        created_by_waiter=order.created_by_waiter,
        approved_by_waiter=order.approved_by_waiter,
        creation_type=order.creation_type,
        status=order.status,
        note=order.note,
        rejection_reason=order.rejection_reason,
        created_at=order.created_at,
        approved_at=order.approved_at,
        updated_at=now,
    )


def _move_guest_orders_to_target(source_session, target_session, guest_ids, now):
    moved_order_count = 0
    moved_item_count = 0
    affected_orders = list(
        Orders.objects.select_for_update()
        .filter(table_session=source_session, orderitems__table_guest_id__in=guest_ids)
        .distinct()
        .order_by("created_at", "id")
    )

    for order in affected_orders:
        items = list(OrderItems.objects.select_for_update().filter(order=order).order_by("created_at", "id"))
        selected_items = [item for item in items if item.table_guest_id in guest_ids]
        remaining_items = [item for item in items if item.table_guest_id not in guest_ids]

        if not selected_items:
            continue

        if not remaining_items:
            order.table_session = target_session
            order.updated_at = now
            order.save(update_fields=["table_session", "updated_at"])
            moved_order_count += 1
            moved_item_count += len(selected_items)
            continue

        fallback_guest_id = selected_items[0].table_guest_id
        target_order = _clone_order_for_guest_transfer(order, target_session, fallback_guest_id, now)
        OrderItems.objects.filter(id__in=[item.id for item in selected_items]).update(
            order=target_order,
            updated_at=now,
        )

        if order.created_by_table_guest_id in guest_ids:
            order.created_by_table_guest_id = remaining_items[0].table_guest_id
            order.updated_at = now
            order.save(update_fields=["created_by_table_guest_id", "updated_at"])
        else:
            order.updated_at = now
            order.save(update_fields=["updated_at"])

        moved_order_count += 1
        moved_item_count += len(selected_items)

    return moved_order_count, moved_item_count


def _transfer_waiter_guest_group(venue, waiter, source_table_id, target_table_id, guest_ids):
    guest_ids = [str(guest_id or "").strip() for guest_id in guest_ids or []]
    guest_ids = [guest_id for guest_id in dict.fromkeys(guest_ids) if guest_id]

    if not guest_ids:
        return None, "Nedostaje gost za premeÅ¡tanje."

    with transaction.atomic():
        tables = {
            table.id: table
            for table in VenueTables.objects.select_for_update()
            .select_related("sector")
            .filter(id__in=[source_table_id, target_table_id], sector__venue=venue, active=1)
        }

        source_table = tables.get(source_table_id)
        target_table = tables.get(target_table_id)

        can_transfer, transfer_error = waiter_can_transfer_between_sectors(waiter, venue, source_table, target_table)

        if source_table is not None and target_table is not None and not can_transfer:
            return None, waiter_authorization_error(transfer_error)

        if source_table is None:
            return None, "Polazni sto nije pronaÄ‘en u ovom lokalu."

        if target_table is None:
            return None, "OdrediÅ¡ni sto nije pronaÄ‘en u ovom lokalu."

        if source_table.status == "waiting_payment":
            return None, "Polazni sto Äeka naplatu i nije validan za premeÅ¡tanje gostiju."

        if target_table.status not in {"free", "occupied"}:
            return None, "OdrediÅ¡ni sto nije validan za premeÅ¡tanje."

        source_session = _get_active_session_for_table_locked(venue, source_table_id)

        if source_session is None:
            return None, "Polazni sto nema aktivnu sesiju za premeÅ¡tanje."

        if source_session.status == "waiting_payment":
            return None, "Polazni sto Äeka naplatu i nije validan za premeÅ¡tanje gostiju."

        guests = list(
            TableSessionGuests.objects.select_for_update()
            .filter(id__in=guest_ids, table_session=source_session, left_at__isnull=True)
            .order_by("joined_at", "id")
        )

        if len(guests) != len(guest_ids):
            return None, "Izabrani gost nije aktivan na polaznom stolu."

        target_session = _get_active_session_for_table_locked(venue, target_table_id)
        now = timezone.now()

        if target_session and target_session.status == "waiting_payment":
            return None, "OdrediÅ¡ni sto Äeka naplatu i nije validan za premeÅ¡tanje."

        if target_session is None:
            target_session = _create_waiter_session_for_table(target_table, waiter, now)
        else:
            target_session.updated_at = now
            target_session.save(update_fields=["updated_at"])

        TableSessionGuests.objects.filter(id__in=guest_ids, table_session=source_session).update(
            table_session=target_session,
            updated_at=now,
        )
        moved_order_count, moved_item_count = _move_guest_orders_to_target(source_session, target_session, guest_ids, now)

        source_session.updated_at = now
        source_session.save(update_fields=["updated_at"])

        if _source_session_is_empty(source_session):
            _close_empty_source_session(source_session, source_table, now)
        else:
            source_table.status = "occupied"
            source_table.save(update_fields=["status"])

        if target_table.status == "free":
            target_table.status = "occupied"
            target_table.save(update_fields=["status"])

    return {
        "sourceTableId": source_table_id,
        "targetTableId": target_table_id,
        "mode": "guest",
        "tableGuestIds": guest_ids,
        "movedOrders": moved_order_count,
        "movedItems": moved_item_count,
    }, None


# SSU13 - Autor: Milica Tadić ([student ID omitted]), transfer stola/gostiju
def transfer_waiter_table(venue, waiter, source_table_id, target_table_id, mode="whole", table_guest_ids=None):
    source_table_id = str(source_table_id or "").strip()
    target_table_id = str(target_table_id or "").strip()
    mode = str(mode or "").strip() or "whole"

    if not source_table_id or not target_table_id:
        return None, "Nedostaje polazni ili odrediÅ¡ni sto."

    if source_table_id == target_table_id:
        return None, "Polazni sto ne moÅ¾e biti odrediÅ¡ni sto."

    if mode == "guest":
        return _transfer_waiter_guest_group(venue, waiter, source_table_id, target_table_id, table_guest_ids)

    if mode != "whole":
        return None, "Nepoznat tip premeÅ¡tanja."

    with transaction.atomic():
        tables = {
            table.id: table
            for table in VenueTables.objects.select_for_update()
            .select_related("sector")
            .filter(id__in=[source_table_id, target_table_id], sector__venue=venue, active=1)
        }

        source_table = tables.get(source_table_id)
        target_table = tables.get(target_table_id)

        if source_table is None:
            return None, "Polazni sto nije pronaÄ‘en u ovom lokalu."

        if target_table is None:
            return None, "OdrediÅ¡ni sto nije pronaÄ‘en u ovom lokalu."

        can_transfer, transfer_error = waiter_can_transfer_between_sectors(waiter, venue, source_table, target_table)

        if source_table is not None and target_table is not None and not can_transfer:
            return None, waiter_authorization_error(transfer_error)

        if target_table.status in {"reserved", "waiting_payment"}:
            return None, "OdrediÅ¡ni sto nije validan za premeÅ¡tanje."

        source_session = _get_active_session_for_table_locked(venue, source_table_id)

        if source_session is None:
            return None, "Polazni sto nema aktivnu sesiju za premeÅ¡tanje."

        target_session = _get_active_session_for_table_locked(venue, target_table_id)
        now = timezone.now()

        if target_session and target_session.status == "waiting_payment":
            return None, "OdrediÅ¡ni sto Äeka naplatu i nije validan za premeÅ¡tanje."

        if target_session:
            # Zauzet ciljni sto: guest grupe i narudÅ¾bine prelaze u aktivnu target sesiju.
            # Ne spajamo stavke u jedan order/raÄun; ostaju odvojene po table_guest zapisima.
            TableSessionGuests.objects.filter(table_session=source_session).update(
                table_session=target_session,
                updated_at=now,
            )
            Orders.objects.filter(table_session=source_session).update(
                table_session=target_session,
                updated_at=now,
            )
            source_session.status = "closed"
            source_session.closed_at = now
            source_session.updated_at = now
            source_session.save(update_fields=["status", "closed_at", "updated_at"])
            target_session.updated_at = now
            target_session.save(update_fields=["updated_at"])
        else:
            # Slobodan ciljni sto: celu aktivnu sesiju samo pomeramo na novi sto.
            source_session.table = target_table
            source_session.updated_at = now
            source_session.save(update_fields=["table", "updated_at"])

        source_table.status = "free"
        source_table.save(update_fields=["status"])

        if target_table.status == "free":
            target_table.status = "occupied"
            target_table.save(update_fields=["status"])

    return {"sourceTableId": source_table_id, "targetTableId": target_table_id, "mode": "whole"}, None

def get_waiter_performance_payload(venue, waiter):
    # Waiter statistika namerno koristi potpuno isti payload koji owner dobija na
    # Owner -> Detalji radnika. Endpoint nema worker_id parametar: identitet
    # radnika uvek dolazi iz autentifikovane waiter sesije.
    details = get_staff_details_payload(venue, waiter)
    performance_points = details.get("performance", [])
    revenue = sum((Decimal(str(point.get("revenue") or 0)) for point in performance_points), Decimal("0"))
    orders_count = sum(int(point.get("orders") or 0) for point in performance_points)
    tables_count = sum(int(point.get("tables") or 0) for point in performance_points)
    profile_rating = details.get("profile", {}).get("rating") or 0

    return {
        "workerId": waiter.user_id,
        "details": details,
        # Zadržano radi kompatibilnosti sa starijim waiter frontend-om. Novi
        # prikaz računa vrednosti iz details koristeći iste owner helper-e.
        "summary": {
            "revenue": money(revenue),
            "ordersCount": orders_count,
            "tablesCount": tables_count,
            "averageRating": float(profile_rating),
            "averageBill": money(revenue / tables_count) if tables_count else 0,
        },
        "points": performance_points,
        "topItems": details.get("topItems", []),
        "goals": details.get("goals", []),
    }


def get_waiter_shifts_payload(venue, waiter):
    shifts = WaiterShifts.objects.select_related("sector").filter(
        venue=venue,
        waiter=waiter,
    ).order_by("-shift_start")[:50]

    return [serialize_waiter_shift(shift) for shift in shifts]
