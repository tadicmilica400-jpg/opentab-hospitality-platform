# Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU20)
from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .waiter_permissions import get_waiter_context_or_response, get_waiter_table_or_response
from .models import OrderItems, Orders, Reservations, Users
from .reservation_services import MIN_RESERVATION_LEAD_MINUTES, sync_due_reservations
from .waiter_services import (
    close_waiter_paid_table,
    get_waiter_archive_orders_payload,
    get_waiter_order_lists_payload,
    occupy_waiter_table,
    get_waiter_me_payload,
    get_waiter_menu_payload,
    get_waiter_pending_orders_payload,
    create_waiter_manual_order,
    process_waiter_pending_order,
    record_waiter_table_payment,
    release_waiter_empty_table,
    transfer_waiter_table,
    get_waiter_performance_payload,
    get_waiter_shifts_payload,
    get_waiter_table_payload,
    get_waiter_tables_payload,
    get_waiter_venue_map_payload,
)


def waiter_service_error_response(error_message, default_status=status.HTTP_400_BAD_REQUEST):
    if isinstance(error_message, dict):
        return Response(
            {"detail": error_message.get("detail", "Zahtev nije dozvoljen.")},
            status=error_message.get("status", default_status),
        )

    if isinstance(error_message, str) and "nije prona" in error_message.lower():
        return Response({"detail": error_message}, status=status.HTTP_404_NOT_FOUND)

    return Response({"detail": error_message}, status=default_status)


@api_view(["GET"])
def waiter_me(request):
    user, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response(get_waiter_me_payload(user, waiter, venue))


@api_view(["GET"])
# SSU20 - Autor: Boško Trifunović ([student ID omitted]), mapa konobara
def waiter_venue_map(request):
    _, _, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response(get_waiter_venue_map_payload(venue))


@api_view(["GET"])
def waiter_tables(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response({"tables": get_waiter_tables_payload(venue, waiter)})


@api_view(["GET"])
def waiter_table_detail(request, table_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    table, table_error = get_waiter_table_or_response(venue, table_id)

    if table_error:
        return table_error

    return Response(get_waiter_table_payload(venue, waiter, table))


@api_view(["POST"])
def waiter_occupy_table(request, table_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    result, error_message = occupy_waiter_table(venue, waiter, table_id)

    if error_message:
        return Response({"detail": error_message}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "table": result,
            "tables": get_waiter_tables_payload(venue, waiter),
            **get_waiter_order_lists_payload(venue, waiter),
        }
    )


@api_view(["POST"])
def waiter_release_table(request, table_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    result, error_message = release_waiter_empty_table(venue, waiter, table_id)

    if error_message:
        return Response({"detail": error_message}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "table": result,
            "tables": get_waiter_tables_payload(venue, waiter),
            **get_waiter_order_lists_payload(venue, waiter),
        }
    )


@api_view(["POST"])
def waiter_close_table(request, table_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    result, error_message = close_waiter_paid_table(
        venue=venue,
        waiter=waiter,
        table_id=table_id,
    )

    if error_message:
        return waiter_service_error_response(error_message)

    return Response(
        {
            "table": result,
            "tables": get_waiter_tables_payload(venue, waiter),
            **get_waiter_order_lists_payload(venue, waiter),
        }
    )


@api_view(["POST"])
# SSU15 - Autor: Milica Tadić ([student ID omitted]), naplata
def waiter_table_payment(request, table_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    result, error_message = record_waiter_table_payment(
        venue=venue,
        waiter=waiter,
        table_id=table_id,
        method=request.data.get("method", "cash"),
        mode=request.data.get("mode", "whole"),
        item_ids=request.data.get("item_ids") or request.data.get("itemIds") or [],
    )

    if error_message:
        return waiter_service_error_response(error_message)

    return Response(
        {
            "payment": result,
            "tables": get_waiter_tables_payload(venue, waiter),
            **get_waiter_order_lists_payload(venue, waiter),
        }
    )


@api_view(["POST"])
# SSU14 - Autor: Milica Tadić ([student ID omitted]), ručni unos narudžbine
def waiter_create_table_order(request, table_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    result, error_message = create_waiter_manual_order(
        venue=venue,
        waiter=waiter,
        table_id=table_id,
        cart_items=request.data.get("items") or request.data.get("cart") or [],
    )

    if error_message:
        return waiter_service_error_response(error_message)

    return Response(
        {
            "order": result,
            "tables": get_waiter_tables_payload(venue, waiter),
            **get_waiter_order_lists_payload(venue, waiter),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
def waiter_menu(request):
    _, _, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response(get_waiter_menu_payload(venue))


@api_view(["GET"])
def waiter_orders(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response(get_waiter_order_lists_payload(venue, waiter))


@api_view(["GET"])
# SSU12 - Autor: Milica Tadić ([student ID omitted]), pending/archive narudžbine
def waiter_pending_orders(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response({"pendingOrders": get_waiter_pending_orders_payload(venue, waiter)})


@api_view(["GET"])
def waiter_archive_orders(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response({"archiveOrders": get_waiter_archive_orders_payload(venue, waiter)})


@api_view(["POST"])
# SSU13 - Autor: Milica Tadić ([student ID omitted]), transfer stola/gostiju
def waiter_transfer_table(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    source_table_id = request.data.get("source_table_id") or request.data.get("sourceTableId")
    target_table_id = request.data.get("target_table_id") or request.data.get("targetTableId")
    mode = request.data.get("mode", "whole")
    table_guest_ids = request.data.get("table_guest_ids") or request.data.get("tableGuestIds")
    table_guest_id = request.data.get("table_guest_id") or request.data.get("tableGuestId")

    if table_guest_ids is None and table_guest_id is not None:
        table_guest_ids = [table_guest_id]

    transfer_result, error_message = transfer_waiter_table(
        venue=venue,
        waiter=waiter,
        source_table_id=source_table_id,
        target_table_id=target_table_id,
        mode=mode,
        table_guest_ids=table_guest_ids,
    )

    if error_message:
        return waiter_service_error_response(error_message)

    return Response(
        {
            "transfer": transfer_result,
            "tables": get_waiter_tables_payload(venue, waiter),
            **get_waiter_order_lists_payload(venue, waiter),
        }
    )


@api_view(["GET"])
def waiter_performance(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response(get_waiter_performance_payload(venue, waiter))


@api_view(["GET"])
def waiter_shifts(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    return Response({"shifts": get_waiter_shifts_payload(venue, waiter)})


@api_view(["POST"])
def waiter_process_pending_order(request, order_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    requested_status = str(request.data.get("status", "")).strip()
    item_approvals = request.data.get("itemApprovals") or request.data.get("item_approvals") or {}
    rejection_reason = str(request.data.get("rejectionReason") or request.data.get("rejection_reason") or "")

    processed_order, error_message = process_waiter_pending_order(
        venue=venue,
        waiter=waiter,
        order_id=order_id,
        requested_status=requested_status,
        item_approvals=item_approvals,
        rejection_reason=rejection_reason,
    )

    if error_message:
        return Response({"detail": error_message}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "order": processed_order,
            **get_waiter_order_lists_payload(venue, waiter),
        }
    )



def _format_reservation_datetime(value):
    if not value:
        return "N/A"

    local_value = timezone.localtime(value)
    return {
        "dateLabel": local_value.strftime("%d.%m.%Y."),
        "timeLabel": local_value.strftime("%H:%M"),
        "iso": value,
    }


def _get_reservation_guest_name(guest_id):
    user = Users.objects.filter(id=guest_id).first()

    if user is None:
        return "Gost"

    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full_name or user.username or user.email or "Gost"


def _reservation_preorder_total(reservation_id):
    order = Orders.objects.filter(reservation_id=reservation_id, creation_type="preorder").order_by("-created_at", "-id").first()

    if order is None:
        return 0

    return sum(float(item.total_price or 0) for item in OrderItems.objects.filter(order=order))


def _serialize_waiter_reservation(reservation):
    starts_at = _format_reservation_datetime(reservation.starts_at)
    ends_at = _format_reservation_datetime(reservation.ends_at)
    table = reservation.table
    sector = table.sector

    return {
        "id": reservation.id,
        "guestId": reservation.guest_id,
        "guestName": _get_reservation_guest_name(reservation.guest_id),
        "guestMeta": f"{reservation.number_of_people} gostiju",
        "status": reservation.status,
        "tableId": table.id,
        "tableNumber": table.table_number,
        "sectorId": sector.id,
        "sectorName": sector.name,
        "numberOfPeople": reservation.number_of_people,
        "startsAt": starts_at["iso"],
        "endsAt": ends_at["iso"],
        "dateLabel": starts_at["dateLabel"],
        "timeLabel": starts_at["timeLabel"],
        "endsAtLabel": ends_at["timeLabel"],
        "depositAmount": float(reservation.deposit_amount or 0),
        "preorderTotal": _reservation_preorder_total(reservation.id),
        "createdAt": reservation.created_at,
        "updatedAt": reservation.updated_at,
    }


@api_view(["GET"])
def waiter_pending_reservations(request):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    sync_due_reservations(venue=venue)
    reservations = (
        Reservations.objects.select_related("table", "table__sector", "venue")
        .filter(venue=venue, status="pending")
        .order_by("starts_at", "created_at")[:50]
    )

    return Response({"reservations": [_serialize_waiter_reservation(reservation) for reservation in reservations]})


@api_view(["POST"])
def waiter_process_reservation(request, reservation_id):
    _, waiter, venue, error_response = get_waiter_context_or_response(request)

    if error_response:
        return error_response

    requested_status = str(request.data.get("status", "")).strip().lower()

    if requested_status not in {"confirmed", "rejected"}:
        return Response({"detail": "Status rezervacije mora biti confirmed ili rejected."}, status=status.HTTP_400_BAD_REQUEST)

    reservation = (
        Reservations.objects.select_related("table", "table__sector", "venue")
        .filter(id=reservation_id, venue=venue)
        .first()
    )

    if reservation is None:
        return Response({"detail": "Rezervacija nije pronađena."}, status=status.HTTP_404_NOT_FOUND)

    if reservation.status != "pending":
        return Response({"detail": "Obrađene rezervacije se ne mogu ponovo odobravati."}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    if requested_status == "confirmed" and reservation.starts_at < now + timedelta(minutes=MIN_RESERVATION_LEAD_MINUTES):
        return Response(
            {"detail": f"Rezervacija mora biti najmanje {MIN_RESERVATION_LEAD_MINUTES} minuta unapred."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    reservation.status = requested_status
    reservation.confirmed_by = waiter.user_id if requested_status == "confirmed" else None
    reservation.updated_at = now
    reservation.save(update_fields=["status", "confirmed_by", "updated_at"])

    reservations = (
        Reservations.objects.select_related("table", "table__sector", "venue")
        .filter(venue=venue, status="pending")
        .order_by("starts_at", "created_at")[:50]
    )

    return Response({
        "reservation": _serialize_waiter_reservation(reservation),
        "reservations": [_serialize_waiter_reservation(current_reservation) for current_reservation in reservations],
        "tables": get_waiter_tables_payload(venue, waiter),
        **get_waiter_order_lists_payload(venue, waiter),
    })
