# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-5
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_auth_views import (
    ensure_guest_profile,
    get_mobile_session_from_request,
    normalize_email,
    normalize_text,
    normalize_username,
    serialize_mobile_user,
    split_name,
    validate_unique_guest_fields,
)
from .mobile_friend_views import build_summary, get_friend_ids
from .models import Guests, Orders, Payments, Reservations, TableSessionGuests, Users


PROFILE_FIELDS = ["first_name", "last_name", "email", "username", "phone", "image", "updated_at"]


def decimal_to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return float(value or 0)


def get_registered_guest(session):
    meta = session.meta if isinstance(session.meta, dict) else {}

    if meta.get("anonymous"):
        return None

    ensure_guest_profile(session.user)
    return Guests.objects.select_related("user").filter(user=session.user).first()


def guest_table_guest_ids(guest_id):
    return list(
        TableSessionGuests.objects.filter(guest_id=guest_id).values_list("id", flat=True)
    )


def build_profile_stats(guest):
    if guest is None:
        return {
            "rewardPoints": 0,
            "friendsCount": 0,
            "requestsCount": 0,
            "reservationsCount": 0,
            "ordersCount": 0,
            "paidAmount": 0,
        }

    table_guest_ids = guest_table_guest_ids(guest.user_id)
    reservations_count = Reservations.objects.filter(guest_id=guest.user_id).count()
    orders_count = Orders.objects.filter(created_by_table_guest_id__in=table_guest_ids).count() if table_guest_ids else 0
    paid_amount = (
        Payments.objects.filter(table_guest_id__in=table_guest_ids, status="paid").aggregate(total=Sum("amount")).get("total")
        if table_guest_ids
        else 0
    )

    from .models import FriendRequests

    requests_count = FriendRequests.objects.filter(receiver=guest, status="pending").count()

    return {
        "rewardPoints": int(guest.reward_points or 0),
        "friendsCount": len(get_friend_ids(guest.user_id)),
        "requestsCount": requests_count,
        "reservationsCount": reservations_count,
        "ordersCount": orders_count,
        "paidAmount": decimal_to_float(paid_amount),
    }


def build_profile_response(session):
    meta = session.meta if isinstance(session.meta, dict) else {}
    user = session.user
    guest = get_registered_guest(session)
    stats = build_profile_stats(guest)
    friends_summary = build_summary(guest) if guest is not None else {
        "friends": [],
        "requests": [],
        "sentRequests": [],
        "searchResults": [],
    }

    return {
        "user": serialize_mobile_user(user, meta),
        "isAnonymous": bool(meta.get("anonymous")),
        "stats": stats,
        "friendsSummary": friends_summary,
    }


def require_mobile_profile_session(request):
    session = get_mobile_session_from_request(request)

    if session is None:
        return None, Response({"detail": "Moraš biti prijavljen."}, status=status.HTTP_401_UNAUTHORIZED)

    return session, None


@api_view(["GET"])
def mobile_profile_me(request):
    session, error = require_mobile_profile_session(request)

    if error:
        return error

    return Response(build_profile_response(session))


@api_view(["PATCH"])
def mobile_profile_update(request):
    session, error = require_mobile_profile_session(request)

    if error:
        return error

    meta = session.meta if isinstance(session.meta, dict) else {}

    if meta.get("anonymous"):
        return Response({"detail": "Anonimni gost ne može menjati profil."}, status=status.HTTP_403_FORBIDDEN)

    user = Users.objects.filter(id=session.user_id, role="guest", status="active", deleted_at__isnull=True).first()

    if user is None:
        return Response({"detail": "Korisnik nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    first_name, last_name = split_name(request.data)
    email = normalize_email(request.data.get("email") if "email" in request.data else user.email)
    username = normalize_username(request.data.get("username") if "username" in request.data else user.username)
    phone = normalize_text(request.data.get("phone") if "phone" in request.data else user.phone)[:60]
    image = normalize_text(request.data.get("image") or request.data.get("avatarUrl") or user.image) or None

    if not first_name and not last_name:
        first_name = user.first_name
        last_name = user.last_name

    if not first_name.strip():
        return Response({"detail": "Ime je obavezno."}, status=status.HTTP_400_BAD_REQUEST)

    if not email:
        return Response({"detail": "Email je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    if "@" not in email or "." not in email.split("@", 1)[-1]:
        return Response({"detail": "Email nije u ispravnom formatu."}, status=status.HTTP_400_BAD_REQUEST)

    if not username:
        return Response({"detail": "Korisničko ime je obavezno."}, status=status.HTTP_400_BAD_REQUEST)

    unique_error = validate_unique_guest_fields(email=email, username=username, phone=phone, user_id=user.id)

    if unique_error:
        return Response({"detail": unique_error}, status=status.HTTP_400_BAD_REQUEST)

    user.first_name = first_name[:255]
    user.last_name = (last_name or "-")[:255]
    user.email = email[:255]
    user.username = username[:64]
    user.phone = phone or user.phone
    user.image = image
    user.updated_at = timezone.now()
    user.save(update_fields=PROFILE_FIELDS)
    ensure_guest_profile(user)

    session.user = user

    return Response(build_profile_response(session))
