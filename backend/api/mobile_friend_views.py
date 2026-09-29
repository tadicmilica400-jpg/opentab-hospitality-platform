# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-5
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_auth_views import ensure_guest_profile, get_mobile_session_from_request
from .models import FriendRequests, Friendships, Guests, Users


def require_registered_mobile_guest(request):
    session = get_mobile_session_from_request(request)

    if session is None:
        return None, None, Response({"detail": "Moraš biti prijavljen."}, status=status.HTTP_401_UNAUTHORIZED)

    meta = session.meta if isinstance(session.meta, dict) else {}

    if meta.get("anonymous"):
        return None, None, Response(
            {"detail": "Prijatelji su dostupni samo registrovanim korisnicima."},
            status=status.HTTP_403_FORBIDDEN,
        )

    ensure_guest_profile(session.user)
    guest = Guests.objects.select_related("user").filter(user=session.user).first()

    if guest is None:
        return None, None, Response({"detail": "Guest profil nije pronađen."}, status=status.HTTP_400_BAD_REQUEST)

    return session, guest, None


def make_id(prefix):
    return f"{prefix}{uuid4().hex[:64 - len(prefix)]}"


def normalize_text(value):
    return " ".join(str(value or "").strip().split())


def full_name(user):
    value = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return value or user.username or "Gost"


def friend_pair(first_id, second_id):
    return tuple(sorted([str(first_id), str(second_id)]))


def get_friend_ids(guest_id):
    friendships = Friendships.objects.filter(Q(guest1_id=guest_id) | Q(guest2_id=guest_id))
    ids = set()

    for friendship in friendships:
        ids.add(friendship.guest2_id if friendship.guest1_id == guest_id else friendship.guest1_id)

    return ids


def mutual_friend_count(guest_id, other_guest_id):
    return len(get_friend_ids(guest_id).intersection(get_friend_ids(other_guest_id)))


def serialize_guest(guest, current_guest_id=None):
    user = guest.user

    return {
        "id": guest.user_id,
        "name": full_name(user),
        "username": user.username,
        "email": user.email,
        "image": user.image,
        "avatarUrl": user.image,
        "mutualFriends": mutual_friend_count(current_guest_id, guest.user_id) if current_guest_id else 0,
    }


def serialize_friend_request(friend_request, current_guest_id):
    other_guest = friend_request.sender if friend_request.receiver_id == current_guest_id else friend_request.receiver
    data = serialize_guest(other_guest, current_guest_id)
    data["requestId"] = friend_request.id
    data["requestStatus"] = friend_request.status
    data["sentAt"] = friend_request.sent_at
    data["direction"] = "incoming" if friend_request.receiver_id == current_guest_id else "outgoing"
    return data


def current_pending_request_between(first_id, second_id):
    return FriendRequests.objects.filter(
        Q(sender_id=first_id, receiver_id=second_id) | Q(sender_id=second_id, receiver_id=first_id),
        status="pending",
    ).first()


def build_summary(current_guest):
    current_id = current_guest.user_id
    friend_ids = get_friend_ids(current_id)
    friends = Guests.objects.select_related("user").filter(user_id__in=friend_ids).order_by("user__first_name", "user__last_name")
    incoming_requests = (
        FriendRequests.objects.select_related("sender__user", "receiver__user")
        .filter(receiver_id=current_id, status="pending")
        .order_by("-sent_at")
    )
    outgoing_requests = (
        FriendRequests.objects.select_related("sender__user", "receiver__user")
        .filter(sender_id=current_id, status="pending")
        .order_by("-sent_at")
    )
    excluded_ids = set(friend_ids)
    excluded_ids.add(current_id)

    for request in incoming_requests:
        excluded_ids.add(request.sender_id)

    for request in outgoing_requests:
        excluded_ids.add(request.receiver_id)

    suggestions = (
        Guests.objects.select_related("user")
        .filter(user__role="guest", user__status="active", user__deleted_at__isnull=True)
        .exclude(user_id__in=excluded_ids)
        .order_by("-user__created_at")[:20]
    )

    return {
        "friends": [serialize_guest(friend, current_id) for friend in friends],
        "requests": [serialize_friend_request(request, current_id) for request in incoming_requests],
        "sentRequests": [serialize_friend_request(request, current_id) for request in outgoing_requests],
        "searchResults": [serialize_guest(guest, current_id) for guest in suggestions],
    }


@api_view(["GET"])
def mobile_friends_summary(request):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    return Response(build_summary(guest))


@api_view(["GET"])
def mobile_friends_search(request):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    query = normalize_text(request.GET.get("q"))
    current_id = guest.user_id
    friend_ids = get_friend_ids(current_id)
    pending_requests = FriendRequests.objects.filter(
        Q(sender_id=current_id) | Q(receiver_id=current_id),
        status="pending",
    )
    excluded_ids = set(friend_ids)
    excluded_ids.add(current_id)

    for friend_request in pending_requests:
        excluded_ids.add(friend_request.receiver_id if friend_request.sender_id == current_id else friend_request.sender_id)

    guests = Guests.objects.select_related("user").filter(
        user__role="guest",
        user__status="active",
        user__deleted_at__isnull=True,
    ).exclude(user_id__in=excluded_ids)

    if query:
        guests = guests.filter(
            Q(user__first_name__icontains=query)
            | Q(user__last_name__icontains=query)
            | Q(user__username__icontains=query)
            | Q(user__email__icontains=query)
        )

    guests = guests.order_by("user__first_name", "user__last_name", "user__username")[:30]

    return Response({"results": [serialize_guest(item, current_id) for item in guests]})


@api_view(["POST"])
def mobile_friend_request_create(request):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    receiver_id = normalize_text(request.data.get("receiverId") or request.data.get("receiver_id") or request.data.get("guestId"))[:8]

    if not receiver_id:
        return Response({"detail": "Korisnik nije izabran."}, status=status.HTTP_400_BAD_REQUEST)

    if receiver_id == guest.user_id:
        return Response({"detail": "Ne možeš dodati samog sebe."}, status=status.HTTP_400_BAD_REQUEST)

    receiver = Guests.objects.select_related("user").filter(
        user_id=receiver_id,
        user__role="guest",
        user__status="active",
        user__deleted_at__isnull=True,
    ).first()

    if receiver is None:
        return Response({"detail": "Korisnik nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    first_id, second_id = friend_pair(guest.user_id, receiver_id)

    if Friendships.objects.filter(guest1_id=first_id, guest2_id=second_id).exists():
        return Response({"detail": "Već ste prijatelji."}, status=status.HTTP_400_BAD_REQUEST)

    existing_request = current_pending_request_between(guest.user_id, receiver_id)

    if existing_request:
        return Response({"detail": "Zahtev već postoji."}, status=status.HTTP_400_BAD_REQUEST)

    friend_request = FriendRequests.objects.create(
        id=make_id("frq"),
        sender=guest,
        receiver=receiver,
        status="pending",
        sent_at=timezone.now(),
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )

    return Response(
        {"ok": True, "request": serialize_friend_request(friend_request, guest.user_id), "summary": build_summary(guest)},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
def mobile_friend_request_accept(request, request_id):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    friend_request = FriendRequests.objects.select_related("sender__user", "receiver__user").filter(
        id=request_id,
        receiver=guest,
        status="pending",
    ).first()

    if friend_request is None:
        return Response({"detail": "Zahtev nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    first_id, second_id = friend_pair(friend_request.sender_id, friend_request.receiver_id)

    try:
        with transaction.atomic():
            Friendships.objects.get_or_create(
                guest1_id=first_id,
                guest2_id=second_id,
                defaults={"id": make_id("frn"), "created_at": timezone.now(), "updated_at": timezone.now()},
            )
            friend_request.status = "accepted"
            friend_request.responded_at = timezone.now()
            friend_request.updated_at = timezone.now()
            friend_request.save(update_fields=["status", "responded_at", "updated_at"])
    except IntegrityError:
        return Response({"detail": "Prijateljstvo već postoji."}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"ok": True, "summary": build_summary(guest)})


@api_view(["POST"])
def mobile_friend_request_decline(request, request_id):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    friend_request = FriendRequests.objects.filter(id=request_id, receiver=guest, status="pending").first()

    if friend_request is None:
        return Response({"detail": "Zahtev nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    friend_request.status = "rejected"
    friend_request.responded_at = timezone.now()
    friend_request.updated_at = timezone.now()
    friend_request.save(update_fields=["status", "responded_at", "updated_at"])

    return Response({"ok": True, "summary": build_summary(guest)})


@api_view(["DELETE"])
def mobile_friend_remove(request, friend_id):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    first_id, second_id = friend_pair(guest.user_id, friend_id)
    deleted_count, _ = Friendships.objects.filter(guest1_id=first_id, guest2_id=second_id).delete()

    if not deleted_count:
        return Response({"detail": "Prijatelj nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    return Response({"ok": True, "summary": build_summary(guest)})
