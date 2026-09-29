# Autor: Nina Kaljević ([student ID omitted]) - SSU7-8
from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_auth_views import normalize_text
from .mobile_table_views import create_id, get_membership_from_mobile_session, mobile_session_or_401, resolve_session_waiter
from .models import MenuItemOptionGroups, MenuItemOptions, MenuItems, OrderItemOptions, OrderItems, Orders

ORDER_STAGE_MAP = {
    "draft": "sent",
    "pending_approval": "sent",
    "approved": "approved",
    "partial": "preparing",
    "in_preparation": "preparing",
    "ready": "preparing",
    "served": "served",
    "rejected": "sent",
    "cancelled": "sent",
}

ACTIVE_ORDER_STATUSES = [
    "draft",
    "pending_approval",
    "approved",
    "partial",
    "in_preparation",
    "ready",
]


def decimal_to_float(value):
    if value is None:
        return 0

    return float(value)


def normalize_quantity(value):
    try:
        quantity = int(value)
    except (TypeError, ValueError):
        return 0

    return max(0, min(quantity, 99))


def get_payload_items(request):
    raw_items = request.data.get("items")

    if not isinstance(raw_items, list):
        return []

    return raw_items


def get_item_menu_id(payload):
    return normalize_text(
        payload.get("menuItemId")
        or payload.get("menu_item_id")
        or payload.get("menuItem")
        or payload.get("menu_item")
        or payload.get("id")
    )


def get_option_ids(payload):
    raw_options = payload.get("optionIds") or payload.get("option_ids") or payload.get("selectedOptions") or []

    if not isinstance(raw_options, list):
        return []

    option_ids = []

    for option in raw_options:
        if isinstance(option, dict):
            option_id = normalize_text(option.get("id"))
        else:
            option_id = normalize_text(option)

        if option_id:
            option_ids.append(option_id)

    return option_ids


def get_venue_id_from_membership(membership):
    return membership.table_session.table.sector.venue_id


def get_menu_item_or_error(menu_item_id, venue_id):
    if not menu_item_id:
        return None, "Nedostaje stavka menija."

    item = (
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

    if item is None:
        return None, "Stavka menija nije dostupna."

    return item, None


def get_options_or_error(menu_item, option_ids):
    groups = list(MenuItemOptionGroups.objects.filter(menu_item_id=menu_item.id, active=1))

    if not option_ids:
        for group in groups:
            minimum = group.min_choices or (1 if group.required else 0)
            if minimum > 0:
                return [], f"Izaberi opciju iz grupe: {group.name}."
        return [], None

    unique_option_ids = []
    seen_ids = set()

    for option_id in option_ids:
        clean_id = normalize_text(option_id)
        if not clean_id:
            continue
        if clean_id in seen_ids:
            return [], "Ista opcija je izabrana više puta."
        seen_ids.add(clean_id)
        unique_option_ids.append(clean_id)

    options = list(
        MenuItemOptions.objects.select_related("option_group")
        .filter(
            id__in=unique_option_ids,
            active=1,
            deleted_at__isnull=True,
            option_group__menu_item_id=menu_item.id,
            option_group__active=1,
        )
    )

    if len(options) != len(unique_option_ids):
        return [], "Neka od izabranih opcija nije dostupna za ovu stavku."

    order_index = {option_id: index for index, option_id in enumerate(unique_option_ids)}
    options.sort(key=lambda option: order_index.get(option.id, 9999))

    selected_count_by_group = {}

    for option in options:
        group_id = option.option_group_id
        selected_count_by_group[group_id] = selected_count_by_group.get(group_id, 0) + 1

    for group in groups:
        selected_count = selected_count_by_group.get(group.id, 0)
        minimum = group.min_choices or (1 if group.required else 0)
        maximum = group.max_choices

        if selected_count < minimum:
            return [], f"Izaberi opciju iz grupe: {group.name}."

        if maximum is not None and selected_count > maximum:
            if maximum == 1:
                return [], f"Iz grupe {group.name} možeš izabrati samo jednu opciju."
            return [], f"Iz grupe {group.name} možeš izabrati najviše {maximum} opcija."

    return options, None

def serialize_menu_option(option):
    return {
        "id": option.id,
        "label": option.name,
        "priceDelta": decimal_to_float(option.extra_price),
        "group": option.option_group.name if option.option_group_id else "",
        "required": bool(option.option_group.required) if option.option_group_id else False,
        "minChoices": option.option_group.min_choices if option.option_group_id else 0,
        "maxChoices": option.option_group.max_choices if option.option_group_id else None,
    }


def serialize_menu_item(menu_item):
    category = menu_item.category

    return {
        "id": menu_item.id,
        "cat": menu_item.category_id,
        "categoryLabel": category.name if category else "",
        "name": menu_item.name,
        "desc": menu_item.description or "",
        "composition": menu_item.composition or "",
        "price": decimal_to_float(menu_item.price),
        "image": menu_item.image or "",
        "badge": None if menu_item.available else "Nedostupno",
        "estimatedPreparationMinutes": menu_item.estimated_preparation_minutes,
        "available": bool(menu_item.available),
        "options": [],
    }


def item_status_to_mobile(status_value):
    if status_value == "rejected":
        return "rejected"

    if status_value == "served":
        return "served"

    return "preparing"


def serialize_order(order):
    order_items = list(
        OrderItems.objects.select_related("menu_item", "menu_item__category")
        .filter(order_id=order.id)
        .order_by("created_at", "id")
    )
    item_ids = [item.id for item in order_items]
    option_rows = []

    if item_ids:
        option_rows = list(
            OrderItemOptions.objects.select_related("menu_item_option", "menu_item_option__option_group")
            .filter(order_item_id__in=item_ids)
            .order_by("id")
        )

    options_by_item = {item.id: [] for item in order_items}

    for option_row in option_rows:
        if option_row.menu_item_option_id and option_row.menu_item_option:
            options_by_item.setdefault(option_row.order_item_id, []).append(serialize_menu_option(option_row.menu_item_option))
        else:
            options_by_item.setdefault(option_row.order_item_id, []).append(
                {
                    "id": option_row.id,
                    "label": option_row.name_snapshot,
                    "priceDelta": decimal_to_float(option_row.extra_price),
                }
            )

    cart_items = []
    item_statuses = []
    total = Decimal("0.00")
    eta_minutes = 0

    for order_item in order_items:
        selected_options = options_by_item.get(order_item.id, [])
        menu_item = serialize_menu_item(order_item.menu_item)
        menu_item["options"] = selected_options
        cart_item_id = f"{order_item.menu_item_id}-{order_item.id}"
        total += order_item.total_price or Decimal("0.00")
        eta_minutes = max(eta_minutes, order_item.menu_item.estimated_preparation_minutes or 0)

        cart_items.append(
            {
                "id": cart_item_id,
                "menuItem": menu_item,
                "qty": order_item.quantity,
                "selectedOptions": selected_options,
                "note": order_item.note or "",
                "unitPrice": decimal_to_float(order_item.unit_price),
                "totalPrice": decimal_to_float(order_item.total_price),
            }
        )
        item_statuses.append(
            {
                "cartItemId": cart_item_id,
                "status": item_status_to_mobile(order_item.status),
                "staffComment": order.rejection_reason if order_item.status == "rejected" and order.rejection_reason else None,
            }
        )

    return {
        "id": order.id,
        "items": cart_items,
        "total": decimal_to_float(total),
        "sentAt": order.created_at,
        "stage": ORDER_STAGE_MAP.get(order.status, "sent"),
        "status": order.status,
        "etaMinutes": eta_minutes or 12,
        "itemStatuses": item_statuses,
    }


def get_order_for_current_guest(order_id, membership):
    return (
        Orders.objects.select_related("table_session")
        .filter(
            id=order_id,
            table_session_id=membership.table_session_id,
            created_by_table_guest_id=membership.id,
        )
        .first()
    )


def get_latest_active_order(membership):
    return (
        Orders.objects.select_related("table_session")
        .filter(
            table_session_id=membership.table_session_id,
            created_by_table_guest_id=membership.id,
            status__in=ACTIVE_ORDER_STATUSES,
        )
        .order_by("-created_at")
        .first()
    )


@api_view(["POST"])
def mobile_order_create(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    membership = get_membership_from_mobile_session(auth_session)

    if membership is None:
        return Response({"detail": "Prvo skeniraj QR kod stola."}, status=status.HTTP_400_BAD_REQUEST)

    payload_items = get_payload_items(request)

    if not payload_items:
        return Response({"detail": "Korpa je prazna."}, status=status.HTTP_400_BAD_REQUEST)

    responsible_waiter = resolve_session_waiter(membership.table_session)
    venue_id = get_venue_id_from_membership(membership)
    prepared_items = []

    for payload in payload_items:
        if not isinstance(payload, dict):
            return Response({"detail": "Neispravan format stavke."}, status=status.HTTP_400_BAD_REQUEST)

        quantity = normalize_quantity(payload.get("qty") or payload.get("quantity"))

        if quantity <= 0:
            return Response({"detail": "Količina mora biti veća od nule."}, status=status.HTTP_400_BAD_REQUEST)

        menu_item, menu_item_error = get_menu_item_or_error(get_item_menu_id(payload), venue_id)

        if menu_item_error:
            return Response({"detail": menu_item_error}, status=status.HTTP_400_BAD_REQUEST)

        selected_options, selected_options_error = get_options_or_error(menu_item, get_option_ids(payload))

        if selected_options_error:
            return Response({"detail": selected_options_error}, status=status.HTTP_400_BAD_REQUEST)

        unit_price = menu_item.price + sum((option.extra_price for option in selected_options), Decimal("0.00"))
        total_price = unit_price * quantity

        prepared_items.append(
            {
                "menu_item": menu_item,
                "quantity": quantity,
                "options": selected_options,
                "unit_price": unit_price,
                "total_price": total_price,
                "note": normalize_text(payload.get("note"))[:500] or None,
            }
        )

    with transaction.atomic():
        now = timezone.now()
        order = Orders.objects.create(
            id=create_id("ord", Orders),
            table_session=membership.table_session,
            reservation=None,
            created_by_table_guest_id=membership.id,
            created_by_waiter=responsible_waiter,
            approved_by_waiter=None,
            creation_type="guest",
            status="pending_approval",
            note=normalize_text(request.data.get("note"))[:1000] or None,
            rejection_reason=None,
            created_at=now,
            approved_at=None,
            updated_at=now,
        )

        for prepared_item in prepared_items:
            order_item = OrderItems.objects.create(
                id=create_id("oi", OrderItems),
                order=order,
                menu_item=prepared_item["menu_item"],
                table_guest_id=membership.id,
                quantity=prepared_item["quantity"],
                unit_price=prepared_item["unit_price"],
                total_price=prepared_item["total_price"],
                note=prepared_item["note"],
                status="pending_approval",
                created_at=now,
                updated_at=now,
            )

            for option in prepared_item["options"]:
                OrderItemOptions.objects.create(
                    id=create_id("oio", OrderItemOptions),
                    order_item=order_item,
                    menu_item_option=option,
                    name_snapshot=option.name,
                    extra_price=option.extra_price,
                )

        table = membership.table_session.table

        if table.status in {"free", "occupied", "reserved"}:
            table.status = "waiting_order"
            table.save(update_fields=["status"])

        membership.table_session.updated_at = now
        membership.table_session.save(update_fields=["updated_at"])

    order = Orders.objects.select_related("table_session").get(id=order.id)

    return Response({"ok": True, "order": serialize_order(order)}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def mobile_order_active(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    membership = get_membership_from_mobile_session(auth_session)

    if membership is None:
        return Response({"active": False, "order": None})

    order = get_latest_active_order(membership)

    if order is None:
        return Response({"active": False, "order": None})

    return Response({"active": True, "order": serialize_order(order)})


@api_view(["GET"])
def mobile_order_detail(request, order_id):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    membership = get_membership_from_mobile_session(auth_session)

    if membership is None:
        return Response({"detail": "Nema aktivne sesije stola."}, status=status.HTTP_404_NOT_FOUND)

    order = get_order_for_current_guest(order_id, membership)

    if order is None:
        return Response({"detail": "Narudžbina nije pronađena."}, status=status.HTTP_404_NOT_FOUND)

    return Response({"order": serialize_order(order)})


@api_view(["GET"])
def mobile_order_status(request, order_id):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    membership = get_membership_from_mobile_session(auth_session)

    if membership is None:
        return Response({"detail": "Nema aktivne sesije stola."}, status=status.HTTP_404_NOT_FOUND)

    order = get_order_for_current_guest(order_id, membership)

    if order is None:
        return Response({"detail": "Narudžbina nije pronađena."}, status=status.HTTP_404_NOT_FOUND)

    return Response({"order": serialize_order(order)})
