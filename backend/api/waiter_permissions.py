# Autor: Milica Tadić ([student ID omitted]) - SSU11-15
from rest_framework import status
from rest_framework.response import Response

from .models import VenueTables, Waiters
from .views import get_request_user_and_role


def waiter_error(message, status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": message}, status=status_code)


def get_waiter_context_or_response(request):
    user, effective_role = get_request_user_and_role(request)

    if user is None:
        return None, None, None, waiter_error(
            "Nisi ulogovan. Prijavi se kao konobar da bi pristupio ovom delu aplikacije.",
            status.HTTP_401_UNAUTHORIZED,
        )

    if effective_role != "waiter":
        return user, None, None, waiter_error(
            "Za ovu akciju moraš biti konobar.",
            status.HTTP_403_FORBIDDEN,
        )

    waiter = Waiters.objects.select_related("user", "venue").filter(
        user=user,
        active=1,
        user__status="active",
        user__deleted_at__isnull=True,
        venue__active=1,
        venue__deleted_at__isnull=True,
    ).first()

    if waiter is None:
        return user, None, None, waiter_error(
            "Nije pronađen aktivan konobarski nalog za ovog korisnika.",
            status.HTTP_403_FORBIDDEN,
        )

    return user, waiter, waiter.venue, None


def get_waiter_table_or_response(venue, table_id):
    table = VenueTables.objects.select_related("sector").filter(
        id=table_id,
        sector__venue=venue,
        active=1,
    ).first()

    if table is None:
        return None, waiter_error("Sto nije pronađen u ovom lokalu.", status.HTTP_404_NOT_FOUND)

    return table, None
