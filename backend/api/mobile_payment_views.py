# Autor: Nina Kaljević ([student ID omitted]) - SSU9
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_order_views import decimal_to_float, serialize_menu_option
from .mobile_table_views import create_id, get_membership_from_mobile_session, mobile_session_or_401, resolve_session_waiter
from .models import Bills, OrderItemOptions, OrderItems, PaymentOrderItems, Payments, TableSessionGuests

PAYABLE_ITEM_STATUSES = [
    "pending_approval",
    "approved",
    "in_preparation",
    "ready",
    "served",
]
PAYABLE_ORDER_STATUSES = [
    "pending_approval",
    "approved",
    "partial",
    "in_preparation",
    "ready",
    "served",
]
PAYMENT_METHOD_MAP = {
    "online-card": "card",
    "cash-waiter": "cash",
    "card-waiter": "card",
}
PAYMENT_TYPE_MAP = {
    "all": "whole_bill",
    "equal": "equal_split",
    "items": "own_items",
}
CENT = Decimal("0.01")


def money(value):
    if value is None:
        return Decimal("0.00")

    try:
        return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def normalize_choice(value, allowed, fallback):
    normalized = str(value or "").strip()
    return normalized if normalized in allowed else fallback


def get_tip_amount(request):
    return max(Decimal("0.00"), money(request.data.get("tipAmount") or request.data.get("tip_amount") or 0))


def get_bill_items(table_session_id):
    return list(
        OrderItems.objects.select_related(
            "order",
            "menu_item",
            "menu_item__category",
        )
        .filter(
            order__table_session_id=table_session_id,
            order__status__in=PAYABLE_ORDER_STATUSES,
            status__in=PAYABLE_ITEM_STATUSES,
        )
        .order_by("created_at", "id")
    )


def get_options_by_item(order_items):
    item_ids = [item.id for item in order_items]
    options_by_item = {item.id: [] for item in order_items}

    if not item_ids:
        return options_by_item

    option_rows = (
        OrderItemOptions.objects.select_related("menu_item_option", "menu_item_option__option_group")
        .filter(order_item_id__in=item_ids)
        .order_by("id")
    )

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

    return options_by_item


def get_active_guest_count(table_session_id):
    count = TableSessionGuests.objects.filter(table_session_id=table_session_id, left_at__isnull=True).count()
    return max(1, count)


def get_or_create_bill(table_session, subtotal):
    bill = (
        Bills.objects.filter(table_session=table_session)
        .exclude(status="cancelled")
        .order_by("-created_at", "-id")
        .first()
    )
    now = timezone.now()

    if bill is None:
        bill = Bills.objects.create(
            id=create_id("bill", Bills),
            table_session=table_session,
            status="open",
            total_amount=subtotal,
            created_at=now,
            closed_at=None,
            updated_at=now,
        )
        return bill

    update_fields = []

    if bill.total_amount != subtotal and bill.status != "paid":
        bill.total_amount = subtotal
        update_fields.append("total_amount")

    if update_fields:
        bill.updated_at = now
        update_fields.append("updated_at")
        bill.save(update_fields=update_fields)

    return bill


def get_paid_base_amount(bill):
    paid = PaymentOrderItems.objects.filter(payment__bill=bill, payment__status="paid").aggregate(total=Sum("amount"))["total"]
    return money(paid)


def serialize_bill_item(order_item, options_by_item, current_membership_id):
    menu_item = order_item.menu_item
    selected_options = options_by_item.get(order_item.id, [])

    return {
        "id": order_item.id,
        "orderId": order_item.order_id,
        "menuItemId": order_item.menu_item_id,
        "name": menu_item.name,
        "description": menu_item.description or "",
        "image": menu_item.image or "",
        "category": menu_item.category.name if menu_item.category_id and menu_item.category else "",
        "qty": order_item.quantity,
        "unitPrice": decimal_to_float(order_item.unit_price),
        "totalPrice": decimal_to_float(order_item.total_price),
        "note": order_item.note or "",
        "status": order_item.status,
        "isMine": order_item.table_guest_id == current_membership_id,
        "selectedOptions": selected_options,
        "createdAt": order_item.created_at,
    }


def serialize_bill(bill, membership):
    order_items = get_bill_items(membership.table_session_id)
    options_by_item = get_options_by_item(order_items)
    subtotal = sum((money(item.total_price) for item in order_items), Decimal("0.00")).quantize(CENT)

    if bill.total_amount != subtotal and bill.status != "paid":
        bill.total_amount = subtotal
        bill.updated_at = timezone.now()
        bill.save(update_fields=["total_amount", "updated_at"])

    paid_amount = get_paid_base_amount(bill)
    remaining_amount = max(Decimal("0.00"), money(subtotal - paid_amount))
    participant_count = get_active_guest_count(membership.table_session_id)
    equal_share_amount = money(subtotal / participant_count) if participant_count else subtotal
    own_items_total = sum((money(item.total_price) for item in order_items if item.table_guest_id == membership.id), Decimal("0.00")).quantize(CENT)
    table = membership.table_session.table
    sector = table.sector
    venue = sector.venue

    return {
        "id": bill.id,
        "status": bill.status,
        "subtotal": decimal_to_float(subtotal),
        "paidAmount": decimal_to_float(paid_amount),
        "remainingAmount": decimal_to_float(remaining_amount),
        "participantCount": participant_count,
        "equalShareAmount": decimal_to_float(equal_share_amount),
        "ownItemsTotal": decimal_to_float(own_items_total),
        "createdAt": bill.created_at,
        "updatedAt": bill.updated_at,
        "tableSession": {
            "id": membership.table_session_id,
            "status": membership.table_session.status,
        },
        "venue": {
            "id": venue.id,
            "name": venue.name,
            "address": venue.address,
        },
        "table": {
            "id": table.id,
            "number": table.table_number,
            "label": f"Sto {table.table_number}",
            "sector": sector.name,
        },
        "items": [serialize_bill_item(item, options_by_item, membership.id) for item in order_items],
    }


def serialize_payment(payment):
    return {
        "id": payment.id,
        "billId": payment.bill_id,
        "method": payment.method,
        "type": payment.type,
        "status": payment.status,
        "amount": decimal_to_float(payment.amount),
        "providerReference": payment.provider_reference,
        "createdAt": payment.created_at,
        "confirmedAt": payment.confirmed_at,
    }


def get_current_bill_or_response(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return None, None, error_response

    membership = get_membership_from_mobile_session(auth_session)

    if membership is None:
        return None, None, Response({"detail": "Prvo skeniraj QR kod stola."}, status=status.HTTP_400_BAD_REQUEST)

    subtotal = sum((money(item.total_price) for item in get_bill_items(membership.table_session_id)), Decimal("0.00")).quantize(CENT)
    bill = get_or_create_bill(membership.table_session, subtotal)
    return bill, membership, None


def get_base_amount_and_items(split_mode, bill, membership):
    order_items = get_bill_items(membership.table_session_id)

    if split_mode == "items":
        selected_items = [item for item in order_items if item.table_guest_id == membership.id]
        base_amount = sum((money(item.total_price) for item in selected_items), Decimal("0.00")).quantize(CENT)
        return base_amount, selected_items

    if split_mode == "equal":
        participant_count = get_active_guest_count(membership.table_session_id)
        base_amount = money(bill.total_amount / participant_count)
        return base_amount, order_items

    return money(bill.total_amount), order_items


def distribute_payment_amount(payment, order_items, base_amount):
    if not order_items or base_amount <= 0:
        return

    subtotal = sum((money(item.total_price) for item in order_items), Decimal("0.00")).quantize(CENT)

    if subtotal <= 0:
        return

    remaining = base_amount

    for index, order_item in enumerate(order_items):
        if index == len(order_items) - 1:
            item_amount = remaining
        else:
            ratio = money(order_item.total_price) / subtotal
            item_amount = money(base_amount * ratio)
            remaining = money(remaining - item_amount)

        if item_amount <= 0:
            continue

        PaymentOrderItems.objects.create(
            id=create_id("poi", PaymentOrderItems),
            payment=payment,
            order_item=order_item,
            amount=item_amount,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )


def update_bill_and_table_after_payment(bill, table_session, base_amount, is_paid):
    now = timezone.now()

    if is_paid:
        paid_amount = money(get_paid_base_amount(bill) + base_amount)
        bill.status = "paid" if paid_amount + CENT >= money(bill.total_amount) else "partially_paid"
        bill.updated_at = now

        if bill.status == "paid":
            bill.closed_at = now

        bill.save(update_fields=["status", "closed_at", "updated_at"])

        if bill.status == "paid":
            table_session.status = "closed"
            table_session.closed_at = now
            table_session.updated_at = now
            table_session.save(update_fields=["status", "closed_at", "updated_at"])

            table = table_session.table
            if table.status != "inactive":
                table.status = "free"
                table.save(update_fields=["status"])

        return

    if table_session.status != "waiting_payment":
        table_session.status = "waiting_payment"
        table_session.updated_at = now
        table_session.save(update_fields=["status", "updated_at"])

    table = table_session.table
    if table.status != "inactive":
        table.status = "waiting_payment"
        table.save(update_fields=["status"])


@api_view(["GET"])
def mobile_payment_bill(request):
    bill, membership, error_response = get_current_bill_or_response(request)

    if error_response:
        return error_response

    return Response({"bill": serialize_bill(bill, membership)})


@api_view(["POST"])
def mobile_payment_create(request):
    bill, membership, error_response = get_current_bill_or_response(request)

    if error_response:
        return error_response

    payment_method_key = normalize_choice(request.data.get("method") or request.data.get("paymentMethod"), PAYMENT_METHOD_MAP, "online-card")
    split_mode = normalize_choice(request.data.get("splitMode") or request.data.get("split_mode"), PAYMENT_TYPE_MAP, "all")
    payment_method = PAYMENT_METHOD_MAP[payment_method_key]
    payment_type = PAYMENT_TYPE_MAP[split_mode]
    tip_amount = get_tip_amount(request)
    base_amount, order_items = get_base_amount_and_items(split_mode, bill, membership)

    if not order_items or base_amount <= 0:
        return Response({"detail": "Nema stavki za plaćanje."}, status=status.HTTP_400_BAD_REQUEST)

    total_amount = money(base_amount + tip_amount)
    now = timezone.now()
    is_online_payment = payment_method_key == "online-card"

    with transaction.atomic():
        payment = Payments.objects.create(
            id=create_id("pay", Payments),
            bill=bill,
            reservation=None,
            table_guest_id=membership.id,
            waiter=resolve_session_waiter(membership.table_session),
            method=payment_method,
            type=payment_type,
            status="paid" if is_online_payment else "pending",
            amount=total_amount,
            provider_reference=f"mobile:{payment_method_key};split={split_mode};tip={tip_amount}",
            created_at=now,
            confirmed_at=now if is_online_payment else None,
            updated_at=now,
        )

        distribute_payment_amount(payment, order_items, base_amount)
        update_bill_and_table_after_payment(bill, membership.table_session, base_amount, is_online_payment)

    payment = Payments.objects.get(id=payment.id)
    bill = Bills.objects.get(id=bill.id)

    return Response(
        {
            "ok": True,
            "payment": serialize_payment(payment),
            "bill": serialize_bill(bill, membership),
            "message": "Plaćanje je evidentirano." if is_online_payment else "Zahtev je poslat konobaru.",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
def mobile_payment_detail(request, payment_id):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    membership = get_membership_from_mobile_session(auth_session)

    if membership is None:
        return Response({"detail": "Nema aktivne sesije stola."}, status=status.HTTP_404_NOT_FOUND)

    payment = Payments.objects.filter(id=payment_id, table_guest_id=membership.id).first()

    if payment is None:
        return Response({"detail": "Plaćanje nije pronađeno."}, status=status.HTTP_404_NOT_FOUND)

    return Response({"payment": serialize_payment(payment)})
