# Autori: Milica Tadić ([student ID omitted], SSU11), Boško Trifunović ([student ID omitted], SSU16-19)
from datetime import datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from secrets import token_urlsafe
from uuid import uuid4

from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.db import DataError, IntegrityError, transaction
from django.db.models import Avg, Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import (
    MenuCategories,
    MenuItemOptionGroups,
    MenuItemOptions,
    MenuItems,
    OrderItems,
    Orders,
    Payments,
    TableAssignments,
    TableSessions,
    Users,
    UserSessions,
    Venues,
    WaiterGoalMembers,
    WaiterRatings,
    WaiterRevenueGoals,
    WaiterShifts,
    Waiters,
    VenueSectors,
    VenueTables,
)
from .serializers import (
    MenuCategorySerializer,
    AuthUserSerializer,
    MenuItemSerializer,
    StaffMemberSerializer,
    VenueSectorSerializer,
    VenueSerializer,
    VenueTableSerializer,
)


OWNER_ONLY_MESSAGE = "Za ovu akciju moraš biti owner."
VALID_FLOORS = {"parket", "plocice", "beton"}
VALID_TABLE_SHAPES = {"round", "square", "rectangle"}
BLOCKING_TABLE_STATUSES = {"occupied", "waiting_order", "in_preparation", "waiting_payment"}
SESSION_DURATION_DAYS = 7
LOGIN_ROLES = {"owner", "waiter", "guest"}


def create_id(prefix):
    return f"{prefix}-{uuid4().hex[:24]}"


def get_bool(value, default=True):
    if value is None:
        return 1 if default else 0

    return 1 if value is True or value == 1 or value == "1" else 0


MAX_IMAGE_DATA_LENGTH = 60000
ALLOWED_IMAGE_DATA_PREFIXES = (
    "data:image/jpeg;base64,",
    "data:image/jpg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
)


def get_decimal(value, default="0"):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def get_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def get_clean_image(value):
    if value is None:
        return None

    image = str(value).strip()

    if not image:
        return None

    if image.startswith("https://"):
        return image

    if image.startswith("data:image/"):
        if not image.startswith(ALLOWED_IMAGE_DATA_PREFIXES):
            raise ValueError("Dozvoljeni formati slike su JPEG, PNG i WEBP.")

        if len(image) > MAX_IMAGE_DATA_LENGTH:
            raise ValueError("Slika je prevelika za čuvanje. Izaberi manju sliku.")

        return image

    raise ValueError("Slika mora biti HTTPS URL ili uploadovana slika.")


def get_auth_token(request):
    authorization = str(request.headers.get("Authorization") or "").strip()

    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()

    return (
        request.headers.get("X-OpenTab-Token")
        or request.query_params.get("token")
        or None
    )


def normalize_login_role(role):
    return str(role or "").strip().lower()


def user_has_owner_access(user):
    return normalize_login_role(user.role) == "owner"


def user_has_waiter_access(user):
    return normalize_login_role(user.role) == "waiter"


def resolve_user_role(user, expected_role=None):
    user_role = normalize_login_role(user.role)
    expected = normalize_login_role(expected_role)

    if expected:
        return user_role if expected == user_role and user_role in LOGIN_ROLES else None

    return user_role if user_role in LOGIN_ROLES else None


def set_effective_role(user, role):
    user.effective_role = role
    return user


def get_authenticated_user_and_role_from_token(token):
    if not token:
        return None, None

    session = (
        UserSessions.objects.select_related("user")
        .filter(token=token, expires_at__gt=timezone.now())
        .first()
    )

    if session is None:
        return None, None

    user = session.user

    if user.status != "active" or user.deleted_at is not None:
        return None, None

    session_role = None
    if isinstance(session.meta, dict):
        session_role = session.meta.get("role")

    effective_role = resolve_user_role(user, session_role if session_role in LOGIN_ROLES else None)

    if effective_role is None:
        return None, None

    return set_effective_role(user, effective_role), effective_role


def get_authenticated_user_from_token(token):
    user, _ = get_authenticated_user_and_role_from_token(token)
    return user


def get_request_user_and_role(request):
    token = get_auth_token(request)

    if not token:
        return None, None

    return get_authenticated_user_and_role_from_token(token)


def get_request_user(request):
    user, _ = get_request_user_and_role(request)
    return user


def is_django_password_hash(stored_password):
    try:
        identify_hasher(stored_password)
        return True
    except (TypeError, ValueError):
        return False


def save_hashed_password(user, raw_password):
    user.password_hash = make_password(raw_password)
    user.updated_at = timezone.now()
    user.save(update_fields=["password_hash", "updated_at"])


def password_matches(user, password):
    stored_password = user.password_hash or ""

    if not stored_password:
        return False

    if is_django_password_hash(stored_password):
        return check_password(password, stored_password)

    # Jednokratna migracija starih ručno unetih lozinki u Django hash format.
    if stored_password == password:
        save_hashed_password(user, password)
        return True

    # Stari demo seed je imao vrednost "demo_hash" umesto pravog hash-a.
    if stored_password == "demo_hash" and password == "demo1234":
        save_hashed_password(user, password)
        return True

    return False


def serialize_auth_user(user, role=None):
    effective_role = role or getattr(user, "effective_role", None) or resolve_user_role(user) or user.role
    data = AuthUserSerializer(user).data
    data["role"] = effective_role

    if effective_role == "owner":
        venue = Venues.objects.filter(owner_id=user.id, active=1, deleted_at__isnull=True).first()
        data["venue"] = VenueSerializer(venue).data if venue else None

    if effective_role == "waiter":
        waiter = Waiters.objects.filter(user_id=user.id, active=1).select_related("venue").first()
        data["venue"] = VenueSerializer(waiter.venue).data if waiter else None
        data["staff_role"] = waiter.staff_role if waiter else None

    return data


def auth_error(message="Nisi ulogovan."):
    return Response({"detail": message}, status=status.HTTP_401_UNAUTHORIZED)


def get_owner_venue_or_response(request):
    user, effective_role = get_request_user_and_role(request)

    if user is None:
        return None, None, Response(
            {"detail": "Nisi ulogovan. Prijavi se kao owner da bi pristupio ovom delu aplikacije."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if effective_role != "owner":
        return user, None, Response({"detail": OWNER_ONLY_MESSAGE}, status=status.HTTP_403_FORBIDDEN)

    venue = Venues.objects.filter(owner_id=user.id, active=1, deleted_at__isnull=True).first()

    if venue is None:
        return user, None, Response(
            {"detail": "Ne postoji lokal za ovog ownera. Prvo ubaci bar jedan venue."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return user, venue, None


def serialize_category(category, status_code=status.HTTP_200_OK):
    return Response(MenuCategorySerializer(category).data, status=status_code)


def serialize_item(item, status_code=status.HTTP_200_OK):
    return Response(MenuItemSerializer(item).data, status=status_code)


def serialize_venue_map(venue):
    sectors = VenueSectors.objects.filter(venue=venue, active=1).order_by("display_order", "name")
    tables = VenueTables.objects.filter(sector__venue=venue, active=1).order_by("sector_id", "table_number")

    return Response(
        {
            "venue": VenueSerializer(venue).data,
            "floor": venue.floor_type,
            "sectors": VenueSectorSerializer(sectors, many=True).data,
            "tables": VenueTableSerializer(tables, many=True).data,
        }
    )


def sync_option_groups(item, option_groups):
    MenuItemOptionGroups.objects.filter(menu_item=item).delete()

    for group_index, group_payload in enumerate(option_groups or []):
        group_name = str(group_payload.get("name", "")).strip()

        if not group_name:
            continue

        group = MenuItemOptionGroups.objects.create(
            id=create_id("option-group"),
            menu_item=item,
            name=group_name,
            required=0,
            min_choices=0,
            max_choices=None,
            display_order=group_index,
            active=1,
        )

        for option_payload in group_payload.get("options", []):
            option_name = str(option_payload.get("name", "")).strip()

            if not option_name:
                continue

            MenuItemOptions.objects.create(
                id=create_id("option"),
                option_group=group,
                name=option_name,
                extra_price=get_decimal(option_payload.get("extra_price", 0)),
                active=1,
            )


@api_view(["POST"])
# SSU11 - Autor: Milica Tadić ([student ID omitted]), autentifikacija konobara
def auth_login(request):
    identifier = str(
        request.data.get("identifier")
        or request.data.get("username")
        or request.data.get("email")
        or ""
    ).strip()
    password = str(request.data.get("password") or "")
    expected_role = normalize_login_role(request.data.get("role") or request.data.get("expected_role")) or None

    if not identifier:
        return Response({"detail": "Email ili korisničko ime je obavezno."}, status=status.HTTP_400_BAD_REQUEST)

    if not password:
        return Response({"detail": "Lozinka je obavezna."}, status=status.HTTP_400_BAD_REQUEST)

    if expected_role and expected_role not in LOGIN_ROLES:
        return Response({"detail": "Nepoznata uloga korisnika."}, status=status.HTTP_400_BAD_REQUEST)

    user = Users.objects.filter(
        Q(username__iexact=identifier) | Q(email__iexact=identifier),
        status="active",
        deleted_at__isnull=True,
    ).first()

    if user is None or not password_matches(user, password):
        return Response({"detail": "Neispravni kredencijali."}, status=status.HTTP_400_BAD_REQUEST)

    effective_role = resolve_user_role(user, expected_role)

    if effective_role is None:
        return Response({"detail": "Ovaj nalog nema pristup ovom delu aplikacije."}, status=status.HTTP_403_FORBIDDEN)

    set_effective_role(user, effective_role)

    session = UserSessions.objects.create(
        id=create_id("session"),
        user=user,
        device_id=request.data.get("device_id") or None,
        token=token_urlsafe(48),
        expires_at=timezone.now() + timedelta(days=SESSION_DURATION_DAYS),
        meta={"role": effective_role},
    )

    return Response(
        {
            "token": session.token,
            "expires_at": session.expires_at,
            "user": serialize_auth_user(user, effective_role),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
def auth_me(request):
    token = get_auth_token(request)
    user, effective_role = get_authenticated_user_and_role_from_token(token)

    if user is None:
        return auth_error()

    return Response({"user": serialize_auth_user(user, effective_role)})


@api_view(["POST"])
def auth_logout(request):
    token = get_auth_token(request)

    if token:
        UserSessions.objects.filter(token=token).delete()

    return Response({"ok": True})


DEFAULT_STAFF_ROLE_ICONS = {
    "Konobar": "🍽",
    "Šanker": "🍹",
    "Menadžer": "💼",
}
VALID_STAFF_GENDERS = {"male", "female", "other"}


# SSU18 - Autor: Boško Trifunović ([student ID omitted]), osoblje i smene
def create_user_id(prefix="w"):
    for _ in range(20):
        candidate = f"{prefix}{uuid4().hex[:7]}"

        if not Users.objects.filter(id=candidate).exists():
            return candidate

    return uuid4().hex[:8]


def normalize_text(value):
    return " ".join(str(value or "").strip().split())


def split_full_name(full_name):
    parts = normalize_text(full_name).split(" ", 1)

    if not parts or not parts[0]:
        return "", ""

    if len(parts) == 1:
        return parts[0], "-"

    return parts[0], parts[1]


def parse_optional_date(value, label):
    if value is None or str(value).strip() == "":
        return None, None

    parsed = parse_date(str(value).strip())

    if parsed is None:
        return None, Response({"detail": f"{label} mora biti u formatu YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

    return parsed, None


def get_optional_decimal(value):
    if value is None or str(value).strip() == "":
        return None

    return get_decimal(value)


def get_default_role_icon(name):
    return DEFAULT_STAFF_ROLE_ICONS.get(name, "◎")


def get_staff_role_names(venue):
    role_names = list(DEFAULT_STAFF_ROLE_ICONS.keys())
    waiter_roles = (
        Waiters.objects.filter(venue=venue)
        .exclude(staff_role__isnull=True)
        .values_list("staff_role", flat=True)
        .distinct()
    )

    for role_name in waiter_roles:
        normalized = normalize_text(role_name)
        if normalized and normalized not in role_names:
            role_names.append(normalized)

    return role_names


def get_staff_role_dict(venue, role_name):
    normalized = normalize_text(role_name)

    return {
        "id": normalized,
        "name": normalized,
        "icon": get_default_role_icon(normalized),
        "worker_count": Waiters.objects.filter(venue=venue, staff_role=normalized, active=1).count(),
    }


def get_staff_role_or_404(venue, role_key):
    normalized_key = normalize_text(role_key)

    for role_name in get_staff_role_names(venue):
        if role_name.lower() == normalized_key.lower():
            return role_name, None

    return None, Response({"detail": "Uloga nije pronađena."}, status=status.HTTP_404_NOT_FOUND)


def get_staff_roles_payload(venue):
    roles = [get_staff_role_dict(venue, role_name) for role_name in get_staff_role_names(venue)]

    return {
        "roles": roles,
        "role_names": [role["name"] for role in roles],
        "role_icons": {role["name"]: role["icon"] for role in roles},
    }


def serialize_staff_member(waiter, status_code=status.HTTP_200_OK):
    return Response(StaffMemberSerializer(waiter).data, status=status_code)


def get_waiter_for_owner_or_404(venue, worker_id):
    waiter = (
        Waiters.objects.select_related("user", "venue")
        .filter(user_id=worker_id, venue=venue, user__deleted_at__isnull=True)
        .first()
    )

    if waiter is None:
        return None, Response({"detail": "Radnik nije pronađen."}, status=status.HTTP_404_NOT_FOUND)

    return waiter, None


def validate_unique_user_fields(username, email, phone, ignored_user_id=None):
    if Users.objects.filter(username__iexact=username).exclude(id=ignored_user_id).exists():
        return Response({"detail": "Ovo korisničko ime je već zauzeto."}, status=status.HTTP_400_BAD_REQUEST)

    if email and Users.objects.filter(email__iexact=email).exclude(id=ignored_user_id).exists():
        return Response({"detail": "Ovaj email je već zauzet."}, status=status.HTTP_400_BAD_REQUEST)

    if phone and Users.objects.filter(phone=phone).exclude(id=ignored_user_id).exists():
        return Response({"detail": "Ovaj broj telefona je već zauzet."}, status=status.HTTP_400_BAD_REQUEST)

    return None


def get_staff_payload_values(data, existing_waiter=None):
    full_name = normalize_text(data.get("fullName") or data.get("full_name"))
    username = normalize_text(data.get("username"))
    password = str(data.get("password") or "").strip()
    role_name = normalize_text(data.get("role") or data.get("staff_role") or "Konobar")
    gender = str(data.get("gender") or "other").strip()
    image = data.get("avatarUrl") if "avatarUrl" in data else data.get("image")
    status_value = data.get("status")

    if existing_waiter is not None:
        if not full_name:
            full_name = f"{existing_waiter.user.first_name} {existing_waiter.user.last_name}".strip()

        if not username:
            username = existing_waiter.user.username

        if not role_name:
            role_name = existing_waiter.staff_role

        if "gender" not in data:
            gender = existing_waiter.gender

        if image is None:
            image = existing_waiter.user.image

    if gender not in VALID_STAFF_GENDERS:
        gender = "other"

    birthday, birthday_error = parse_optional_date(data.get("birthday"), "Datum rođenja")
    if birthday_error:
        return None, birthday_error

    employed_at, employed_error = parse_optional_date(
        data.get("hireDate") or data.get("employed_at"),
        "Datum zaposlenja",
    )
    if employed_error:
        return None, employed_error

    try:
        clean_image = get_clean_image(image)
    except ValueError as error:
        return None, Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    values = {
        "full_name": full_name,
        "username": username,
        "password": password,
        "role_name": role_name,
        "gender": gender,
        "image": clean_image,
        "email": normalize_text(data.get("email")),
        "phone": normalize_text(data.get("phone")),
        "birthday": birthday,
        "employed_at": employed_at,
        "salary": get_optional_decimal(data.get("salary")),
        "shift_type": normalize_text(data.get("shiftType") or data.get("shift_type")) or None,
        "note": data.get("note") if "note" in data else None,
        "status": str(status_value).strip() if status_value is not None else None,
    }

    return values, None


@api_view(["GET", "POST"])
def staff_list(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    if request.method == "GET":
        staff = (
            Waiters.objects.select_related("user")
            .filter(venue=venue, user__deleted_at__isnull=True)
            .order_by("-active", "user__first_name", "user__last_name")
        )
        return Response(StaffMemberSerializer(staff, many=True).data)

    values, values_error = get_staff_payload_values(request.data)

    if values_error:
        return values_error

    if not values["full_name"]:
        return Response({"detail": "Ime i prezime su obavezni."}, status=status.HTTP_400_BAD_REQUEST)

    if not values["username"]:
        return Response({"detail": "Korisničko ime je obavezno."}, status=status.HTTP_400_BAD_REQUEST)

    if not values["password"]:
        return Response({"detail": "Lozinka je obavezna za novog radnika."}, status=status.HTTP_400_BAD_REQUEST)

    if not values["role_name"]:
        return Response({"detail": "Uloga je obavezna."}, status=status.HTTP_400_BAD_REQUEST)

    user_id = create_user_id("w")
    email = values["email"] or f"{values['username'].lower()}.{user_id}@opentab.local"
    phone = values["phone"] or f"staff-{user_id}"
    unique_error = validate_unique_user_fields(values["username"], email, phone)

    if unique_error:
        return unique_error

    first_name, last_name = split_full_name(values["full_name"])

    try:
        with transaction.atomic():
            user = Users.objects.create(
                id=user_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone,
                username=values["username"],
                password_hash=make_password(values["password"]),
                role="waiter",
                status="active",
                image=values["image"],
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            waiter = Waiters.objects.create(
                user=user,
                venue=venue,
                staff_role=values["role_name"],
                gender=values["gender"],
                birthday=values["birthday"],
                salary=values["salary"],
                shift_type=values["shift_type"],
                rating=0,
                note=values["note"],
                employed_at=values["employed_at"] or timezone.localdate(),
                active=1,
            )

            return serialize_staff_member(waiter, status.HTTP_201_CREATED)
    except IntegrityError:
        return Response({"detail": "Radnik sa ovim podacima već postoji."}, status=status.HTTP_400_BAD_REQUEST)
    except DataError:
        return Response({"detail": "Neki podatak je predugačak za čuvanje u bazi."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PATCH", "DELETE"])
def staff_detail(request, worker_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    waiter, waiter_error = get_waiter_for_owner_or_404(venue, worker_id)

    if waiter_error:
        return waiter_error

    if request.method == "GET":
        return serialize_staff_member(waiter)

    if request.method == "DELETE":
        now = timezone.now()
        waiter.active = 0
        waiter.user.status = "deactivated"
        waiter.user.deleted_at = now
        waiter.user.updated_at = now

        with transaction.atomic():
            waiter.save(update_fields=["active"])
            waiter.user.save(update_fields=["status", "deleted_at", "updated_at"])
            UserSessions.objects.filter(user=waiter.user).delete()

        return Response({"ok": True})

    values, values_error = get_staff_payload_values(request.data, waiter)

    if values_error:
        return values_error

    if not values["full_name"]:
        return Response({"detail": "Ime i prezime su obavezni."}, status=status.HTTP_400_BAD_REQUEST)

    if not values["username"]:
        return Response({"detail": "Korisničko ime je obavezno."}, status=status.HTTP_400_BAD_REQUEST)

    first_name, last_name = split_full_name(values["full_name"])
    email = values["email"] or waiter.user.email
    phone = values["phone"] or waiter.user.phone
    unique_error = validate_unique_user_fields(values["username"], email, phone, waiter.user_id)

    if unique_error:
        return unique_error

    if not values["role_name"]:
        return Response({"detail": "Uloga je obavezna."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            waiter.user.first_name = first_name
            waiter.user.last_name = last_name
            waiter.user.username = values["username"]
            waiter.user.email = email
            waiter.user.phone = phone
            waiter.user.image = values["image"]
            waiter.user.updated_at = timezone.now()

            if values["password"]:
                waiter.user.password_hash = make_password(values["password"])
                UserSessions.objects.filter(user=waiter.user).delete()

            waiter.staff_role = values["role_name"]
            waiter.gender = values["gender"]

            if "birthday" in request.data:
                waiter.birthday = values["birthday"]

            if "salary" in request.data:
                waiter.salary = values["salary"]

            if "shiftType" in request.data or "shift_type" in request.data:
                waiter.shift_type = values["shift_type"]

            if "hireDate" in request.data or "employed_at" in request.data:
                waiter.employed_at = values["employed_at"]

            if "note" in request.data:
                waiter.note = values["note"] or None

            if values["status"] in {"active", "inactive"}:
                waiter.active = 1 if values["status"] == "active" else 0
                waiter.user.status = "active" if values["status"] == "active" else "deactivated"

                if values["status"] == "active":
                    waiter.user.deleted_at = None

            waiter.user.save()
            waiter.save()

            return serialize_staff_member(waiter)
    except IntegrityError:
        return Response({"detail": "Radnik sa ovim podacima već postoji."}, status=status.HTTP_400_BAD_REQUEST)
    except DataError:
        return Response({"detail": "Neki podatak je predugačak za čuvanje u bazi."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def staff_activate(request, worker_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    waiter, waiter_error = get_waiter_for_owner_or_404(venue, worker_id)

    if waiter_error:
        return waiter_error

    waiter.active = 1
    waiter.user.status = "active"
    waiter.user.deleted_at = None
    waiter.user.updated_at = timezone.now()

    with transaction.atomic():
        waiter.save(update_fields=["active"])
        waiter.user.save(update_fields=["status", "deleted_at", "updated_at"])

    return serialize_staff_member(waiter)


@api_view(["POST"])
def staff_deactivate(request, worker_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    waiter, waiter_error = get_waiter_for_owner_or_404(venue, worker_id)

    if waiter_error:
        return waiter_error

    waiter.active = 0
    waiter.user.status = "deactivated"
    waiter.user.updated_at = timezone.now()

    with transaction.atomic():
        waiter.save(update_fields=["active"])
        waiter.user.save(update_fields=["status", "updated_at"])
        UserSessions.objects.filter(user=waiter.user).delete()

    return serialize_staff_member(waiter)


@api_view(["GET", "POST"])
def staff_roles_list(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    if request.method == "GET":
        return Response(get_staff_roles_payload(venue))

    name = normalize_text(request.data.get("name"))
    worker_ids = request.data.get("workerIds") or request.data.get("worker_ids") or []

    if not name:
        return Response({"detail": "Naziv uloge je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    role_names = get_staff_role_names(venue)
    role_already_exists = any(role_name.lower() == name.lower() for role_name in role_names)

    if role_already_exists and not worker_ids:
        return Response({"detail": "Uloga sa ovim nazivom već postoji."}, status=status.HTTP_400_BAD_REQUEST)

    if worker_ids:
        Waiters.objects.filter(venue=venue, user_id__in=worker_ids).update(staff_role=name)

    return Response(get_staff_role_dict(venue, name), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
def staff_role_detail(request, role_key):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    role_name, role_error = get_staff_role_or_404(venue, role_key)

    if role_error:
        return role_error

    if request.method == "GET":
        return Response(get_staff_role_dict(venue, role_name))

    other_roles = [name for name in get_staff_role_names(venue) if name.lower() != role_name.lower()]

    if request.method == "DELETE":
        fallback_key = request.data.get("fallbackRole") or request.data.get("fallback_role") or request.data.get("fallback_role_id")
        fallback_role = None

        if fallback_key:
            normalized_fallback = normalize_text(fallback_key)
            fallback_role = next((name for name in other_roles if name.lower() == normalized_fallback.lower()), None)
        elif other_roles:
            fallback_role = other_roles[0]

        if fallback_role is None:
            return Response({"detail": "Ne možete obrisati jedinu ulogu."}, status=status.HTTP_400_BAD_REQUEST)

        Waiters.objects.filter(venue=venue, staff_role=role_name).update(staff_role=fallback_role)
        return Response({"ok": True})

    name = normalize_text(request.data.get("name") or role_name)
    worker_ids = request.data.get("workerIds") if "workerIds" in request.data else request.data.get("worker_ids")

    if not name:
        return Response({"detail": "Naziv uloge je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    duplicate_role = any(other_name.lower() == name.lower() for other_name in other_roles)

    if duplicate_role:
        return Response({"detail": "Uloga sa ovim nazivom već postoji."}, status=status.HTTP_400_BAD_REQUEST)

    if worker_ids is None:
        Waiters.objects.filter(venue=venue, staff_role=role_name).update(staff_role=name)
    else:
        Waiters.objects.filter(venue=venue, user_id__in=worker_ids).update(staff_role=name)
        fallback_role = other_roles[0] if other_roles else name
        Waiters.objects.filter(venue=venue, staff_role=role_name).exclude(user_id__in=worker_ids).update(
            staff_role=fallback_role,
        )

    return Response(get_staff_role_dict(venue, name))


STAFF_SHIFT_TYPES = {"Jutarnja", "Popodnevna", "Večernja", "Drugo"}
STAFF_SHIFT_STATUSES = {"confirmed", "pending", "cancelled"}
STAFF_DAY_LABELS = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"]
STAFF_GOAL_LABELS = {
    "revenue": "Cilj prihoda",
    "orders": "Cilj narudžbina",
    "tables": "Cilj stolova",
}


def localize_dt(value):
    if value is None:
        return None

    return timezone.localtime(value) if timezone.is_aware(value) else value


def parse_clock(value, label):
    try:
        parsed_clock = datetime.strptime(str(value or "").strip(), "%H:%M").time()
    except ValueError:
        return None, Response({"detail": f"{label} mora biti u formatu HH:MM."}, status=status.HTTP_400_BAD_REQUEST)

    return parsed_clock, None


def make_shift_datetime(day, clock):
    value = datetime.combine(day, clock)

    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())

    return value


def get_sector_by_key(venue, value):
    key = normalize_text(value)

    if not key:
        return None

    return (
        VenueSectors.objects.filter(venue=venue, active=1)
        .filter(Q(id=key) | Q(name__iexact=key))
        .first()
    )


def serialize_staff_shift(shift):
    start_dt = localize_dt(shift.shift_start)
    end_dt = localize_dt(shift.shift_end) if shift.shift_end else None
    day = start_dt.date()
    end_time = end_dt.strftime("%H:%M") if end_dt else ""
    start_time = start_dt.strftime("%H:%M")

    return {
        "id": shift.id,
        "day": STAFF_DAY_LABELS[start_dt.weekday()],
        "date": day.strftime("%d.%m."),
        "inputDate": day.isoformat(),
        "startTime": start_time,
        "endTime": end_time,
        "time": f"{start_time} - {end_time}" if end_time else start_time,
        "sector": shift.sector.name if shift.sector_id else "Nije dodeljen sektor",
        "type": shift.shift_type if shift.shift_type in STAFF_SHIFT_TYPES else "Drugo",
        "status": "pending" if shift.status == "pending" else "confirmed",
    }


def parse_staff_shift_payload(venue, data):
    day = parse_date(str(data.get("date") or data.get("inputDate") or ""))

    if day is None:
        return None, Response({"detail": "Datum smene mora biti u formatu YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

    start_clock, start_error = parse_clock(data.get("startTime") or data.get("start_time"), "Početak smene")
    if start_error:
        return None, start_error

    end_clock, end_error = parse_clock(data.get("endTime") or data.get("end_time"), "Kraj smene")
    if end_error:
        return None, end_error

    start_dt = make_shift_datetime(day, start_clock)
    end_dt = make_shift_datetime(day, end_clock)

    if end_dt <= start_dt:
        end_dt += timedelta(days=1)

    shift_type = normalize_text(data.get("type") or data.get("shiftType") or data.get("shift_type") or "Jutarnja")
    if shift_type not in STAFF_SHIFT_TYPES:
        shift_type = "Drugo"

    shift_status = normalize_text(data.get("status") or "confirmed") or "confirmed"
    if shift_status not in STAFF_SHIFT_STATUSES:
        shift_status = "confirmed"

    sector = get_sector_by_key(venue, data.get("sector") or data.get("sector_id"))

    return {
        "sector": sector,
        "shift_type": shift_type,
        "status": shift_status,
        "shift_start": start_dt,
        "shift_end": end_dt,
        "note": normalize_text(data.get("note")) or None,
    }, None


def get_active_table_sessions_for_waiter(venue, waiter):
    session_map = {}

    direct_sessions = TableSessions.objects.select_related("table", "table__sector").filter(
        table__sector__venue=venue,
        current_waiter=waiter,
        status__in=["active", "waiting_payment"],
    )

    assigned_sessions = TableSessions.objects.select_related("table", "table__sector").filter(
        table__sector__venue=venue,
        id__in=TableAssignments.objects.filter(
            waiter=waiter,
            assigned_to__isnull=True,
        ).values_list("table_session_id", flat=True),
        status__in=["active", "waiting_payment"],
    )

    for session in list(direct_sessions) + list(assigned_sessions):
        session_map[session.id] = session

    return list(session_map.values())


def get_table_session_current_bill(session):
    total = (
        OrderItems.objects.filter(order__table_session=session)
        .exclude(order__status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
        .exclude(status__in=ANALYTICS_ITEM_EXCLUDED_STATUSES)
        .aggregate(total=Sum("total_price"))["total"]
    )

    return to_money(total or Decimal("0"))


def map_table_status(session):
    if session.status == "waiting_payment":
        return "waiting"
    if session.status == "closed":
        return "closed"
    if session.table.status == "reserved":
        return "reserved"
    return "active"


def get_staff_tables_payload(venue, waiter):
    sessions = get_active_table_sessions_for_waiter(venue, waiter)
    result = []

    for session in sessions:
        opened_at = localize_dt(session.opened_at)
        result.append(
            {
                "id": session.id,
                "tableNumber": session.table.table_number,
                "sector": session.table.sector.name,
                "status": map_table_status(session),
                "guests": session.table.capacity,
                "currentBill": get_table_session_current_bill(session),
                "openedAt": opened_at.strftime("%H:%M") if opened_at else "—",
            }
        )

    return result


def get_staff_schedule_payload(venue, waiter):
    today = timezone.localdate()
    shifts = WaiterShifts.objects.select_related("sector").filter(
        venue=venue,
        waiter=waiter,
        shift_start__date__gte=today,
    ).exclude(status="cancelled").order_by("shift_start")[:20]

    return [serialize_staff_shift(shift) for shift in shifts]


def get_staff_schedule_history_payload(venue, waiter):
    today = timezone.localdate()
    shifts = WaiterShifts.objects.select_related("sector").filter(
        venue=venue,
        waiter=waiter,
        shift_start__date__lt=today,
    ).exclude(status="cancelled").order_by("-shift_start")[:20]

    return [serialize_staff_shift(shift) for shift in shifts]


def get_staff_performance_points(venue, waiter, days=7):
    today = timezone.localdate()
    result = []

    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        start_dt = make_local_datetime(day)
        end_dt = make_local_datetime(day + timedelta(days=1))
        result.append(
            {
                "label": STAFF_DAY_LABELS[day.weekday()][:3],
                "revenue": to_money(get_waiter_revenue(venue, waiter, start_dt, end_dt)),
                "orders": get_waiter_orders_count(venue, waiter, start_dt, end_dt),
                "tables": get_waiter_tables_count(venue, waiter, start_dt, end_dt),
            }
        )

    return result


def get_staff_top_items_payload(venue, waiter, days=30, limit=10):
    today = timezone.localdate()
    start_dt = make_local_datetime(today - timedelta(days=days - 1))
    end_dt = make_local_datetime(today + timedelta(days=1))
    rows = (
        OrderItems.objects.filter(
            order__table_session__table__sector__venue=venue,
            order__created_at__gte=start_dt,
            order__created_at__lt=end_dt,
        )
        .filter(Q(order__created_by_waiter=waiter) | Q(order__approved_by_waiter=waiter))
        .exclude(order__status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
        .exclude(status__in=ANALYTICS_ITEM_EXCLUDED_STATUSES)
        .values("menu_item_id", "menu_item__name", "menu_item__category__name")
        .annotate(quantity=Sum("quantity"), revenue=Sum("total_price"))
        .order_by("-revenue", "-quantity")[:limit]
    )

    return [
        {
            "id": row["menu_item_id"],
            "name": row["menu_item__name"],
            "category": row["menu_item__category__name"],
            "quantity": row["quantity"] or 0,
            "revenue": to_money(row["revenue"] or Decimal("0")),
        }
        for row in rows
    ]


def serialize_staff_goal_summary(goal, venue, waiter):
    period_info = {
        "start_date": goal.period_start,
        "end_date": goal.period_end,
        "start": make_local_datetime(goal.period_start),
        "end": make_local_datetime(goal.period_end + timedelta(days=1)),
    }
    revenue = get_waiter_revenue(venue, waiter, period_info["start"], period_info["end"])
    orders_count = get_waiter_orders_count(venue, waiter, period_info["start"], period_info["end"])
    tables_count = get_waiter_tables_count(venue, waiter, period_info["start"], period_info["end"])
    serialized_goal = serialize_goal_for_waiter(goal, waiter, revenue, orders_count, tables_count)

    return {
        "id": serialized_goal["id"],
        "label": STAFF_GOAL_LABELS.get(goal.target_metric, "Cilj"),
        "metric": goal.target_metric,
        "targetValue": serialized_goal["target"],
        "currentValue": serialized_goal["progress"],
        "startDate": serialized_goal["period_start"],
        "endDate": serialized_goal["period_end"],
        "bonus": serialized_goal["bonus"],
    }


def get_staff_goals_payload(venue, waiter):
    today = timezone.localdate()
    goals = WaiterRevenueGoals.objects.filter(
        venue=venue,
        period_start__lte=today + timedelta(days=365),
        period_end__gte=today - timedelta(days=365),
    ).order_by("-created_at")

    return [serialize_staff_goal_summary(goal, venue, waiter) for goal in goals if goal_applies_to_waiter(goal, waiter)][:10]


def get_staff_details_payload(venue, waiter):
    return {
        "profile": StaffMemberSerializer(waiter).data,
        "tables": get_staff_tables_payload(venue, waiter),
        "schedule": get_staff_schedule_payload(venue, waiter),
        "scheduleHistory": get_staff_schedule_history_payload(venue, waiter),
        "performance": get_staff_performance_points(venue, waiter),
        "topItems": get_staff_top_items_payload(venue, waiter),
        "goals": get_staff_goals_payload(venue, waiter),
    }


@api_view(["GET"])
def staff_details(request, worker_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    waiter, waiter_error = get_waiter_for_owner_or_404(venue, worker_id)

    if waiter_error:
        return waiter_error

    return Response(get_staff_details_payload(venue, waiter))


@api_view(["POST"])
def staff_shifts_list(request, worker_id):
    user, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    waiter, waiter_error = get_waiter_for_owner_or_404(venue, worker_id)

    if waiter_error:
        return waiter_error

    values, values_error = parse_staff_shift_payload(venue, request.data)

    if values_error:
        return values_error

    shift = WaiterShifts.objects.create(
        id=create_id("shift"),
        waiter=waiter,
        venue=venue,
        sector=values["sector"],
        shift_type=values["shift_type"],
        status=values["status"],
        shift_start=values["shift_start"],
        shift_end=values["shift_end"],
        note=values["note"],
        created_by=user,
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )

    return Response(serialize_staff_shift(shift), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
def staff_shift_detail(request, worker_id, shift_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    waiter, waiter_error = get_waiter_for_owner_or_404(venue, worker_id)

    if waiter_error:
        return waiter_error

    shift = get_object_or_404(WaiterShifts, pk=shift_id, venue=venue, waiter=waiter)

    if request.method == "DELETE":
        shift.status = "cancelled"
        shift.updated_at = timezone.now()
        shift.save(update_fields=["status", "updated_at"])
        return Response({"ok": True})

    values, values_error = parse_staff_shift_payload(venue, request.data)

    if values_error:
        return values_error

    shift.sector = values["sector"]
    shift.shift_type = values["shift_type"]
    shift.status = values["status"]
    shift.shift_start = values["shift_start"]
    shift.shift_end = values["shift_end"]
    shift.note = values["note"]
    shift.updated_at = timezone.now()
    shift.save()

    return Response(serialize_staff_shift(shift))


@api_view(["GET", "POST"])
# SSU16 - Autor: Boško Trifunović ([student ID omitted]), upravljanje menijem
def menu_categories_list(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    if request.method == "GET":
        categories = MenuCategories.objects.filter(
            venue=venue,
            deleted_at__isnull=True,
            active=1,
        ).order_by("display_order", "name")

        return Response(MenuCategorySerializer(categories, many=True).data)

    name = str(request.data.get("name", "")).strip()

    if not name:
        return Response({"detail": "Naziv kategorije je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            category = MenuCategories.objects.create(
                id=create_id("category"),
                venue=venue,
                name=name,
                emoji=str(request.data.get("emoji") or "🍽️").strip(),
                description=request.data.get("description") or None,
                display_order=int(request.data.get("display_order") or 0),
                active=get_bool(request.data.get("active"), True),
            )

            item_ids = request.data.get("item_ids") or []

            if item_ids:
                MenuItems.objects.filter(id__in=item_ids, category__venue=venue).update(category=category)

            return serialize_category(category, status.HTTP_201_CREATED)
    except IntegrityError:
        return Response(
            {"detail": "Kategorija sa ovim nazivom već postoji."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["PATCH", "DELETE"])
def menu_category_detail(request, category_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    category = get_object_or_404(MenuCategories, pk=category_id, venue=venue, deleted_at__isnull=True)

    if request.method == "DELETE":
        fallback_category_id = request.data.get("fallback_category_id")

        if not fallback_category_id:
            return Response(
                {"detail": "Potrebna je rezervna kategorija za postojeće stavke."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fallback_category = get_object_or_404(
            MenuCategories,
            pk=fallback_category_id,
            venue=venue,
            deleted_at__isnull=True,
            active=1,
        )

        if fallback_category.id == category.id:
            return Response(
                {"detail": "Rezervna kategorija ne može biti ista kao obrisana kategorija."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            MenuItems.objects.filter(category=category).update(category=fallback_category)
            category.active = 0
            category.deleted_at = timezone.now()
            category.save(update_fields=["active", "deleted_at"])

        return Response({"ok": True})

    name = request.data.get("name")

    if name is not None:
        normalized_name = str(name).strip()

        if not normalized_name:
            return Response({"detail": "Naziv kategorije je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

        category.name = normalized_name

    if "emoji" in request.data:
        category.emoji = str(request.data.get("emoji") or "🍽️").strip()

    if "description" in request.data:
        category.description = request.data.get("description") or None

    if "display_order" in request.data:
        category.display_order = int(request.data.get("display_order") or 0)

    if "active" in request.data:
        category.active = get_bool(request.data.get("active"), True)

    try:
        with transaction.atomic():
            category.updated_at = timezone.now()
            category.save()

            item_ids = request.data.get("item_ids")

            if item_ids is not None:
                fallback_category_id = request.data.get("fallback_category_id")

                MenuItems.objects.filter(id__in=item_ids, category__venue=venue).update(category=category)

                if fallback_category_id:
                    MenuItems.objects.filter(category=category).exclude(id__in=item_ids).update(
                        category_id=fallback_category_id,
                    )

            return serialize_category(category)
    except IntegrityError:
        return Response(
            {"detail": "Kategorija sa ovim nazivom već postoji."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET", "POST"])
def menu_items_list(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    if request.method == "GET":
        items = MenuItems.objects.filter(category__venue=venue).order_by("name")

        return Response(MenuItemSerializer(items, many=True).data)

    category_id = request.data.get("category")

    if not category_id:
        return Response({"detail": "Kategorija je obavezna."}, status=status.HTTP_400_BAD_REQUEST)

    category = get_object_or_404(MenuCategories, pk=category_id, venue=venue, deleted_at__isnull=True)
    name = str(request.data.get("name", "")).strip()

    if not name:
        return Response({"detail": "Naziv stavke je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        image = get_clean_image(request.data.get("image"))
    except ValueError as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            item = MenuItems.objects.create(
                id=create_id("menu-item"),
                category=category,
                name=name,
                description=request.data.get("description") or None,
                composition=request.data.get("composition") or None,
                price=get_decimal(request.data.get("price")),
                image=image,
                estimated_preparation_minutes=request.data.get("estimated_preparation_minutes"),
                active=get_bool(request.data.get("active"), True),
                available=get_bool(request.data.get("available"), True),
            )

            sync_option_groups(item, request.data.get("option_groups") or [])

            return serialize_item(item, status.HTTP_201_CREATED)
    except IntegrityError:
        return Response(
            {"detail": "Stavka sa ovim nazivom već postoji u izabranoj kategoriji."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except DataError:
        return Response(
            {"detail": "Neki podatak je predugačak za čuvanje u bazi."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["PATCH", "DELETE"])
def menu_item_detail(request, item_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    item = get_object_or_404(MenuItems, pk=item_id, category__venue=venue)

    if request.method == "DELETE":
        try:
            item.delete()
            return Response({"ok": True})
        except IntegrityError:
            return Response(
                {"detail": "Stavka ne može da se obriše jer postoji u porudžbinama."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if "category" in request.data:
        item.category = get_object_or_404(
            MenuCategories,
            pk=request.data.get("category"),
            venue=venue,
            deleted_at__isnull=True,
        )

    if "name" in request.data:
        name = str(request.data.get("name", "")).strip()

        if not name:
            return Response({"detail": "Naziv stavke je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

        item.name = name

    if "description" in request.data:
        item.description = request.data.get("description") or None

    if "composition" in request.data:
        item.composition = request.data.get("composition") or None

    if "price" in request.data:
        item.price = get_decimal(request.data.get("price"))

    if "image" in request.data:
        try:
            item.image = get_clean_image(request.data.get("image"))
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

    if "estimated_preparation_minutes" in request.data:
        item.estimated_preparation_minutes = request.data.get("estimated_preparation_minutes")

    if "active" in request.data:
        item.active = get_bool(request.data.get("active"), True)

    if "available" in request.data:
        item.available = get_bool(request.data.get("available"), True)

    try:
        with transaction.atomic():
            item.save()

            if "option_groups" in request.data:
                sync_option_groups(item, request.data.get("option_groups") or [])

            return serialize_item(item)
    except IntegrityError:
        return Response(
            {"detail": "Stavka sa ovim nazivom već postoji u izabranoj kategoriji."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except DataError:
        return Response(
            {"detail": "Neki podatak je predugačak za čuvanje u bazi."},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(["GET"])
# SSU17 - Autor: Boško Trifunović ([student ID omitted]), mapa lokala
def venue_map_snapshot(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    return serialize_venue_map(venue)


@api_view(["PATCH"])
def venue_floor_detail(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    floor = str(request.data.get("floor") or request.data.get("floor_type") or "").strip()

    if floor not in VALID_FLOORS:
        return Response({"detail": "Nepoznat tip poda."}, status=status.HTTP_400_BAD_REQUEST)

    venue.floor_type = floor
    venue.updated_at = timezone.now()
    venue.save(update_fields=["floor_type", "updated_at"])

    return Response(VenueSerializer(venue).data)


@api_view(["GET", "POST"])
def venue_sectors_list(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    if request.method == "GET":
        sectors = VenueSectors.objects.filter(venue=venue, active=1).order_by("display_order", "name")
        return Response(VenueSectorSerializer(sectors, many=True).data)

    name = str(request.data.get("name", "")).strip()

    if not name:
        return Response({"detail": "Naziv sektora je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            sector_count = VenueSectors.objects.filter(venue=venue, active=1).count()
            sector = VenueSectors.objects.create(
                id=create_id("sector"),
                venue=venue,
                name=name,
                emoji=str(request.data.get("emoji") or request.data.get("icon") or "☷").strip(),
                description=request.data.get("description") or None,
                position_x=get_decimal(request.data.get("x"), str(40 + (sector_count % 3) * 560)),
                position_y=get_decimal(request.data.get("y"), str(40 + (sector_count // 3) * 360)),
                width=get_decimal(request.data.get("width"), "520"),
                height=get_decimal(request.data.get("height"), "300"),
                display_order=get_int(request.data.get("display_order"), sector_count),
                active=1,
            )

            table_ids = request.data.get("table_ids") or []
            if table_ids:
                VenueTables.objects.filter(id__in=table_ids, sector__venue=venue).update(sector=sector)

            return Response(VenueSectorSerializer(sector).data, status=status.HTTP_201_CREATED)
    except IntegrityError:
        return Response({"detail": "Sektor sa ovim nazivom već postoji."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH", "DELETE"])
def venue_sector_detail(request, sector_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    sector = get_object_or_404(VenueSectors, pk=sector_id, venue=venue, active=1)

    if request.method == "DELETE":
        sectors_count = VenueSectors.objects.filter(venue=venue, active=1).count()

        if sectors_count <= 1:
            return Response({"detail": "Ne možeš obrisati jedini sektor u lokalu."}, status=status.HTTP_400_BAD_REQUEST)

        sector_tables = VenueTables.objects.filter(sector=sector, active=1)
        if sector_tables.filter(status__in=BLOCKING_TABLE_STATUSES).exists():
            return Response(
                {"detail": "Sektor sadrži sto sa aktivnom narudžbinom. Prvo zatvori sto."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fallback_sector_id = request.data.get("fallback_sector_id")
        fallback_sector = None

        if fallback_sector_id:
            fallback_sector = get_object_or_404(VenueSectors, pk=fallback_sector_id, venue=venue, active=1)
        else:
            fallback_sector = VenueSectors.objects.filter(venue=venue, active=1).exclude(id=sector.id).first()

        if fallback_sector is None:
            return Response({"detail": "Nije pronađen rezervni sektor."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            sector_tables.update(sector=fallback_sector)
            sector.active = 0
            sector.save(update_fields=["active"])

        return Response({"ok": True})

    if "name" in request.data:
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"detail": "Naziv sektora je obavezan."}, status=status.HTTP_400_BAD_REQUEST)
        sector.name = name

    if "emoji" in request.data or "icon" in request.data:
        sector.emoji = str(request.data.get("emoji") or request.data.get("icon") or "☷").strip()

    if "description" in request.data:
        sector.description = request.data.get("description") or None

    if "x" in request.data:
        sector.position_x = get_decimal(request.data.get("x"))

    if "y" in request.data:
        sector.position_y = get_decimal(request.data.get("y"))

    if "width" in request.data:
        sector.width = max(get_decimal(request.data.get("width")), Decimal("260"))

    if "height" in request.data:
        sector.height = max(get_decimal(request.data.get("height")), Decimal("190"))

    if "display_order" in request.data:
        sector.display_order = get_int(request.data.get("display_order"), sector.display_order)

    try:
        with transaction.atomic():
            sector.save()

            table_ids = request.data.get("table_ids")
            if table_ids is not None:
                fallback_sector_id = request.data.get("fallback_sector_id")
                VenueTables.objects.filter(id__in=table_ids, sector__venue=venue).update(sector=sector)

                if fallback_sector_id:
                    VenueTables.objects.filter(sector=sector).exclude(id__in=table_ids).update(
                        sector_id=fallback_sector_id,
                    )

            return Response(VenueSectorSerializer(sector).data)
    except IntegrityError:
        return Response({"detail": "Sektor sa ovim nazivom već postoji."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
def venue_tables_list(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    if request.method == "GET":
        tables = VenueTables.objects.filter(sector__venue=venue, active=1).order_by("sector_id", "table_number")
        return Response(VenueTableSerializer(tables, many=True).data)

    sector_id = request.data.get("sector") or request.data.get("sector_id")
    if not sector_id:
        return Response({"detail": "Sektor je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    sector = get_object_or_404(VenueSectors, pk=sector_id, venue=venue, active=1)
    number = str(request.data.get("number") or request.data.get("table_number") or "").strip()

    if not number:
        return Response({"detail": "Broj stola je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    seats = get_int(request.data.get("seats") or request.data.get("capacity"), 0)
    if seats < 1 or seats > 12:
        return Response({"detail": "Broj mesta mora biti između 1 i 12."}, status=status.HTTP_400_BAD_REQUEST)

    shape = str(request.data.get("shape") or "round").strip()
    if shape not in VALID_TABLE_SHAPES:
        return Response({"detail": "Nepoznat oblik stola."}, status=status.HTTP_400_BAD_REQUEST)

    if VenueTables.objects.filter(sector=sector, table_number__iexact=number, active=1).exists():
        return Response({"detail": "Broj ovog stola već postoji u ovom sektoru."}, status=status.HTTP_400_BAD_REQUEST)

    table_id = create_id("table")
    qr_token = uuid4().hex

    try:
        table = VenueTables.objects.create(
            id=table_id,
            sector=sector,
            table_number=number,
            capacity=seats,
            shape=shape,
            status="free",
            position_x=get_decimal(request.data.get("x"), "24"),
            position_y=get_decimal(request.data.get("y"), "24"),
            width=request.data.get("width") or None,
            height=request.data.get("height") or None,
            qr_token=qr_token,
            qr_url=f"/qr/{table_id}",
            qr_generated_at=timezone.now(),
            active=1,
        )
        return Response(VenueTableSerializer(table).data, status=status.HTTP_201_CREATED)
    except IntegrityError:
        return Response({"detail": "Broj ovog stola već postoji u ovom sektoru."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["PATCH", "DELETE"])
def venue_table_detail(request, table_id):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    table = get_object_or_404(VenueTables, pk=table_id, sector__venue=venue, active=1)

    if request.method == "DELETE":
        if table.status in BLOCKING_TABLE_STATUSES:
            return Response(
                {"detail": "Sto nije moguće obrisati dok postoji aktivna narudžbina."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        table.active = 0
        table.status = "inactive"
        table.save(update_fields=["active", "status"])
        return Response({"ok": True})

    if "sector" in request.data or "sector_id" in request.data:
        sector_id = request.data.get("sector") or request.data.get("sector_id")
        table.sector = get_object_or_404(VenueSectors, pk=sector_id, venue=venue, active=1)

    if "number" in request.data or "table_number" in request.data:
        number = str(request.data.get("number") or request.data.get("table_number") or "").strip()
        if not number:
            return Response({"detail": "Broj stola je obavezan."}, status=status.HTTP_400_BAD_REQUEST)
        table.table_number = number

    if "seats" in request.data or "capacity" in request.data:
        seats = get_int(request.data.get("seats") or request.data.get("capacity"), 0)
        if seats < 1 or seats > 12:
            return Response({"detail": "Broj mesta mora biti između 1 i 12."}, status=status.HTTP_400_BAD_REQUEST)
        table.capacity = seats

    if "shape" in request.data:
        shape = str(request.data.get("shape") or "").strip()
        if shape not in VALID_TABLE_SHAPES:
            return Response({"detail": "Nepoznat oblik stola."}, status=status.HTTP_400_BAD_REQUEST)
        table.shape = shape

    if "x" in request.data:
        table.position_x = get_decimal(request.data.get("x"))

    if "y" in request.data:
        table.position_y = get_decimal(request.data.get("y"))

    if "width" in request.data:
        table.width = request.data.get("width") or None

    if "height" in request.data:
        table.height = request.data.get("height") or None

    if "status" in request.data:
        table.status = str(request.data.get("status") or table.status).strip()

    if VenueTables.objects.filter(
        sector=table.sector,
        table_number__iexact=table.table_number,
        active=1,
    ).exclude(id=table.id).exists():
        return Response({"detail": "Broj ovog stola već postoji u ovom sektoru."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        table.save()
        return Response(VenueTableSerializer(table).data)
    except IntegrityError:
        return Response({"detail": "Broj ovog stola već postoji u ovom sektoru."}, status=status.HTTP_400_BAD_REQUEST)


ANALYTICS_ORDER_EXCLUDED_STATUSES = {"draft", "rejected", "cancelled"}
ANALYTICS_ITEM_EXCLUDED_STATUSES = {"rejected", "cancelled"}
ANALYTICS_GOAL_MODES = {"all", "single", "multiple"}
ANALYTICS_GOAL_METRICS = {"revenue", "orders", "tables"}


# SSU19 - Autor: Boško Trifunović ([student ID omitted]), analitika i KPI
def to_money(value):
    return round(float(value or 0), 2)


def to_number(value):
    return float(value or 0)


def percent_change(current, previous):
    current_value = float(current or 0)
    previous_value = float(previous or 0)

    if previous_value == 0:
        return None if current_value == 0 else 100

    return round(((current_value - previous_value) / previous_value) * 100, 1)


def make_local_datetime(day, end_of_day=False):
    clock = time.max if end_of_day else time.min
    value = datetime.combine(day, clock)

    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())

    return value


def parse_analytics_period(request):
    period = str(request.query_params.get("period") or "today").strip().lower()
    today = timezone.localdate()

    if period == "week":
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=6)
    elif period == "month":
        start_date = today.replace(day=1)
        if start_date.month == 12:
            next_month = start_date.replace(year=start_date.year + 1, month=1, day=1)
        else:
            next_month = start_date.replace(month=start_date.month + 1, day=1)
        end_date = next_month - timedelta(days=1)
    elif period in {"7d", "last7"}:
        start_date = today - timedelta(days=6)
        end_date = today
    elif period in {"30d", "last30"}:
        start_date = today - timedelta(days=29)
        end_date = today
    elif period == "custom":
        start_date = parse_date(str(request.query_params.get("start") or ""))
        end_date = parse_date(str(request.query_params.get("end") or ""))

        if start_date is None or end_date is None:
            return None, Response(
                {"detail": "Za custom period pošalji start i end u formatu YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        period = "today"
        start_date = today
        end_date = today

    if end_date < start_date:
        return None, Response({"detail": "Krajnji datum ne može biti pre početnog."}, status=status.HTTP_400_BAD_REQUEST)

    start_dt = make_local_datetime(start_date)
    end_dt = make_local_datetime(end_date + timedelta(days=1))
    days_count = (end_date - start_date).days + 1
    group_by = "hour" if days_count <= 2 else "day"

    previous_end_date = start_date - timedelta(days=1)
    previous_start_date = previous_end_date - timedelta(days=days_count - 1)

    return {
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "start": start_dt,
        "end": end_dt,
        "previous_start": make_local_datetime(previous_start_date),
        "previous_end": make_local_datetime(previous_end_date + timedelta(days=1)),
        "group_by": group_by,
        "days_count": days_count,
    }, None


def get_payment_date_q(start_dt, end_dt):
    return Q(confirmed_at__gte=start_dt, confirmed_at__lt=end_dt) | Q(
        confirmed_at__isnull=True,
        created_at__gte=start_dt,
        created_at__lt=end_dt,
    )


def get_paid_payments_queryset(venue, start_dt, end_dt):
    venue_filter = Q(bill__table_session__table__sector__venue=venue) | Q(reservation__venue=venue)

    return Payments.objects.filter(status="paid").filter(venue_filter).filter(get_payment_date_q(start_dt, end_dt))


def get_orders_queryset(venue, start_dt, end_dt):
    return (
        Orders.objects.filter(
            table_session__table__sector__venue=venue,
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        .exclude(status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
    )


def get_order_items_queryset(venue, start_dt, end_dt):
    return (
        OrderItems.objects.filter(
            order__table_session__table__sector__venue=venue,
            order__created_at__gte=start_dt,
            order__created_at__lt=end_dt,
        )
        .exclude(order__status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
        .exclude(status__in=ANALYTICS_ITEM_EXCLUDED_STATUSES)
    )


def get_period_payload(period_info):
    return {
        "period": period_info["period"],
        "start": period_info["start_date"].isoformat(),
        "end": period_info["end_date"].isoformat(),
        "group_by": period_info["group_by"],
    }


def get_revenue_total(venue, start_dt, end_dt):
    return get_paid_payments_queryset(venue, start_dt, end_dt).aggregate(total=Sum("amount"))["total"] or Decimal("0")


def get_analytics_summary(venue, period_info):
    payments = get_paid_payments_queryset(venue, period_info["start"], period_info["end"])
    orders = get_orders_queryset(venue, period_info["start"], period_info["end"])
    revenue = payments.aggregate(total=Sum("amount"))["total"] or Decimal("0")
    previous_revenue = get_revenue_total(venue, period_info["previous_start"], period_info["previous_end"])
    orders_count = orders.count()
    previous_orders_count = get_orders_queryset(venue, period_info["previous_start"], period_info["previous_end"]).count()
    active_tables = TableSessions.objects.filter(table__sector__venue=venue, status__in=["active", "waiting_payment"]).count()
    closed_tables = TableSessions.objects.filter(
        table__sector__venue=venue,
        closed_at__gte=period_info["start"],
        closed_at__lt=period_info["end"],
        status="closed",
    ).count()
    average_order_value = Decimal("0") if orders_count == 0 else revenue / Decimal(orders_count)

    return {
        "total_revenue": to_money(revenue),
        "revenue_change_percent": percent_change(revenue, previous_revenue),
        "orders_count": orders_count,
        "orders_change_percent": percent_change(orders_count, previous_orders_count),
        "average_order_value": to_money(average_order_value),
        "paid_payments_count": payments.count(),
        "active_tables_count": active_tables,
        "closed_tables_count": closed_tables,
        "has_data": revenue > 0 or orders_count > 0 or closed_tables > 0,
    }


def get_payment_bucket(payment, group_by):
    raw_dt = payment.confirmed_at or payment.created_at
    local_dt = timezone.localtime(raw_dt) if timezone.is_aware(raw_dt) else raw_dt

    if group_by == "hour":
        return local_dt.replace(minute=0, second=0, microsecond=0)

    return local_dt.date()


def get_order_bucket(order, group_by):
    raw_dt = order.created_at
    local_dt = timezone.localtime(raw_dt) if timezone.is_aware(raw_dt) else raw_dt

    if group_by == "hour":
        return local_dt.replace(minute=0, second=0, microsecond=0)

    return local_dt.date()


def format_series_bucket(bucket, group_by):
    if group_by == "hour":
        return {
            "label": bucket.strftime("%H:00"),
            "date": bucket.date().isoformat(),
            "hour": bucket.hour,
        }

    return {
        "label": bucket.strftime("%d.%m."),
        "date": bucket.isoformat(),
        "hour": None,
    }


def build_empty_buckets(period_info):
    buckets = []

    if period_info["group_by"] == "hour":
        cursor = period_info["start"]
        while cursor < period_info["end"]:
            buckets.append(cursor)
            cursor += timedelta(hours=1)
    else:
        cursor = period_info["start_date"]
        while cursor <= period_info["end_date"]:
            buckets.append(cursor)
            cursor += timedelta(days=1)

    return buckets


def get_revenue_series(venue, period_info):
    buckets = {
        bucket: {"revenue": Decimal("0"), "orders": 0}
        for bucket in build_empty_buckets(period_info)
    }

    payments = get_paid_payments_queryset(venue, period_info["start"], period_info["end"]).only(
        "amount",
        "confirmed_at",
        "created_at",
    )
    for payment in payments:
        bucket = get_payment_bucket(payment, period_info["group_by"])
        if bucket in buckets:
            buckets[bucket]["revenue"] += payment.amount or Decimal("0")

    orders = get_orders_queryset(venue, period_info["start"], period_info["end"]).only("created_at")
    for order in orders:
        bucket = get_order_bucket(order, period_info["group_by"])
        if bucket in buckets:
            buckets[bucket]["orders"] += 1

    result = []
    for bucket in buckets:
        data = format_series_bucket(bucket, period_info["group_by"])
        data["revenue"] = to_money(buckets[bucket]["revenue"])
        data["orders"] = buckets[bucket]["orders"]
        result.append(data)

    return result


def get_top_items(venue, period_info, limit=10):
    items_qs = get_order_items_queryset(venue, period_info["start"], period_info["end"])
    total_revenue = items_qs.aggregate(total=Sum("total_price"))["total"] or Decimal("0")
    rows = (
        items_qs.values("menu_item_id", "menu_item__name", "menu_item__category__name")
        .annotate(quantity_sold=Sum("quantity"), revenue=Sum("total_price"))
        .order_by("-quantity_sold", "-revenue")[:limit]
    )

    result = []
    for row in rows:
        revenue = row["revenue"] or Decimal("0")
        share = 0 if total_revenue == 0 else round((float(revenue) / float(total_revenue)) * 100, 1)
        result.append(
            {
                "id": row["menu_item_id"],
                "name": row["menu_item__name"],
                "category": row["menu_item__category__name"],
                "quantity_sold": row["quantity_sold"] or 0,
                "revenue": to_money(revenue),
                "share_percent": share,
            }
        )

    return result


def get_occupancy_heatmap(venue, period_info):
    heatmap = {}
    sessions = TableSessions.objects.filter(
        table__sector__venue=venue,
        opened_at__gte=period_info["start"],
        opened_at__lt=period_info["end"],
    ).only("id", "opened_at")

    for session in sessions:
        opened_at = timezone.localtime(session.opened_at) if timezone.is_aware(session.opened_at) else session.opened_at
        key = (opened_at.weekday(), opened_at.hour)
        if key not in heatmap:
            heatmap[key] = {"active_tables": 0, "orders": 0}
        heatmap[key]["active_tables"] += 1

    orders = get_orders_queryset(venue, period_info["start"], period_info["end"]).only("created_at")
    for order in orders:
        created_at = timezone.localtime(order.created_at) if timezone.is_aware(order.created_at) else order.created_at
        key = (created_at.weekday(), created_at.hour)
        if key not in heatmap:
            heatmap[key] = {"active_tables": 0, "orders": 0}
        heatmap[key]["orders"] += 1

    day_labels = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"]
    result = []

    for day in range(7):
        for hour in range(24):
            values = heatmap.get((day, hour), {"active_tables": 0, "orders": 0})
            result.append(
                {
                    "day": day,
                    "day_label": day_labels[day],
                    "hour": hour,
                    "active_tables": values["active_tables"],
                    "orders": values["orders"],
                }
            )

    return result


def get_waiter_orders_count(venue, waiter, start_dt, end_dt):
    return (
        Orders.objects.filter(
            table_session__table__sector__venue=venue,
            created_at__gte=start_dt,
            created_at__lt=end_dt,
        )
        .filter(Q(created_by_waiter=waiter) | Q(approved_by_waiter=waiter))
        .exclude(status__in=ANALYTICS_ORDER_EXCLUDED_STATUSES)
        .distinct()
        .count()
    )


def get_waiter_tables_count(venue, waiter, start_dt, end_dt):
    direct_ids = set(
        TableSessions.objects.filter(
            table__sector__venue=venue,
            current_waiter=waiter,
            opened_at__gte=start_dt,
            opened_at__lt=end_dt,
        ).values_list("id", flat=True)
    )
    assigned_ids = set(
        TableAssignments.objects.filter(
            table_session__table__sector__venue=venue,
            waiter=waiter,
            assigned_from__gte=start_dt,
            assigned_from__lt=end_dt,
        ).values_list("table_session_id", flat=True)
    )

    return len(direct_ids | assigned_ids)


def get_waiter_revenue(venue, waiter, start_dt, end_dt):
    return get_paid_payments_queryset(venue, start_dt, end_dt).filter(waiter=waiter).aggregate(total=Sum("amount"))["total"] or Decimal("0")


def get_waiter_average_rating(venue, waiter, start_dt, end_dt):
    rating = WaiterRatings.objects.filter(
        venue=venue,
        waiter=waiter,
        rated_at__gte=start_dt,
        rated_at__lt=end_dt,
    ).aggregate(value=Avg("rating"))["value"]

    if rating is None:
        rating = waiter.rating

    return round(float(rating or 0), 2)


def goal_applies_to_waiter(goal, waiter):
    if goal.target_mode == "all":
        return True

    if goal.waiter_id == waiter.user_id:
        return True

    if goal.target_mode == "multiple":
        return WaiterGoalMembers.objects.filter(goal=goal, waiter=waiter).exists()

    return False


def get_goal_target_value(goal):
    if goal.target_metric == "orders":
        return goal.target_order_count or 0

    if goal.target_metric == "tables":
        return goal.target_table_count or 0

    return float(goal.target_revenue or 0)


def get_goal_progress_value(goal, revenue, orders_count, tables_count):
    if goal.target_metric == "orders":
        return orders_count

    if goal.target_metric == "tables":
        return tables_count

    return float(revenue or 0)


def serialize_goal_for_waiter(goal, waiter, revenue, orders_count, tables_count):
    target = get_goal_target_value(goal)
    progress = get_goal_progress_value(goal, revenue, orders_count, tables_count)
    percent = 0 if float(target or 0) == 0 else min(round((float(progress) / float(target)) * 100, 1), 999)

    return {
        "id": goal.id,
        "target_mode": goal.target_mode,
        "target_metric": goal.target_metric,
        "period_start": goal.period_start.isoformat(),
        "period_end": goal.period_end.isoformat(),
        "target": target,
        "progress": round(float(progress), 2),
        "progress_percent": percent,
        "completed": float(progress) >= float(target or 0) and float(target or 0) > 0,
        "bonus": goal.bonus or "",
    }


def get_active_goal_for_waiter(venue, waiter, period_info, revenue, orders_count, tables_count):
    goals = WaiterRevenueGoals.objects.filter(
        venue=venue,
        period_start__lte=period_info["end_date"],
        period_end__gte=period_info["start_date"],
    ).order_by("-created_at")

    for goal in goals:
        if goal_applies_to_waiter(goal, waiter):
            return serialize_goal_for_waiter(goal, waiter, revenue, orders_count, tables_count)

    return None


def serialize_waiter_performance(venue, waiter, period_info):
    revenue = get_waiter_revenue(venue, waiter, period_info["start"], period_info["end"])
    orders_count = get_waiter_orders_count(venue, waiter, period_info["start"], period_info["end"])
    tables_count = get_waiter_tables_count(venue, waiter, period_info["start"], period_info["end"])
    average_rating = get_waiter_average_rating(venue, waiter, period_info["start"], period_info["end"])
    goal = get_active_goal_for_waiter(venue, waiter, period_info, revenue, orders_count, tables_count)

    return {
        "id": waiter.user_id,
        "full_name": f"{waiter.user.first_name} {waiter.user.last_name}".strip(),
        "username": waiter.user.username,
        "role": waiter.staff_role,
        "status": "active" if waiter.active == 1 and waiter.user.status == "active" else "inactive",
        "revenue": to_money(revenue),
        "orders_count": orders_count,
        "tables_count": tables_count,
        "average_rating": average_rating,
        "goal": goal,
    }


def get_staff_performance(venue, period_info):
    waiters = (
        Waiters.objects.select_related("user")
        .filter(venue=venue, active=1, user__deleted_at__isnull=True)
        .order_by("user__first_name", "user__last_name")
    )

    return [serialize_waiter_performance(venue, waiter, period_info) for waiter in waiters]


def serialize_goal(goal, venue=None):
    members = []
    if goal.target_mode == "single" and goal.waiter_id:
        members.append(goal.waiter_id)
    elif goal.target_mode == "multiple":
        members = list(WaiterGoalMembers.objects.filter(goal=goal).values_list("waiter_id", flat=True))
    elif goal.target_mode == "all" and venue is not None:
        members = list(Waiters.objects.filter(venue=venue, active=1).values_list("user_id", flat=True))

    return {
        "id": goal.id,
        "targetMode": goal.target_mode,
        "targetMetric": goal.target_metric,
        "waiterId": goal.waiter_id,
        "waiterIds": members,
        "periodStart": goal.period_start.isoformat(),
        "periodEnd": goal.period_end.isoformat(),
        "targetRevenue": to_money(goal.target_revenue),
        "targetOrderCount": goal.target_order_count,
        "targetTableCount": goal.target_table_count,
        "bonus": goal.bonus or "",
        "createdAt": goal.created_at.isoformat() if goal.created_at else None,
        "updatedAt": goal.updated_at.isoformat() if goal.updated_at else None,
    }


def get_analytics_payload(venue, period_info):
    return {
        "period": get_period_payload(period_info),
        "summary": get_analytics_summary(venue, period_info),
        "revenue_series": get_revenue_series(venue, period_info),
        "top_items": get_top_items(venue, period_info),
        "occupancy_heatmap": get_occupancy_heatmap(venue, period_info),
        "staff_performance": get_staff_performance(venue, period_info),
        "goals": [serialize_goal(goal, venue) for goal in WaiterRevenueGoals.objects.filter(venue=venue).order_by("-created_at")[:20]],
    }


def get_owner_analytics_context(request):
    _, venue, auth_response = get_owner_venue_or_response(request)
    if auth_response:
        return None, None, auth_response

    period_info, period_error = parse_analytics_period(request)
    if period_error:
        return None, None, period_error

    return venue, period_info, None


@api_view(["GET"])
def analytics_dashboard(request):
    venue, period_info, error_response = get_owner_analytics_context(request)

    if error_response:
        return error_response

    return Response(get_analytics_payload(venue, period_info))




@api_view(["GET"])
def owner_sidebar_summary(request):
    _, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    active_staff = Waiters.objects.filter(
        venue=venue,
        active=1,
        user__status="active",
        user__deleted_at__isnull=True,
    )

    return Response({
        "menuItemsCount": MenuItems.objects.filter(
            category__venue=venue,
            category__deleted_at__isnull=True,
            active=1,
        ).count(),
        "menuCategoriesCount": MenuCategories.objects.filter(
            venue=venue,
            active=1,
            deleted_at__isnull=True,
        ).count(),
        "venueTablesCount": VenueTables.objects.filter(
            sector__venue=venue,
            active=1,
        ).count(),
        "venueSectorsCount": VenueSectors.objects.filter(
            venue=venue,
            active=1,
        ).count(),
        "staffCount": active_staff.count(),
        "staffRolesCount": active_staff.exclude(staff_role__isnull=True)
            .exclude(staff_role="")
            .values("staff_role")
            .distinct()
            .count(),
    })


@api_view(["GET"])
def analytics_summary(request):
    venue, period_info, error_response = get_owner_analytics_context(request)

    if error_response:
        return error_response

    return Response({"period": get_period_payload(period_info), "summary": get_analytics_summary(venue, period_info)})


@api_view(["GET"])
def analytics_revenue(request):
    venue, period_info, error_response = get_owner_analytics_context(request)

    if error_response:
        return error_response

    return Response({"period": get_period_payload(period_info), "series": get_revenue_series(venue, period_info)})


@api_view(["GET"])
def analytics_top_items(request):
    venue, period_info, error_response = get_owner_analytics_context(request)

    if error_response:
        return error_response

    limit = max(1, min(get_int(request.query_params.get("limit"), 10), 50))
    return Response({"period": get_period_payload(period_info), "items": get_top_items(venue, period_info, limit)})


@api_view(["GET"])
def analytics_occupancy(request):
    venue, period_info, error_response = get_owner_analytics_context(request)

    if error_response:
        return error_response

    return Response({"period": get_period_payload(period_info), "heatmap": get_occupancy_heatmap(venue, period_info)})


@api_view(["GET"])
def analytics_staff(request):
    venue, period_info, error_response = get_owner_analytics_context(request)

    if error_response:
        return error_response

    return Response({"period": get_period_payload(period_info), "staff": get_staff_performance(venue, period_info)})


def get_goal_payload_values(data):
    target_mode = str(data.get("targetMode") or data.get("target_mode") or "single").strip()
    target_metric = str(data.get("targetMetric") or data.get("target_metric") or "revenue").strip()
    waiter_id = data.get("waiterId") or data.get("waiter_id")
    waiter_ids = data.get("waiterIds") if "waiterIds" in data else data.get("waiter_ids")

    if isinstance(waiter_ids, str):
        waiter_ids = [waiter_ids]
    waiter_ids = [str(value).strip() for value in (waiter_ids or []) if str(value).strip()]

    if target_mode not in ANALYTICS_GOAL_MODES:
        return None, Response({"detail": "Nepoznat način dodele cilja."}, status=status.HTTP_400_BAD_REQUEST)

    if target_metric not in ANALYTICS_GOAL_METRICS:
        return None, Response({"detail": "Nepoznata metrika cilja."}, status=status.HTTP_400_BAD_REQUEST)

    if waiter_id and str(waiter_id).strip() not in waiter_ids:
        waiter_ids.insert(0, str(waiter_id).strip())

    if target_mode == "single" and not waiter_ids:
        return None, Response({"detail": "Za pojedinačni cilj izaberi konobara."}, status=status.HTTP_400_BAD_REQUEST)

    if target_mode == "multiple" and not waiter_ids:
        return None, Response({"detail": "Za grupni cilj izaberi bar jednog konobara."}, status=status.HTTP_400_BAD_REQUEST)

    period_start = parse_date(str(data.get("periodStart") or data.get("period_start") or ""))
    period_end = parse_date(str(data.get("periodEnd") or data.get("period_end") or ""))

    if period_start is None or period_end is None:
        return None, Response({"detail": "Period cilja mora imati periodStart i periodEnd u formatu YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

    if period_end < period_start:
        return None, Response({"detail": "Kraj perioda cilja ne može biti pre početka."}, status=status.HTTP_400_BAD_REQUEST)

    target_revenue = get_decimal(data.get("targetRevenue") or data.get("target_revenue"), "0")
    target_order_count = data.get("targetOrderCount") if "targetOrderCount" in data else data.get("target_order_count")
    target_table_count = data.get("targetTableCount") if "targetTableCount" in data else data.get("target_table_count")

    values = {
        "target_mode": target_mode,
        "target_metric": target_metric,
        "waiter_ids": waiter_ids,
        "period_start": period_start,
        "period_end": period_end,
        "target_revenue": target_revenue,
        "target_order_count": get_int(target_order_count, 0) if target_order_count is not None else None,
        "target_table_count": get_int(target_table_count, 0) if target_table_count is not None else None,
        "bonus": normalize_text(data.get("bonus")) or None,
    }

    if target_metric == "revenue" and target_revenue <= 0:
        return None, Response({"detail": "Ciljni prihod mora biti veći od nule."}, status=status.HTTP_400_BAD_REQUEST)

    if target_metric == "orders" and not values["target_order_count"]:
        return None, Response({"detail": "Ciljni broj narudžbina mora biti veći od nule."}, status=status.HTTP_400_BAD_REQUEST)

    if target_metric == "tables" and not values["target_table_count"]:
        return None, Response({"detail": "Ciljni broj stolova mora biti veći od nule."}, status=status.HTTP_400_BAD_REQUEST)

    return values, None


def validate_goal_waiters(venue, waiter_ids):
    if not waiter_ids:
        return []

    waiters = list(Waiters.objects.filter(venue=venue, user_id__in=waiter_ids, active=1))
    found_ids = {waiter.user_id for waiter in waiters}
    missing = [waiter_id for waiter_id in waiter_ids if waiter_id not in found_ids]

    if missing:
        return None

    return waiters


@api_view(["GET", "POST"])
def analytics_goals_list(request):
    user, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    if request.method == "GET":
        goals = WaiterRevenueGoals.objects.filter(venue=venue).order_by("-created_at")
        return Response({"goals": [serialize_goal(goal, venue) for goal in goals]})

    values, values_error = get_goal_payload_values(request.data)
    if values_error:
        return values_error

    waiters = validate_goal_waiters(venue, values["waiter_ids"])
    if waiters is None:
        return Response({"detail": "Neki izabrani konobar ne postoji u ovom lokalu."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            goal = WaiterRevenueGoals.objects.create(
                id=create_id("goal"),
                waiter=waiters[0] if values["target_mode"] == "single" and waiters else None,
                venue=venue,
                target_mode=values["target_mode"],
                target_metric=values["target_metric"],
                period_start=values["period_start"],
                period_end=values["period_end"],
                target_revenue=values["target_revenue"],
                target_order_count=values["target_order_count"],
                target_table_count=values["target_table_count"],
                bonus=values["bonus"],
                created_by=user,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            if values["target_mode"] == "multiple":
                for waiter in waiters:
                    WaiterGoalMembers.objects.create(
                        id=create_id("goal-member"),
                        goal=goal,
                        waiter=waiter,
                        created_at=timezone.now(),
                        updated_at=timezone.now(),
                    )

        return Response(serialize_goal(goal, venue), status=status.HTTP_201_CREATED)
    except IntegrityError:
        return Response({"detail": "Cilj nije sačuvan zbog duplikata u bazi."}, status=status.HTTP_400_BAD_REQUEST)
    except DataError:
        return Response({"detail": "Neki podatak za cilj je predugačak za čuvanje."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PATCH", "DELETE"])
def analytics_goal_detail(request, goal_id):
    user, venue, error_response = get_owner_venue_or_response(request)

    if error_response:
        return error_response

    goal = get_object_or_404(WaiterRevenueGoals, pk=goal_id, venue=venue)

    if request.method == "GET":
        return Response(serialize_goal(goal, venue))

    if request.method == "DELETE":
        with transaction.atomic():
            WaiterGoalMembers.objects.filter(goal=goal).delete()
            goal.delete()
        return Response({"ok": True})

    values, values_error = get_goal_payload_values({**serialize_goal(goal, venue), **request.data})
    if values_error:
        return values_error

    waiters = validate_goal_waiters(venue, values["waiter_ids"])
    if waiters is None:
        return Response({"detail": "Neki izabrani konobar ne postoji u ovom lokalu."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        goal.waiter = waiters[0] if values["target_mode"] == "single" and waiters else None
        goal.target_mode = values["target_mode"]
        goal.target_metric = values["target_metric"]
        goal.period_start = values["period_start"]
        goal.period_end = values["period_end"]
        goal.target_revenue = values["target_revenue"]
        goal.target_order_count = values["target_order_count"]
        goal.target_table_count = values["target_table_count"]
        goal.bonus = values["bonus"]
        goal.created_by = user
        goal.updated_at = timezone.now()
        goal.save()

        WaiterGoalMembers.objects.filter(goal=goal).delete()
        if values["target_mode"] == "multiple":
            for waiter in waiters:
                WaiterGoalMembers.objects.create(
                    id=create_id("goal-member"),
                    goal=goal,
                    waiter=waiter,
                    created_at=timezone.now(),
                    updated_at=timezone.now(),
                )

    return Response(serialize_goal(goal, venue))
