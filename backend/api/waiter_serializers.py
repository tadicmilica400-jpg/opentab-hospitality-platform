# Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU20)
from decimal import Decimal

from django.utils import timezone

from .models import PaymentOrderItems


def money(value):
    try:
        return float(value or Decimal("0"))
    except (TypeError, ValueError):
        return 0


def local_time_label(value):
    if not value:
        return None

    local_value = timezone.localtime(value) if timezone.is_aware(value) else value
    return local_value.strftime("%H:%M")


def iso_or_none(value):
    if not value:
        return None

    return value.isoformat()


def serialize_waiter_profile(user, waiter, venue):
    return {
        "id": waiter.user_id,
        "username": user.username,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "fullName": f"{user.first_name} {user.last_name}".strip(),
        "role": user.role,
        "staffRole": waiter.staff_role,
        "status": "active" if waiter.active == 1 and user.status == "active" else "inactive",
        "venue": {
            "id": venue.id,
            "name": venue.name,
            "address": venue.address,
            "floor": venue.floor_type,
        },
    }


def serialize_waiter_sector(sector):
    return {
        "id": sector.id,
        "venue": sector.venue_id,
        "name": sector.name,
        "emoji": sector.emoji,
        "description": sector.description,
        "x": money(sector.position_x),
        "y": money(sector.position_y),
        "width": money(sector.width),
        "height": money(sector.height),
        "display_order": sector.display_order,
        "active": sector.active,
    }


def serialize_waiter_order_line(item, paid_item_ids=None, options_by_item=None):
    paid_item_ids = paid_item_ids or set()
    options_by_item = options_by_item or {}

    return {
        "id": item.id,
        "name": item.menu_item.name,
        "quantity": item.quantity,
        "price": money(item.unit_price),
        "note": item.note or None,
        "status": item.status,
        "options": options_by_item.get(item.id, []),
        "paid": item.id in paid_item_ids,
    }


def serialize_waiter_guest(guest, items, paid_item_ids=None, options_by_item=None):
    serialized_items = [
        serialize_waiter_order_line(item, paid_item_ids, options_by_item)
        for item in items
    ]
    is_paid = bool(serialized_items) and all(item["paid"] for item in serialized_items)

    return {
        "id": guest.id,
        "guestName": guest.display_name or ("Registrovani gost" if guest.guest_id else "Gost"),
        "registered": guest.type == "registered",
        "paid": is_paid,
        "paidOnline": False,
        "items": serialized_items,
    }


def serialize_unknown_guest(table_guest_id, items, paid_item_ids=None, options_by_item=None):
    serialized_items = [
        serialize_waiter_order_line(item, paid_item_ids, options_by_item)
        for item in items
    ]

    return {
        "id": table_guest_id or "guest-unknown",
        "guestName": "Gost",
        "registered": False,
        "paid": bool(serialized_items) and all(item["paid"] for item in serialized_items),
        "paidOnline": False,
        "items": serialized_items,
    }


def get_paid_item_ids(order_items):
    item_ids = [item.id for item in order_items]

    if not item_ids:
        return set()

    return set(
        PaymentOrderItems.objects.filter(order_item_id__in=item_ids)
        .values_list("order_item_id", flat=True)
        .distinct()
    )


def serialize_waiter_shift(shift):
    return {
        "id": shift.id,
        "type": shift.shift_type,
        "status": shift.status,
        "sector": shift.sector.name if shift.sector else None,
        "start": iso_or_none(shift.shift_start),
        "end": iso_or_none(shift.shift_end),
        "startLabel": local_time_label(shift.shift_start),
        "endLabel": local_time_label(shift.shift_end),
        "note": shift.note,
    }
