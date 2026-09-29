# Autor: Nina Kaljević ([student ID omitted]) - SSU10
from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
import re

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_auth_views import normalize_text
from .mobile_order_views import (
    decimal_to_float,
    get_item_menu_id,
    get_option_ids,
    get_options_or_error,
    normalize_quantity,
    serialize_order,
)
from .mobile_table_views import create_id, mobile_session_or_401
from .reservation_services import MIN_RESERVATION_LEAD_MINUTES, sync_due_reservations
from .models import (
    MenuItems,
    OrderItemOptions,
    OrderItems,
    Orders,
    Payments,
    Reservations,
    TableSessionGuests,
    TableSessions,
    VenueSectors,
    VenueTables,
    Venues,
)

RESERVATION_DURATION_HOURS = 2
DEFAULT_DEPOSIT_AMOUNT = Decimal("500.00")
MONEY_ZERO = Decimal("0.00")
CENT = Decimal("0.01")
ACTIVE_RESERVATION_STATUSES = ["pending", "confirmed"]
MONTHS_SR = {
    "jan": 1,
    "januar": 1,
    "januara": 1,
    "feb": 2,
    "februar": 2,
    "februara": 2,
    "mar": 3,
    "mart": 3,
    "marta": 3,
    "apr": 4,
    "april": 4,
    "aprila": 4,
    "maj": 5,
    "maja": 5,
    "jun": 6,
    "juna": 6,
    "jul": 7,
    "jula": 7,
    "avg": 8,
    "avgust": 8,
    "avgusta": 8,
    "sep": 9,
    "septembar": 9,
    "septembra": 9,
    "okt": 10,
    "oktobar": 10,
    "oktobra": 10,
    "nov": 11,
    "novembar": 11,
    "novembra": 11,
    "dec": 12,
    "decembar": 12,
    "decembra": 12,
}
ZONE_KEYWORDS = {
    "inside": ["unutra", "sala", "enterijer", "interior", "inside"],
    "garden": ["bašta", "basta", "garden", "terasa", "terrace", "napolje"],
    "window": ["prozor", "window", "vitrina"],
}


def money(value):
    try:
        return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)
    except Exception:
        return MONEY_ZERO


def get_active_venue(venue_id=None):
    venues = Venues.objects.filter(active=1, deleted_at__isnull=True)

    if venue_id:
        return venues.filter(id=venue_id).first()

    return venues.order_by("created_at", "id").first()


def parse_time_value(value):
    text = normalize_text(value)

    if not text:
        return None

    match = re.fullmatch(r"(\d{1,2})[:.](\d{2})", text)

    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2))

    if hour > 23 or minute > 59:
        return None

    return time(hour, minute)


def parse_date_value(data):
    raw_date = normalize_text(data.get("date") or data.get("reservationDate") or data.get("reservation_date"))
    raw_label = normalize_text(data.get("dateLabel") or data.get("date_label"))
    today = timezone.localdate()

    if raw_date:
        parsed = parse_date(raw_date)
        if parsed:
            return parsed

    if raw_label:
        parsed = parse_date(raw_label)
        if parsed:
            return parsed

        numeric = re.search(r"(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?", raw_label)

        if numeric:
            day = int(numeric.group(1))
            month = int(numeric.group(2))
            year = int(numeric.group(3)) if numeric.group(3) else today.year
            if year < 100:
                year += 2000

            try:
                candidate = datetime(year, month, day).date()
                if candidate < today and numeric.group(3) is None:
                    candidate = datetime(year + 1, month, day).date()
                return candidate
            except ValueError:
                return None

        month_match = re.search(r"(\d{1,2})\.?\s*([A-Za-zčćžšđČĆŽŠĐ]+)", raw_label)

        if month_match:
            day = int(month_match.group(1))
            month_key = month_match.group(2).lower()
            month = MONTHS_SR.get(month_key)
            if month:
                try:
                    candidate = datetime(today.year, month, day).date()
                    if candidate < today:
                        candidate = datetime(today.year + 1, month, day).date()
                    return candidate
                except ValueError:
                    return None

    return None


def get_reservation_start(data):
    starts_at_raw = normalize_text(data.get("startsAt") or data.get("starts_at"))

    if starts_at_raw:
        parsed_datetime = parse_datetime(starts_at_raw)
        if parsed_datetime:
            if timezone.is_naive(parsed_datetime):
                return timezone.make_aware(parsed_datetime, timezone.get_current_timezone())
            return parsed_datetime

    reservation_date = parse_date_value(data)
    reservation_time = parse_time_value(data.get("time"))

    if reservation_date is None or reservation_time is None:
        return None

    naive_datetime = datetime.combine(reservation_date, reservation_time)
    return timezone.make_aware(naive_datetime, timezone.get_current_timezone())


def normalize_guest_count(value):
    try:
        count = int(value)
    except (TypeError, ValueError):
        return 1

    return max(1, min(count, 30))


def sector_matches_zone(table, zone):
    zone_key = normalize_text(zone) or "none"

    if zone_key == "none":
        return True

    sector = table.sector
    source = f"{sector.id or ''} {sector.name or ''} {sector.description or ''}".lower()

    if zone_key.lower() in {str(sector.id).lower(), str(sector.name or '').lower()}:
        return True

    if zone_key not in ZONE_KEYWORDS:
        return False

    return any(keyword in source for keyword in ZONE_KEYWORDS[zone_key])


def reservation_overlap_filter(starts_at, ends_at):
    return Q(starts_at__lt=ends_at, ends_at__gt=starts_at, status__in=ACTIVE_RESERVATION_STATUSES)


def find_available_table(venue, number_of_people, zone, starts_at, ends_at):
    tables = list(
        VenueTables.objects.select_for_update()
        .select_related("sector", "sector__venue")
        .filter(
            sector__venue=venue,
            sector__active=1,
            sector__venue__active=1,
            sector__venue__deleted_at__isnull=True,
            active=1,
            capacity__gte=number_of_people,
        )
        .exclude(status="inactive")
        .order_by("capacity", "table_number", "id")
    )

    if normalize_text(zone) not in {"", "none"}:
        tables = [table for table in tables if sector_matches_zone(table, zone)]

    for table in tables:
        has_conflict = Reservations.objects.filter(
            Q(table=table) & reservation_overlap_filter(starts_at, ends_at)
        ).exists()

        if not has_conflict:
            return table

    return None


def get_zone_label(venue, zone):
    zone_key = normalize_text(zone) or "none"

    if zone_key == "none":
        return None

    sector = VenueSectors.objects.filter(venue=venue, id=zone_key, active=1).first()
    return sector.name if sector else zone_key


def build_unavailable_message(venue, number_of_people, zone, starts_at):
    local_start = timezone.localtime(starts_at)
    date_label = local_start.strftime("%d.%m.%Y.")
    time_label = local_start.strftime("%H:%M")
    zone_label = get_zone_label(venue, zone)
    zone_part = f" u zoni {zone_label}" if zone_label else ""
    return (
        f"Nema slobodnog stola za {number_of_people} gosta{zone_part} "
        f"{date_label} u {time_label}. Izaberite drugi termin ili zonu."
    )


def serialize_table(table):
    sector = table.sector
    venue = sector.venue
    return {
        "id": table.id,
        "number": table.table_number,
        "label": f"Sto {table.table_number}",
        "capacity": table.capacity,
        "sector": {
            "id": sector.id,
            "name": sector.name,
            "emoji": sector.emoji,
        },
        "venue": {
            "id": venue.id,
            "name": venue.name,
            "address": venue.address or "",
        },
    }


def serialize_payment(payment):
    if payment is None:
        return None

    return {
        "id": payment.id,
        "reservationId": payment.reservation_id,
        "method": payment.method,
        "type": payment.type,
        "status": payment.status,
        "amount": decimal_to_float(payment.amount),
        "providerReference": payment.provider_reference,
        "createdAt": payment.created_at,
        "confirmedAt": payment.confirmed_at,
    }


def get_preorder_order(reservation_id):
    return (
        Orders.objects.filter(reservation_id=reservation_id, creation_type="preorder")
        .order_by("-created_at", "-id")
        .first()
    )


def serialize_reservation(reservation, preorder_order=None, payment=None):
    table = reservation.table
    starts_at_local = timezone.localtime(reservation.starts_at)
    ends_at_local = timezone.localtime(reservation.ends_at)
    preorder_order = preorder_order if preorder_order is not None else get_preorder_order(reservation.id)

    return {
        "id": reservation.id,
        "guestId": reservation.guest_id,
        "status": reservation.status,
        "numberOfPeople": reservation.number_of_people,
        "startsAt": reservation.starts_at,
        "endsAt": reservation.ends_at,
        "date": starts_at_local.date().isoformat(),
        "dateLabel": starts_at_local.strftime("%d.%m.%Y."),
        "time": starts_at_local.strftime("%H:%M"),
        "endsAtLabel": ends_at_local.strftime("%H:%M"),
        "depositAmount": decimal_to_float(reservation.deposit_amount),
        "cancellationDeadline": reservation.cancellation_deadline,
        "createdAt": reservation.created_at,
        "updatedAt": reservation.updated_at,
        "table": serialize_table(table),
        "preorder": serialize_order(preorder_order) if preorder_order else None,
        "payment": serialize_payment(payment),
    }


def get_current_guest_id(user):
    return user.id


def get_menu_item_or_error(menu_item_id, venue_id):
    if not menu_item_id:
        return None, "Nedostaje stavka menija."

    menu_item = (
        MenuItems.objects.select_related("category")
        .filter(
            id=menu_item_id,
            active=1,
            available=1,
            category__venue_id=venue_id,
            category__active=1,
            category__deleted_at__isnull=True,
        )
        .first()
    )

    if menu_item is None:
        return None, "Stavka menija nije dostupna za izabrani lokal."

    return menu_item, None


def build_order_note(data):
    name = normalize_text(data.get("name"))
    phone = normalize_text(data.get("phone"))
    note = normalize_text(data.get("note"))
    parts = []

    if name:
        parts.append(f"Ime: {name}")
    if phone:
        parts.append(f"Telefon: {phone}")
    if note:
        parts.append(f"Napomena: {note}")

    return " | ".join(parts)


def create_reservation_table_session(reservation, user, data):
    now = timezone.now()
    table_session = TableSessions.objects.create(
        id=create_id("rts", TableSessions),
        table=reservation.table,
        current_waiter=None,
        group_id=f"reservation:{reservation.id}"[:64],
        status="closed",
        opened_at=reservation.starts_at,
        closed_at=reservation.ends_at,
        created_at=now,
        updated_at=now,
    )

    membership = TableSessionGuests.objects.create(
        id=create_id("rsg", TableSessionGuests),
        table_session=table_session,
        guest_id=user.id,
        anonymous_token=None,
        display_name=normalize_text(data.get("name"))[:128] or f"{user.first_name} {user.last_name}".strip()[:128] or user.username,
        type="registered",
        joined_at=reservation.starts_at,
        left_at=reservation.ends_at,
        created_at=now,
        updated_at=now,
    )

    return table_session, membership


def create_preorder_order(reservation, membership, payload_items, data):
    if not payload_items:
        return None, MONEY_ZERO, None

    order = Orders.objects.create(
        id=create_id("preorder", Orders),
        table_session_id=membership.table_session_id,
        reservation=reservation,
        created_by_table_guest_id=membership.id,
        created_by_waiter=None,
        approved_by_waiter=None,
        creation_type="preorder",
        status="pending_approval",
        note=build_order_note(data),
        rejection_reason=None,
        created_at=timezone.now(),
        approved_at=None,
        updated_at=timezone.now(),
    )
    total = MONEY_ZERO

    for payload in payload_items:
        if not isinstance(payload, dict):
            transaction.set_rollback(True)
            return None, MONEY_ZERO, "Neispravna preorder stavka."

        quantity = normalize_quantity(payload.get("qty") or payload.get("quantity"))

        if quantity <= 0:
            continue

        menu_item_id = get_item_menu_id(payload)
        menu_item, menu_error = get_menu_item_or_error(menu_item_id, reservation.venue_id)

        if menu_error:
            transaction.set_rollback(True)
            return None, MONEY_ZERO, menu_error

        option_ids = get_option_ids(payload)
        options, options_error = get_options_or_error(menu_item, option_ids)

        if options_error:
            transaction.set_rollback(True)
            return None, MONEY_ZERO, options_error

        unit_price = money(menu_item.price + sum((option.extra_price for option in options), MONEY_ZERO))
        item_total = money(unit_price * quantity)
        total += item_total
        order_item = OrderItems.objects.create(
            id=create_id("oi", OrderItems),
            order=order,
            menu_item=menu_item,
            table_guest_id=membership.id,
            quantity=quantity,
            unit_price=unit_price,
            total_price=item_total,
            note=normalize_text(payload.get("note")) or None,
            status="pending_approval",
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        for option in options:
            OrderItemOptions.objects.create(
                id=create_id("oio", OrderItemOptions),
                order_item=order_item,
                menu_item_option=option,
                name_snapshot=option.name,
                extra_price=money(option.extra_price),
            )

    if total <= MONEY_ZERO:
        order.delete()
        return None, MONEY_ZERO, None

    return order, total.quantize(CENT), None


def create_reservation_payment(reservation, membership, amount, has_preorder):
    if amount <= MONEY_ZERO:
        return None

    now = timezone.now()
    return Payments.objects.create(
        id=create_id("rpay", Payments),
        bill=None,
        reservation=reservation,
        table_guest_id=membership.id if membership is not None else None,
        waiter=None,
        method="card",
        type="preorder" if has_preorder else "deposit",
        status="paid",
        amount=amount,
        provider_reference=f"mobile-reservation-{reservation.id}",
        created_at=now,
        confirmed_at=now,
        updated_at=now,
    )


def get_payload_items(data):
    raw_items = data.get("items") or data.get("preorder") or []
    return raw_items if isinstance(raw_items, list) else []


@api_view(["GET"])
def mobile_reservation_defaults(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    venue = get_active_venue(normalize_text(request.query_params.get("venue_id")))

    if venue is None:
        return Response({"venue": None, "depositAmount": decimal_to_float(DEFAULT_DEPOSIT_AMOUNT), "zones": []})

    sectors = (
        VenueSectors.objects.filter(venue=venue, active=1)
        .order_by("display_order", "name", "id")
        .values("id", "name", "description")
    )
    zones = [{"key": "none", "label": "Bez preferencije", "description": "Lokal bira najbolji slobodan sto."}]
    zones.extend(
        {
            "key": str(sector["id"]),
            "label": sector["name"] or "Zona",
            "description": sector["description"] or "",
        }
        for sector in sectors
    )

    return Response(
        {
            "venue": {
                "id": venue.id,
                "name": venue.name,
                "address": venue.address or "",
            },
            "user": {
                "id": auth_session.user.id,
                "name": f"{auth_session.user.first_name or ''} {auth_session.user.last_name or ''}".strip(),
                "phone": auth_session.user.phone if not str(auth_session.user.phone or "").startswith("guest-") else "",
            },
            "depositAmount": decimal_to_float(DEFAULT_DEPOSIT_AMOUNT),
            "zones": zones,
        }
    )


@api_view(["GET", "POST"])
def mobile_reservations(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    if request.method == "GET":
        sync_due_reservations(guest_id=get_current_guest_id(auth_session.user))
        reservations = (
            Reservations.objects.select_related("venue", "table", "table__sector", "table__sector__venue")
            .filter(
                guest_id=get_current_guest_id(auth_session.user),
                status="confirmed",
                starts_at__gt=timezone.now(),
            )
            .order_by("starts_at", "created_at")[:20]
        )
        return Response({"reservations": [serialize_reservation(reservation) for reservation in reservations]})

    venue = get_active_venue(normalize_text(request.data.get("venueId") or request.data.get("venue_id")))

    if venue is None:
        return Response({"detail": "Nema aktivnog lokala za rezervaciju."}, status=status.HTTP_400_BAD_REQUEST)

    starts_at = get_reservation_start(request.data)

    if starts_at is None:
        return Response({"detail": "Datum ili vreme rezervacije nisu ispravni."}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    earliest_start = now + timedelta(minutes=MIN_RESERVATION_LEAD_MINUTES)

    if starts_at < earliest_start:
        return Response(
            {"detail": f"Rezervaciju morate napraviti najmanje {MIN_RESERVATION_LEAD_MINUTES} minuta unapred."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ends_at = starts_at + timedelta(hours=RESERVATION_DURATION_HOURS)
    number_of_people = normalize_guest_count(
        request.data.get("guests") or request.data.get("numberOfPeople") or request.data.get("number_of_people")
    )
    zone = normalize_text(request.data.get("zone")) or "none"
    payload_items = get_payload_items(request.data)

    with transaction.atomic():
        existing_reservation = (
            Reservations.objects.select_for_update()
            .filter(guest_id=get_current_guest_id(auth_session.user))
            .filter(reservation_overlap_filter(starts_at, ends_at))
            .first()
        )

        if existing_reservation is not None:
            local_start = timezone.localtime(starts_at)
            return Response(
                {
                    "detail": (
                        f"Već imate rezervaciju koja se preklapa sa terminom "
                        f"{local_start.strftime('%d.%m.%Y.')} u {local_start.strftime('%H:%M')}."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        table = find_available_table(venue, number_of_people, zone, starts_at, ends_at)

        if table is None:
            return Response(
                {"detail": build_unavailable_message(venue, number_of_people, zone, starts_at)},
                status=status.HTTP_409_CONFLICT,
            )

        reservation = Reservations.objects.create(
            id=create_id("res", Reservations),
            guest_id=get_current_guest_id(auth_session.user),
            venue=venue,
            table=table,
            number_of_people=number_of_people,
            starts_at=starts_at,
            ends_at=ends_at,
            status="confirmed",
            deposit_amount=MONEY_ZERO,
            cancellation_deadline=starts_at - timedelta(hours=2),
            confirmed_by=None,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        membership = None
        preorder_order = None
        preorder_total = MONEY_ZERO

        if payload_items:
            _, membership = create_reservation_table_session(reservation, auth_session.user, request.data)
            preorder_order, preorder_total, preorder_error = create_preorder_order(
                reservation,
                membership,
                payload_items,
                request.data,
            )

            if preorder_error:
                transaction.set_rollback(True)
                return Response({"detail": preorder_error}, status=status.HTTP_400_BAD_REQUEST)

        payment_amount = preorder_total if preorder_total > MONEY_ZERO else DEFAULT_DEPOSIT_AMOUNT
        reservation.deposit_amount = payment_amount
        reservation.updated_at = timezone.now()
        reservation.save(update_fields=["deposit_amount", "updated_at"])
        payment = create_reservation_payment(reservation, membership, payment_amount, preorder_total > MONEY_ZERO)

    reservation = Reservations.objects.select_related(
        "venue", "table", "table__sector", "table__sector__venue"
    ).get(id=reservation.id)
    local_start = timezone.localtime(reservation.starts_at)

    return Response(
        {
            "ok": True,
            "message": (
                f"{serialize_table(reservation.table)['label']} je rezervisan za "
                f"{local_start.strftime('%d.%m.%Y.')} u {local_start.strftime('%H:%M')}."
            ),
            "reservation": serialize_reservation(reservation, preorder_order, payment),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
def mobile_reservation_detail(request, reservation_id):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    reservation = (
        Reservations.objects.select_related("venue", "table", "table__sector", "table__sector__venue")
        .filter(id=reservation_id, guest_id=get_current_guest_id(auth_session.user))
        .first()
    )

    if reservation is None:
        return Response({"detail": "Rezervacija nije pronađena."}, status=status.HTTP_404_NOT_FOUND)

    payment = Payments.objects.filter(reservation=reservation).order_by("-created_at", "-id").first()
    return Response({"reservation": serialize_reservation(reservation, payment=payment)})


@api_view(["POST"])
def mobile_reservation_cancel(request, reservation_id):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    now = timezone.now()

    with transaction.atomic():
        reservation = (
            Reservations.objects.select_for_update()
            .select_related("venue", "table", "table__sector", "table__sector__venue")
            .filter(id=reservation_id, guest_id=get_current_guest_id(auth_session.user))
            .first()
        )

        if reservation is None:
            return Response({"detail": "Rezervacija nije pronađena."}, status=status.HTTP_404_NOT_FOUND)

        if reservation.status == "cancelled":
            return Response(
                {
                    "ok": True,
                    "message": "Rezervacija je već otkazana.",
                    "reservation": serialize_reservation(reservation),
                }
            )

        if reservation.status not in {"pending", "confirmed"}:
            return Response(
                {"detail": "Ova rezervacija se više ne može otkazati."},
                status=status.HTTP_409_CONFLICT,
            )

        if reservation.starts_at <= now:
            return Response(
                {"detail": "Rezervacija se ne može otkazati nakon početka termina."},
                status=status.HTTP_409_CONFLICT,
            )

        preorder_orders = Orders.objects.select_for_update().filter(reservation=reservation)
        table_session_ids = list(preorder_orders.values_list("table_session_id", flat=True))

        OrderItems.objects.filter(order__reservation=reservation).exclude(status__in=["served", "cancelled"]).update(
            status="cancelled",
            updated_at=now,
        )
        preorder_orders.exclude(status="cancelled").update(
            status="cancelled",
            rejection_reason="Otkazano od strane gosta.",
            updated_at=now,
        )

        if table_session_ids:
            TableSessionGuests.objects.filter(table_session_id__in=table_session_ids, left_at__isnull=True).update(
                left_at=now,
                updated_at=now,
            )
            TableSessions.objects.filter(id__in=table_session_ids).update(
                status="closed",
                closed_at=now,
                updated_at=now,
            )

        reservation.status = "cancelled"
        reservation.updated_at = now
        reservation.save(update_fields=["status", "updated_at"])

    return Response(
        {
            "ok": True,
            "message": "Rezervacija je uspešno otkazana.",
            "reservation": serialize_reservation(reservation),
        }
    )

