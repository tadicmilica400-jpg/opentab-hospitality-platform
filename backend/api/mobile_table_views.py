# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-5
from uuid import uuid4

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_auth_views import ensure_guest_profile, get_mobile_session_from_request, normalize_text
from .models import TableAssignments, TableSessionGuests, TableSessions, VenueTables, WaiterShifts, Waiters

ACTIVE_SESSION_STATUSES = ["active", "waiting_payment"]


def create_id(prefix, model):
    clean_prefix = str(prefix or "id")[:8]

    for _ in range(30):
        candidate = f"{clean_prefix}-{uuid4().hex[:64 - len(clean_prefix) - 1]}"[:64]

        if not model.objects.filter(id=candidate).exists():
            return candidate

    return uuid4().hex[:32]


def normalized_code_variants(code):
    raw_code = normalize_text(code).strip()
    upper_code = raw_code.upper()
    variants = {raw_code, upper_code}

    if upper_code.startswith("STO"):
        number = upper_code[3:].strip("- _#")
        if number:
            variants.add(number)
            variants.add(f"Sto {number}")
            variants.add(f"STO{number}")

    if upper_code.startswith("TABLE"):
        number = upper_code[5:].strip("- _#")
        if number:
            variants.add(number)

    return {variant for variant in variants if variant}


def get_table_by_code(code):
    variants = normalized_code_variants(code)

    if not variants:
        return None

    query = Q()

    for variant in variants:
        query |= Q(qr_token__iexact=variant)
        query |= Q(table_number__iexact=variant)
        query |= Q(id__iexact=variant)
        query |= Q(qr_url__icontains=variant)

    return (
        VenueTables.objects.select_related("sector", "sector__venue")
        .filter(query, active=1, sector__active=1, sector__venue__active=1, sector__venue__deleted_at__isnull=True)
        .first()
    )


def get_display_name(user):
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full_name or user.username or "Gost"


def serialize_table_session_guest(membership):
    table_session = membership.table_session
    table = table_session.table
    sector = table.sector
    venue = sector.venue

    return {
        "id": table_session.id,
        "membershipId": membership.id,
        "status": table_session.status,
        "openedAt": table_session.opened_at,
        "joinedAt": membership.joined_at,
        "venue": {
            "id": venue.id,
            "name": venue.name,
            "address": venue.address,
        },
        "sector": {
            "id": sector.id,
            "name": sector.name,
            "emoji": sector.emoji,
        },
        "table": {
            "id": table.id,
            "number": table.table_number,
            "label": f"Sto {table.table_number}",
            "code": table.qr_token,
            "capacity": table.capacity,
            "status": table.status,
        },
        "guest": {
            "id": membership.guest_id,
            "displayName": membership.display_name or "Gost",
            "type": membership.type,
        },
    }


def get_current_guest_membership(user, table_session_id=None, anonymous=False):
    membership = (
        TableSessionGuests.objects.select_related(
            "table_session",
            "table_session__table",
            "table_session__table__sector",
            "table_session__table__sector__venue",
        )
        .filter(
            guest_id=user.id,
            left_at__isnull=True,
            table_session__status__in=ACTIVE_SESSION_STATUSES,
        )
        .order_by("-joined_at")
        .first()
    )

    if membership is not None or not table_session_id:
        return membership

    table_session = (
        TableSessions.objects.select_related("table", "table__sector", "table__sector__venue")
        .filter(id=table_session_id, status__in=ACTIVE_SESSION_STATUSES)
        .first()
    )

    if table_session is None:
        return None

    membership = get_or_create_guest_membership(table_session, user, anonymous=anonymous)

    return (
        TableSessionGuests.objects.select_related(
            "table_session",
            "table_session__table",
            "table_session__table__sector",
            "table_session__table__sector__venue",
        )
        .get(id=membership.id)
    )


def get_membership_from_mobile_session(auth_session):
    session_meta = auth_session.meta if isinstance(auth_session.meta, dict) else {}

    return get_current_guest_membership(
        auth_session.user,
        table_session_id=session_meta.get("active_table_session_id"),
        anonymous=bool(session_meta.get("anonymous")),
    )


def find_responsible_waiter_for_table(table, now=None):
    now = now or timezone.now()
    venue = table.sector.venue if table.sector_id and table.sector else None

    if venue is None:
        return None

    active_shift_query = (
        WaiterShifts.objects.select_related("waiter", "waiter__user")
        .filter(
            venue=venue,
            status="confirmed",
            shift_start__lte=now,
            waiter__user__status="active",
            waiter__user__deleted_at__isnull=True,
        )
        .filter(Q(shift_end__isnull=True) | Q(shift_end__gte=now))
    )

    same_sector_shift = (
        active_shift_query.filter(sector_id=table.sector_id)
        .order_by("-shift_start", "waiter_id")
        .first()
    )

    if same_sector_shift is not None:
        return same_sector_shift.waiter

    venue_shift = active_shift_query.order_by("-shift_start", "waiter_id").first()

    if venue_shift is not None:
        return venue_shift.waiter

    return (
        Waiters.objects.select_related("user")
        .filter(venue=venue, user__status="active", user__deleted_at__isnull=True)
        .order_by("user_id")
        .first()
    )


def ensure_active_table_assignment(table_session, waiter, now=None):
    if waiter is None:
        return None

    now = now or timezone.now()

    if table_session.current_waiter_id != waiter.user_id:
        table_session.current_waiter = waiter
        table_session.updated_at = now
        table_session.save(update_fields=["current_waiter", "updated_at"])

    if not TableAssignments.objects.filter(
        table_session=table_session,
        waiter=waiter,
        assigned_to__isnull=True,
    ).exists():
        TableAssignments.objects.create(
            id=create_id("assign", TableAssignments),
            table_session=table_session,
            waiter=waiter,
            assigned_from=now,
            assigned_to=None,
            created_at=now,
            updated_at=now,
        )

    return waiter


def resolve_session_waiter(table_session):
    if table_session is None:
        return None

    if table_session.current_waiter_id:
        return ensure_active_table_assignment(table_session, table_session.current_waiter)

    active_assignment = (
        TableAssignments.objects.select_related("waiter", "waiter__user")
        .filter(
            table_session=table_session,
            assigned_to__isnull=True,
            waiter__user__status="active",
            waiter__user__deleted_at__isnull=True,
        )
        .order_by("assigned_from", "id")
        .first()
    )

    if active_assignment is not None:
        return ensure_active_table_assignment(table_session, active_assignment.waiter)

    table = table_session.table
    waiter = find_responsible_waiter_for_table(table)
    return ensure_active_table_assignment(table_session, waiter)


def get_or_create_active_table_session(table):
    table_session = (
        TableSessions.objects.select_related("table", "table__sector", "table__sector__venue", "current_waiter")
        .filter(table=table, status__in=ACTIVE_SESSION_STATUSES)
        .order_by("-opened_at")
        .first()
    )

    if table_session:
        resolve_session_waiter(table_session)
        return table_session

    now = timezone.now()
    waiter = find_responsible_waiter_for_table(table, now=now)
    table_session = TableSessions.objects.create(
        id=create_id("ts", TableSessions),
        table=table,
        current_waiter=waiter,
        group_id=None,
        status="active",
        opened_at=now,
        closed_at=None,
        created_at=now,
        updated_at=now,
    )
    ensure_active_table_assignment(table_session, waiter, now=now)

    if table.status in {"free", "reserved"}:
        table.status = "occupied"
        table.save(update_fields=["status"])

    return table_session


def get_or_create_guest_membership(table_session, user, anonymous=False):
    membership = TableSessionGuests.objects.filter(
        table_session=table_session,
        guest_id=user.id,
        left_at__isnull=True,
    ).first()

    if membership:
        return membership

    return TableSessionGuests.objects.create(
        id=create_id("tsg", TableSessionGuests),
        table_session=table_session,
        guest_id=user.id,
        anonymous_token=f"anon-{user.id}" if anonymous else None,
        display_name=get_display_name(user)[:128],
        type="anonymous" if anonymous else "registered",
        joined_at=timezone.now(),
        left_at=None,
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )


def mobile_session_or_401(request):
    session = get_mobile_session_from_request(request)

    if session is None:
        return None, Response({"detail": "Nisi ulogovan u mobilnoj aplikaciji."}, status=status.HTTP_401_UNAUTHORIZED)

    ensure_guest_profile(session.user)
    return session, None


@api_view(["GET"])
def mobile_table_session_me(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    from .reservation_services import sync_due_reservations

    sync_due_reservations(guest_id=auth_session.user.id)
    membership = get_current_guest_membership(auth_session.user)

    if membership is None:
        return Response({"active": False, "session": None})

    return Response({"active": True, "session": serialize_table_session_guest(membership)})


@api_view(["POST"])
def mobile_table_scan(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    code = request.data.get("code") or request.data.get("qrToken") or request.data.get("qr_token") or request.data.get("tableCode")
    table = get_table_by_code(code)

    if table is None:
        return Response({"detail": "QR kod ili kod stola nije validan."}, status=status.HTTP_404_NOT_FOUND)

    if table.status == "inactive":
        return Response({"detail": "Ovaj sto trenutno nije aktivan."}, status=status.HTTP_400_BAD_REQUEST)

    from .reservation_services import sync_due_reservations

    sync_due_reservations(venue=table.sector.venue)
    session_meta = auth_session.meta if isinstance(auth_session.meta, dict) else {}

    with transaction.atomic():
        table_session = get_or_create_active_table_session(table)
        membership = get_or_create_guest_membership(
            table_session=table_session,
            user=auth_session.user,
            anonymous=bool(session_meta.get("anonymous")),
        )

        auth_session.meta = {
            **session_meta,
            "active_table_session_id": table_session.id,
            "active_table_id": table.id,
        }
        auth_session.save(update_fields=["meta"])

    membership = (
        TableSessionGuests.objects.select_related(
            "table_session",
            "table_session__table",
            "table_session__table__sector",
            "table_session__table__sector__venue",
        )
        .get(id=membership.id)
    )

    return Response({"active": True, "session": serialize_table_session_guest(membership)}, status=status.HTTP_200_OK)


@api_view(["POST"])
def mobile_table_session_leave(request):
    auth_session, error_response = mobile_session_or_401(request)

    if error_response:
        return error_response

    membership = get_current_guest_membership(auth_session.user)

    if membership is None:
        return Response({"ok": True, "active": False})

    membership.left_at = timezone.now()
    membership.updated_at = timezone.now()
    membership.save(update_fields=["left_at", "updated_at"])

    session_meta = auth_session.meta if isinstance(auth_session.meta, dict) else {}
    session_meta.pop("active_table_session_id", None)
    session_meta.pop("active_table_id", None)
    auth_session.meta = session_meta
    auth_session.save(update_fields=["meta"])

    return Response({"ok": True, "active": False})
