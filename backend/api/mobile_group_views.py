# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-5
from uuid import uuid4

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_friend_views import get_friend_ids, require_registered_mobile_guest, serialize_guest
from .mobile_table_views import ACTIVE_SESSION_STATUSES, get_current_guest_membership
from .models import GuestGroupMembers, GuestGroups, Guests, TableSessions

ACTIVE_GROUP_STATUSES = ["active"]
VISIBLE_MEMBER_STATUSES = ["accepted", "invited"]


def make_id(prefix):
    return f"{prefix}{uuid4().hex[:64 - len(prefix)]}"


def now():
    return timezone.now()


def table_label(table_session):
    if not table_session or not table_session.table_id:
        return "Sto"

    table_number = getattr(table_session.table, "table_number", None)
    return f"Sto {table_number}" if table_number else "Sto"


def serialize_member(member, current_guest_id=None):
    guest_data = serialize_guest(member.guest, current_guest_id)

    return {
        "membershipId": member.id,
        "id": member.guest_id,
        "name": guest_data["name"],
        "username": guest_data["username"],
        "email": guest_data.get("email"),
        "image": guest_data.get("image"),
        "avatarUrl": guest_data.get("avatarUrl"),
        "status": "active" if member.status == "accepted" else member.status,
        "rawStatus": member.status,
        "invitedAt": member.invited_at,
        "joinedAt": member.joined_at,
        "leftAt": member.left_at,
    }


def serialize_group(group, current_guest_id):
    table_session = group.table_session
    members = (
        GuestGroupMembers.objects.select_related("guest", "guest__user")
        .filter(group=group, status__in=VISIBLE_MEMBER_STATUSES)
        .order_by("joined_at", "invited_at")
    )

    return {
        "id": group.id,
        "ownerGuestId": group.owner_guest_id,
        "tableSessionId": group.table_session_id,
        "tableLabel": table_label(table_session),
        "status": group.status,
        "createdAt": group.created_at,
        "members": [serialize_member(member, current_guest_id) for member in members],
    }


def serialize_invite(member, current_guest_id):
    group = member.group
    owner = group.owner_guest
    owner_data = serialize_guest(owner, current_guest_id)

    return {
        "inviteId": member.id,
        "groupId": group.id,
        "tableSessionId": group.table_session_id,
        "tableLabel": table_label(group.table_session),
        "name": owner_data["name"],
        "username": owner_data["username"],
        "ownerGuestId": owner.user_id,
        "createdAt": group.created_at,
        "invitedAt": member.invited_at,
    }


def get_active_group_for_session(table_session):
    if not table_session:
        return None

    group = (
        GuestGroups.objects.select_related(
            "owner_guest",
            "owner_guest__user",
            "table_session",
            "table_session__table",
        )
        .filter(table_session=table_session, status__in=ACTIVE_GROUP_STATUSES)
        .order_by("-created_at")
        .first()
    )

    if group:
        return group

    group_id = getattr(table_session, "group_id", None)

    if not group_id:
        return None

    return (
        GuestGroups.objects.select_related(
            "owner_guest",
            "owner_guest__user",
            "table_session",
            "table_session__table",
        )
        .filter(id=group_id, status__in=ACTIVE_GROUP_STATUSES)
        .first()
    )


def ensure_group_owner_member(group):
    GuestGroupMembers.objects.get_or_create(
        group=group,
        guest=group.owner_guest,
        defaults={
            "id": make_id("ggm"),
            "status": "accepted",
            "invited_at": group.created_at or now(),
            "joined_at": group.created_at or now(),
            "left_at": None,
            "created_at": now(),
            "updated_at": now(),
        },
    )


def get_current_active_membership(group, guest_id):
    return GuestGroupMembers.objects.filter(group=group, guest_id=guest_id, status="accepted", left_at__isnull=True).first()


def available_friends_for_group(guest, group):
    friend_ids = get_friend_ids(guest.user_id)

    if not friend_ids:
        return []

    excluded_ids = set(
        GuestGroupMembers.objects.filter(group=group, status__in=VISIBLE_MEMBER_STATUSES).values_list("guest_id", flat=True)
    )
    excluded_ids.add(guest.user_id)
    available_ids = friend_ids.difference(excluded_ids)

    friends = (
        Guests.objects.select_related("user")
        .filter(user_id__in=available_ids, user__role="guest", user__status="active", user__deleted_at__isnull=True)
        .order_by("user__first_name", "user__last_name", "user__username")
    )

    return [serialize_guest(friend, guest.user_id) for friend in friends]


def pending_invites_for_guest(guest, table_session=None):
    query = GuestGroupMembers.objects.select_related(
        "group",
        "group__owner_guest",
        "group__owner_guest__user",
        "group__table_session",
        "group__table_session__table",
    ).filter(guest=guest, status="invited", group__status="active")

    if table_session:
        query = query.filter(group__table_session=table_session)

    return [serialize_invite(invite, guest.user_id) for invite in query.order_by("-invited_at")]


def build_group_summary(guest):
    table_membership = get_current_guest_membership(guest.user)
    table_session = table_membership.table_session if table_membership else None
    group = get_active_group_for_session(table_session)
    current_member = get_current_active_membership(group, guest.user_id) if group else None

    if group and not current_member and group.owner_guest_id == guest.user_id:
        ensure_group_owner_member(group)
        current_member = get_current_active_membership(group, guest.user_id)

    group_data = serialize_group(group, guest.user_id) if group and current_member else None

    return {
        "hasActiveTableSession": bool(table_session),
        "tableSessionId": table_session.id if table_session else None,
        "tableLabel": table_label(table_session) if table_session else None,
        "group": group_data,
        "invites": pending_invites_for_guest(guest, table_session),
        "availableFriends": available_friends_for_group(guest, group) if group and current_member else [],
    }


def require_group_access(guest):
    table_membership = get_current_guest_membership(guest.user)

    if table_membership is None:
        return None, None, Response({"detail": "Prvo poveži sto."}, status=status.HTTP_400_BAD_REQUEST)

    table_session = table_membership.table_session
    group = get_active_group_for_session(table_session)

    if group is None:
        return table_session, None, Response({"detail": "Grupa nije kreirana."}, status=status.HTTP_404_NOT_FOUND)

    membership = get_current_active_membership(group, guest.user_id)

    if membership is None:
        return table_session, group, Response({"detail": "Nisi član ove grupe."}, status=status.HTTP_403_FORBIDDEN)

    return table_session, group, None


@api_view(["GET"])
def mobile_group_summary(request):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    return Response(build_group_summary(guest))


@api_view(["POST"])
def mobile_group_create(request):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    table_membership = get_current_guest_membership(guest.user)

    if table_membership is None:
        return Response({"detail": "Prvo poveži sto."}, status=status.HTTP_400_BAD_REQUEST)

    table_session = table_membership.table_session
    existing_group = get_active_group_for_session(table_session)

    if existing_group:
        existing_member = get_current_active_membership(existing_group, guest.user_id)

        if existing_member:
            return Response({"ok": True, "summary": build_group_summary(guest)})

        invited_member = GuestGroupMembers.objects.filter(group=existing_group, guest=guest, status="invited").first()

        if invited_member:
            invited_member.status = "accepted"
            invited_member.joined_at = now()
            invited_member.left_at = None
            invited_member.updated_at = now()
            invited_member.save(update_fields=["status", "joined_at", "left_at", "updated_at"])
            return Response({"ok": True, "summary": build_group_summary(guest)})

        accepted_members_count = GuestGroupMembers.objects.filter(
            group=existing_group,
            status="accepted",
            left_at__isnull=True,
        ).count()

        if accepted_members_count > 0:
            GuestGroupMembers.objects.create(
                id=make_id("ggm"),
                group=existing_group,
                guest=guest,
                status="accepted",
                invited_at=now(),
                joined_at=now(),
                left_at=None,
                created_at=now(),
                updated_at=now(),
            )
            return Response({"ok": True, "summary": build_group_summary(guest)})

        existing_group.status = "closed"
        existing_group.closed_at = now()
        existing_group.updated_at = now()
        existing_group.save(update_fields=["status", "closed_at", "updated_at"])
        table_session.group_id = None
        table_session.updated_at = now()
        table_session.save(update_fields=["group_id", "updated_at"])

    with transaction.atomic():
        group = GuestGroups.objects.create(
            id=make_id("ggp"),
            owner_guest=guest,
            table_session=table_session,
            status="active",
            created_at=now(),
            updated_at=now(),
            closed_at=None,
        )
        GuestGroupMembers.objects.create(
            id=make_id("ggm"),
            group=group,
            guest=guest,
            status="accepted",
            invited_at=now(),
            joined_at=now(),
            left_at=None,
            created_at=now(),
            updated_at=now(),
        )
        table_session.group_id = group.id
        table_session.updated_at = now()
        table_session.save(update_fields=["group_id", "updated_at"])

    return Response({"ok": True, "summary": build_group_summary(guest)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def mobile_group_invite(request):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    _, group, access_error = require_group_access(guest)

    if access_error:
        return access_error

    friend_id = str(request.data.get("friendId") or request.data.get("friend_id") or request.data.get("guestId") or "").strip()[:8]

    if not friend_id:
        return Response({"detail": "Prijatelj nije izabran."}, status=status.HTTP_400_BAD_REQUEST)

    if friend_id == guest.user_id:
        return Response({"detail": "Ne možeš pozvati samog sebe."}, status=status.HTTP_400_BAD_REQUEST)

    if friend_id not in get_friend_ids(guest.user_id):
        return Response({"detail": "Možeš pozvati samo prijatelje."}, status=status.HTTP_400_BAD_REQUEST)

    invited_guest = Guests.objects.select_related("user").filter(
        user_id=friend_id,
        user__role="guest",
        user__status="active",
        user__deleted_at__isnull=True,
    ).first()

    if invited_guest is None:
        return Response({"detail": "Prijatelj nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    existing_member = GuestGroupMembers.objects.filter(group=group, guest=invited_guest, status__in=VISIBLE_MEMBER_STATUSES).first()

    if existing_member:
        return Response({"detail": "Korisnik je već pozvan ili je već u grupi."}, status=status.HTTP_400_BAD_REQUEST)

    GuestGroupMembers.objects.create(
        id=make_id("ggm"),
        group=group,
        guest=invited_guest,
        status="invited",
        invited_at=now(),
        joined_at=None,
        left_at=None,
        created_at=now(),
        updated_at=now(),
    )

    return Response({"ok": True, "summary": build_group_summary(guest)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def mobile_group_invite_accept(request, invite_id):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    table_membership = get_current_guest_membership(guest.user)

    if table_membership is None:
        return Response({"detail": "Prvo poveži sto."}, status=status.HTTP_400_BAD_REQUEST)

    invite = GuestGroupMembers.objects.select_related("group", "group__table_session").filter(
        id=invite_id,
        guest=guest,
        status="invited",
        group__status="active",
    ).first()

    if invite is None:
        return Response({"detail": "Poziv nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    if invite.group.table_session_id != table_membership.table_session_id:
        return Response({"detail": "Poziv nije za trenutno povezani sto."}, status=status.HTTP_400_BAD_REQUEST)

    invite.status = "accepted"
    invite.joined_at = now()
    invite.left_at = None
    invite.updated_at = now()
    invite.save(update_fields=["status", "joined_at", "left_at", "updated_at"])

    return Response({"ok": True, "summary": build_group_summary(guest)})


@api_view(["POST"])
def mobile_group_invite_decline(request, invite_id):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    invite = GuestGroupMembers.objects.filter(
        id=invite_id,
        guest=guest,
        status="invited",
        group__status="active",
    ).first()

    if invite is None:
        return Response({"detail": "Poziv nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    invite.status = "rejected"
    invite.left_at = now()
    invite.updated_at = now()
    invite.save(update_fields=["status", "left_at", "updated_at"])

    return Response({"ok": True, "summary": build_group_summary(guest)})


@api_view(["POST"])
def mobile_group_leave(request):
    _, guest, error = require_registered_mobile_guest(request)

    if error:
        return error

    table_session, group, access_error = require_group_access(guest)

    if access_error:
        return access_error

    with transaction.atomic():
        member = GuestGroupMembers.objects.filter(group=group, guest=guest, status="accepted", left_at__isnull=True).first()

        if member:
            member.status = "left"
            member.left_at = now()
            member.updated_at = now()
            member.save(update_fields=["status", "left_at", "updated_at"])

        if group.owner_guest_id == guest.user_id:
            next_owner_member = (
                GuestGroupMembers.objects.select_related("guest")
                .filter(group=group, status="accepted", left_at__isnull=True)
                .exclude(guest_id=guest.user_id)
                .order_by("joined_at", "created_at", "id")
                .first()
            )

            if next_owner_member:
                group.owner_guest = next_owner_member.guest
                group.updated_at = now()
                group.save(update_fields=["owner_guest", "updated_at"])
            else:
                GuestGroupMembers.objects.filter(group=group, status="invited").update(
                    status="left",
                    left_at=now(),
                    updated_at=now(),
                )
                group.status = "closed"
                group.closed_at = now()
                group.updated_at = now()
                group.save(update_fields=["status", "closed_at", "updated_at"])

                TableSessions.objects.filter(id=table_session.id, group_id=group.id).update(group_id=None, updated_at=now())

    return Response({"ok": True, "summary": build_group_summary(guest)})
