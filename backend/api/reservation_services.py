from datetime import timedelta
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from .models import (
    Orders,
    Reservations,
    TableSessionGuests,
    TableSessions,
    Users,
    VenueTables,
)

MIN_RESERVATION_LEAD_MINUTES = 15
RESERVATION_HOLD_MINUTES = 15
ACTIVE_SESSION_STATUSES = {"active", "waiting_payment"}


def create_id(prefix, model):
    clean_prefix = str(prefix or "id")[:8]

    for _ in range(30):
        candidate = f"{clean_prefix}-{uuid4().hex[:64 - len(clean_prefix) - 1]}"[:64]
        if not model.objects.filter(id=candidate).exists():
            return candidate

    return uuid4().hex[:32]


def get_reservation_guest_name(reservation):
    user = Users.objects.filter(id=reservation.guest_id).first()

    if user is None:
        return "Gost"

    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full_name or user.username or user.email or "Gost"


def _get_precreated_reservation_session(reservation):
    preorder = (
        Orders.objects.select_related("table_session")
        .filter(reservation=reservation)
        .order_by("created_at", "id")
        .first()
    )

    if preorder is not None:
        return preorder.table_session

    return (
        TableSessions.objects.filter(group_id=f"reservation:{reservation.id}"[:64])
        .order_by("created_at", "id")
        .first()
    )


def _reservation_session_is_active(reservation):
    session = _get_precreated_reservation_session(reservation)
    return bool(session and session.status in ACTIVE_SESSION_STATUSES)


def _activate_reservation(reservation, now):
    """Pretvara potvrđenu rezervaciju u normalnu aktivnu sesiju stola."""
    from .mobile_table_views import ensure_active_table_assignment, find_responsible_waiter_for_table

    table = (
        VenueTables.objects.select_for_update()
        .select_related("sector", "sector__venue")
        .get(id=reservation.table_id)
    )
    reservation_session = _get_precreated_reservation_session(reservation)

    active_session = (
        TableSessions.objects.select_for_update()
        .filter(table=table, status__in=ACTIVE_SESSION_STATUSES)
        .order_by("opened_at", "id")
        .first()
    )

    # Ne prepisujemo gosta koji već realno sedi za stolom. Rezervacija ostaje
    # potvrđena do kraja termina, nakon čega će biti označena kao no-show.
    if active_session is not None and (
        reservation_session is None or active_session.id != reservation_session.id
    ):
        return False

    waiter = find_responsible_waiter_for_table(table, now=now)

    if reservation_session is None:
        reservation_session = TableSessions.objects.create(
            id=create_id("rts", TableSessions),
            table=table,
            current_waiter=waiter,
            group_id=f"reservation:{reservation.id}"[:64],
            status="active",
            opened_at=now,
            closed_at=None,
            created_at=now,
            updated_at=now,
        )
    else:
        reservation_session = TableSessions.objects.select_for_update().get(id=reservation_session.id)
        reservation_session.table = table
        reservation_session.current_waiter = waiter
        reservation_session.group_id = f"reservation:{reservation.id}"[:64]
        reservation_session.status = "active"
        reservation_session.opened_at = now
        reservation_session.closed_at = None
        reservation_session.updated_at = now
        reservation_session.save(
            update_fields=[
                "table",
                "current_waiter",
                "group_id",
                "status",
                "opened_at",
                "closed_at",
                "updated_at",
            ]
        )

    user = Users.objects.filter(id=reservation.guest_id).first()
    display_name = get_reservation_guest_name(reservation)[:128]
    membership = (
        TableSessionGuests.objects.select_for_update()
        .filter(table_session=reservation_session, guest_id=reservation.guest_id)
        .order_by("created_at", "id")
        .first()
    )

    if membership is None:
        TableSessionGuests.objects.create(
            id=create_id("rsg", TableSessionGuests),
            table_session=reservation_session,
            guest_id=reservation.guest_id,
            anonymous_token=None,
            display_name=display_name,
            type="registered",
            joined_at=now,
            left_at=None,
            created_at=now,
            updated_at=now,
        )
    else:
        membership.display_name = display_name
        membership.type = "registered"
        membership.joined_at = now
        membership.left_at = None
        membership.updated_at = now
        membership.save(
            update_fields=["display_name", "type", "joined_at", "left_at", "updated_at"]
        )

    ensure_active_table_assignment(reservation_session, waiter, now=now)

    if table.status != "occupied":
        table.status = "occupied"
        table.save(update_fields=["status"])

    reservation.status = "completed"
    reservation.updated_at = now
    reservation.save(update_fields=["status", "updated_at"])
    return True


def cleanup_stale_reserved_table_statuses(venue=None):
    """Uklanja status koji je stari kod trajno upisivao za buduće rezervacije."""
    tables = VenueTables.objects.filter(status="reserved")

    if venue is not None:
        tables = tables.filter(sector__venue=venue)

    active_table_ids = TableSessions.objects.filter(
        status__in=ACTIVE_SESSION_STATUSES
    ).values_list("table_id", flat=True)

    return tables.exclude(id__in=active_table_ids).update(status="free")


def sync_due_reservations(venue=None, guest_id=None, now=None):
    """
    Aktivira potvrđene rezervacije čiji je termin počeo.

    Poziva se iz mobilnog i konobarskog polling-a, pa nije potreban poseban
    scheduler za ovaj školski projekat.
    """
    now = now or timezone.now()
    activated_ids = []

    with transaction.atomic():
        cleanup_stale_reserved_table_statuses(venue=venue)

        expired = Reservations.objects.select_for_update().filter(
            status__in=["pending", "confirmed"],
            ends_at__lte=now,
        )
        if venue is not None:
            expired = expired.filter(venue=venue)
        if guest_id is not None:
            expired = expired.filter(guest_id=guest_id)

        for reservation in expired:
            reservation.status = "completed" if _reservation_session_is_active(reservation) else "no_show"
            reservation.updated_at = now
            reservation.save(update_fields=["status", "updated_at"])

        due = (
            Reservations.objects.select_for_update()
            .select_related("table", "table__sector", "venue")
            .filter(status="confirmed", starts_at__lte=now, ends_at__gt=now)
            .order_by("starts_at", "created_at", "id")
        )
        if venue is not None:
            due = due.filter(venue=venue)
        if guest_id is not None:
            due = due.filter(guest_id=guest_id)

        for reservation in due:
            if _activate_reservation(reservation, now):
                activated_ids.append(reservation.id)

    return activated_ids


def get_imminent_reservations_by_table(venue, now=None):
    """Rezervisan status se prikazuje samo 15 minuta pre termina."""
    now = now or timezone.now()
    hold_until = now + timedelta(minutes=RESERVATION_HOLD_MINUTES)
    reservations = (
        Reservations.objects.select_related("table", "table__sector", "venue")
        .filter(
            venue=venue,
            status="confirmed",
            starts_at__gt=now,
            starts_at__lte=hold_until,
        )
        .order_by("starts_at", "created_at", "id")
    )

    result = {}
    for reservation in reservations:
        result.setdefault(reservation.table_id, reservation)

    return result
