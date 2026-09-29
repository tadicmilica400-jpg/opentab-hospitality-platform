# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-5
from datetime import timedelta
from secrets import token_urlsafe
from uuid import uuid4

from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_serializers import MobileUserSerializer
from .models import Guests, Users, UserSessions

MOBILE_SESSION_DURATION_DAYS = 30
MOBILE_DEFAULT_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=480&q=80&auto=format&fit=crop"


def get_mobile_auth_token(request):
    authorization = str(request.headers.get("Authorization") or "").strip()

    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()

    return request.headers.get("X-OpenTab-Mobile-Token") or request.headers.get("X-OpenTab-Token") or None


def normalize_text(value):
    return " ".join(str(value or "").strip().split())


def normalize_email(value):
    return normalize_text(value).lower()


def normalize_username(value):
    username = normalize_text(value).lower()
    return "".join(character for character in username if character.isalnum() or character in {"_", ".", "-"})[:64]


def split_name(data):
    first_name = normalize_text(data.get("first_name") or data.get("firstName"))
    last_name = normalize_text(data.get("last_name") or data.get("lastName"))

    if first_name or last_name:
        return first_name or "Gost", last_name or "-"

    full_name = normalize_text(data.get("full_name") or data.get("fullName") or data.get("name"))

    if not full_name:
        return "Gost", "-"

    parts = full_name.split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else "-"


def create_mobile_user_id(prefix="gst"):
    clean_prefix = str(prefix or "gst")[:4]

    for _ in range(30):
        candidate = f"{clean_prefix}{uuid4().hex[:8 - len(clean_prefix)]}"

        if not Users.objects.filter(id=candidate).exists():
            return candidate

    return uuid4().hex[:8]


def create_mobile_session_id():
    for _ in range(30):
        candidate = f"ms-{uuid4().hex[:29]}"

        if not UserSessions.objects.filter(id=candidate).exists():
            return candidate

    return uuid4().hex[:32]


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

    if stored_password == password:
        save_hashed_password(user, password)
        return True

    if stored_password == "demo_hash" and password == "demo1234":
        save_hashed_password(user, password)
        return True

    return False



def ensure_guest_profile(user):
    Guests.objects.get_or_create(user=user, defaults={"reward_points": 0})


def serialize_mobile_user(user, session_meta=None):
    return MobileUserSerializer(user, context={"session_meta": session_meta or {}}).data


def create_mobile_session(user, device_id=None, anonymous=False):
    token = token_urlsafe(48)
    meta = {
        "client": "mobile",
        "role": "guest",
        "anonymous": bool(anonymous),
    }

    session = UserSessions.objects.create(
        id=create_mobile_session_id(),
        user=user,
        device_id=normalize_text(device_id)[:64] or None,
        token=token,
        expires_at=timezone.now() + timedelta(days=MOBILE_SESSION_DURATION_DAYS),
        meta=meta,
    )

    return session


def auth_response(user, session, status_code=status.HTTP_200_OK):
    session_meta = session.meta if isinstance(session.meta, dict) else {}

    return Response(
        {
            "token": session.token,
            "expires_at": session.expires_at,
            "user": serialize_mobile_user(user, session_meta),
            "isAnonymous": bool(session_meta.get("anonymous")),
        },
        status=status_code,
    )


def get_mobile_session_from_request(request):
    token = get_mobile_auth_token(request)

    if not token:
        return None

    session = (
        UserSessions.objects.select_related("user")
        .filter(token=token, expires_at__gt=timezone.now())
        .first()
    )

    if session is None:
        return None

    meta = session.meta if isinstance(session.meta, dict) else {}

    if meta.get("client") != "mobile" or meta.get("role") != "guest":
        return None

    user = session.user

    if user.role != "guest" or user.status != "active" or user.deleted_at is not None:
        return None

    return session


def validate_unique_guest_fields(email, username, phone, user_id=None):
    if Users.objects.filter(email__iexact=email).exclude(id=user_id).exists():
        return "Email je već zauzet."

    if Users.objects.filter(username__iexact=username).exclude(id=user_id).exists():
        return "Korisničko ime je već zauzeto."

    if phone and Users.objects.filter(phone=phone).exclude(id=user_id).exists():
        return "Broj telefona je već zauzet."

    return None


def generated_guest_username_from_email(email):
    base = normalize_username(email.split("@", 1)[0]) or "gost"
    username = base[:58]

    if not Users.objects.filter(username__iexact=username).exists():
        return username

    for _ in range(30):
        candidate = f"{base[:50]}_{uuid4().hex[:6]}"

        if not Users.objects.filter(username__iexact=candidate).exists():
            return candidate

    return f"gost_{uuid4().hex[:8]}"[:64]


def generated_guest_phone():
    for _ in range(30):
        candidate = f"guest-{uuid4().hex[:16]}"

        if not Users.objects.filter(phone=candidate).exists():
            return candidate

    return f"guest-{uuid4().hex[:24]}"[:60]


@api_view(["POST"])
def mobile_auth_register(request):
    email = normalize_email(request.data.get("email"))
    username = normalize_username(request.data.get("username"))
    phone = normalize_text(request.data.get("phone"))[:60]
    password = str(request.data.get("password") or "")
    image = normalize_text(request.data.get("image") or request.data.get("avatarUrl")) or MOBILE_DEFAULT_AVATAR
    first_name, last_name = split_name(request.data)

    if not email:
        return Response({"detail": "Email je obavezan."}, status=status.HTTP_400_BAD_REQUEST)

    if "@" not in email or "." not in email.split("@", 1)[-1]:
        return Response({"detail": "Email nije u ispravnom formatu."}, status=status.HTTP_400_BAD_REQUEST)

    if not username:
        username = generated_guest_username_from_email(email)

    if not phone:
        phone = generated_guest_phone()

    if len(password) < 6:
        return Response({"detail": "Lozinka mora imati bar 6 karaktera."}, status=status.HTTP_400_BAD_REQUEST)

    unique_error = validate_unique_guest_fields(email, username, phone)

    if unique_error:
        return Response({"detail": unique_error}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = Users.objects.create(
                id=create_mobile_user_id("gst"),
                first_name=first_name[:255],
                last_name=last_name[:255],
                email=email[:255],
                phone=phone,
                username=username,
                password_hash=make_password(password),
                role="guest",
                status="active",
                image=image,
                created_at=timezone.now(),
                updated_at=timezone.now(),
                deleted_at=None,
            )
            ensure_guest_profile(user)
            session = create_mobile_session(user, request.data.get("device_id"), anonymous=False)
    except IntegrityError:
        return Response({"detail": "Nalog sa unetim podacima već postoji."}, status=status.HTTP_400_BAD_REQUEST)

    return auth_response(user, session, status.HTTP_201_CREATED)


@api_view(["POST"])
def mobile_auth_login(request):
    identifier = normalize_text(request.data.get("identifier") or request.data.get("username") or request.data.get("email"))
    password = str(request.data.get("password") or "")

    if not identifier:
        return Response({"detail": "Email ili korisničko ime je obavezno."}, status=status.HTTP_400_BAD_REQUEST)

    if not password:
        return Response({"detail": "Lozinka je obavezna."}, status=status.HTTP_400_BAD_REQUEST)

    user = Users.objects.filter(
        Q(username__iexact=identifier) | Q(email__iexact=identifier),
        role="guest",
        status="active",
        deleted_at__isnull=True,
    ).first()

    if user is None or not password_matches(user, password):
        return Response({"detail": "Neispravni kredencijali."}, status=status.HTTP_400_BAD_REQUEST)

    ensure_guest_profile(user)
    session = create_mobile_session(user, request.data.get("device_id"), anonymous=False)
    return auth_response(user, session)


@api_view(["POST"])
def mobile_auth_continue_as_guest(request):
    guest_id = create_mobile_user_id("anon")
    display_name = normalize_text(request.data.get("displayName") or request.data.get("display_name") or request.data.get("name"))
    first_name, last_name = split_name({"fullName": display_name or "Gost"})
    username = f"guest_{guest_id}"[:64]
    email = f"{username}@guest.opentab.local"
    phone = generated_guest_phone()

    try:
        with transaction.atomic():
            user = Users.objects.create(
                id=guest_id,
                first_name=first_name[:255],
                last_name=last_name[:255],
                email=email,
                phone=phone,
                username=username,
                password_hash=make_password(token_urlsafe(32)),
                role="guest",
                status="active",
                image=MOBILE_DEFAULT_AVATAR,
                created_at=timezone.now(),
                updated_at=timezone.now(),
                deleted_at=None,
            )
            ensure_guest_profile(user)
            session = create_mobile_session(user, request.data.get("device_id"), anonymous=True)
    except IntegrityError:
        return Response({"detail": "Nije moguće nastaviti kao gost. Pokušaj ponovo."}, status=status.HTTP_400_BAD_REQUEST)

    return auth_response(user, session, status.HTTP_201_CREATED)


@api_view(["GET"])
def mobile_auth_me(request):
    session = get_mobile_session_from_request(request)

    if session is None:
        return Response({"detail": "Nisi ulogovan u mobilnoj aplikaciji."}, status=status.HTTP_401_UNAUTHORIZED)

    ensure_guest_profile(session.user)
    session_meta = session.meta if isinstance(session.meta, dict) else {}
    return Response({"user": serialize_mobile_user(session.user, session_meta), "isAnonymous": bool(session_meta.get("anonymous"))})


@api_view(["POST"])
def mobile_auth_logout(request):
    token = get_mobile_auth_token(request)

    if token:
        UserSessions.objects.filter(token=token).delete()

    return Response({"ok": True})
