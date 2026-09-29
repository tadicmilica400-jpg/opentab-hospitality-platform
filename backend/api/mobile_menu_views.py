# Autor: Nina Kaljević ([student ID omitted]) - SSU6-10
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .mobile_auth_views import get_mobile_session_from_request
from .models import (
    MenuCategories,
    MenuItemOptionGroups,
    MenuItemOptions,
    MenuItems,
    TableSessionGuests,
    TableSessions,
    Venues,
)

DEFAULT_ITEM_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80&auto=format&fit=crop"


CATEGORY_EMOJIS = {
    "kafa": "☕",
    "kafe": "☕",
    "coffee": "☕",
    "sok": "🥤",
    "sokovi": "🥤",
    "pice": "🥤",
    "piće": "🥤",
    "pica": "🥤",
    "pića": "🥤",
    "hrana": "🍽️",
    "sendvic": "🥪",
    "sendvič": "🥪",
    "desert": "🍰",
    "deserti": "🍰",
    "koktel": "🍸",
    "kokteli": "🍸",
}


def require_mobile_session(request):
    session = get_mobile_session_from_request(request)

    if session is None:
        return None, Response(
            {"detail": "Moraš biti ulogovan ili nastaviti kao gost."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    return session, None


def normalize_text(value):
    return " ".join(str(value or "").strip().split())


def normalize_number(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def decimal_to_float(value):
    if value is None:
        return 0

    return float(value)


def category_emoji(category):
    source = f"{category.name} {category.description or ''}".lower()

    for keyword, emoji in CATEGORY_EMOJIS.items():
        if keyword in source:
            return emoji

    return category.emoji or "🍽️"


def get_venue_from_table_session(table_session_id):
    if not table_session_id:
        return None

    table_session = (
        TableSessions.objects.select_related("table", "table__sector", "table__sector__venue")
        .filter(id=table_session_id)
        .first()
    )

    if not table_session or not table_session.table_id:
        return None

    sector = table_session.table.sector

    if not sector or not sector.venue_id:
        return None

    venue = sector.venue

    if not venue or not venue.active or venue.deleted_at is not None:
        return None

    return venue


def get_venue_from_current_membership(user):
    if not user or not getattr(user, "id", None):
        return None

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
            table_session__status__in=["active", "waiting_payment"],
        )
        .order_by("-joined_at")
        .first()
    )

    if not membership or not membership.table_session_id:
        return None

    table = membership.table_session.table

    if not table or not table.sector_id:
        return None

    venue = table.sector.venue

    if not venue or not venue.active or venue.deleted_at is not None:
        return None

    return venue


def get_venue_with_most_menu_items():
    venues = list(Venues.objects.filter(active=1, deleted_at__isnull=True).order_by("created_at", "id"))

    if not venues:
        return None

    def active_item_count(venue):
        return MenuItems.objects.filter(
            category__venue=venue,
            category__active=1,
            category__deleted_at__isnull=True,
            active=1,
            available=1,
        ).count()

    return max(venues, key=active_item_count)


def get_active_venue(venue_id=None, auth_session=None):
    venues = Venues.objects.filter(active=1, deleted_at__isnull=True)

    if venue_id:
        venue = venues.filter(id=venue_id).first()

        if venue is not None:
            return venue

    session_meta = auth_session.meta if auth_session and isinstance(auth_session.meta, dict) else {}

    venue = get_venue_from_table_session(session_meta.get("active_table_session_id"))

    if venue is not None:
        return venue

    venue = get_venue_from_current_membership(auth_session.user if auth_session else None)

    if venue is not None:
        return venue

    return get_venue_with_most_menu_items()


def get_active_categories(venue):
    queryset = MenuCategories.objects.filter(active=1, deleted_at__isnull=True)

    if venue is not None:
        queryset = queryset.filter(venue=venue)

    return list(queryset.order_by("display_order", "name"))


def serialize_category(category):
    return {
        "key": category.id,
        "label": category.name,
        "emoji": category_emoji(category),
        "description": category.description or "",
    }


def serialize_option(option, group):
    return {
        "id": option.id,
        "label": option.name,
        "priceDelta": decimal_to_float(option.extra_price),
        "group": group.name or "ostalo",
        "required": bool(group.required),
        "minChoices": group.min_choices,
        "maxChoices": group.max_choices,
    }


def build_options_by_item(items):
    item_ids = [item.id for item in items]

    if not item_ids:
        return {}

    groups = list(
        MenuItemOptionGroups.objects.filter(menu_item_id__in=item_ids, active=1)
        .order_by("menu_item_id", "display_order", "name")
    )
    group_ids = [group.id for group in groups]
    options_by_group = {group.id: [] for group in groups}

    if group_ids:
        options = MenuItemOptions.objects.filter(
            option_group_id__in=group_ids,
            active=1,
            deleted_at__isnull=True,
        ).order_by("name")

        for option in options:
            options_by_group.setdefault(option.option_group_id, []).append(option)

    options_by_item = {item.id: [] for item in items}

    for group in groups:
        group_options = options_by_group.get(group.id, [])
        options_by_item.setdefault(group.menu_item_id, [])

        for option in group_options:
            options_by_item[group.menu_item_id].append(serialize_option(option, group))

    return options_by_item


def serialize_item(item, options_by_item=None):
    options = (options_by_item or {}).get(item.id, [])

    return {
        "id": item.id,
        "cat": item.category_id,
        "categoryLabel": item.category.name if item.category_id and item.category else "",
        "name": item.name,
        "desc": item.description or "",
        "composition": item.composition or "",
        "price": decimal_to_float(item.price),
        "image": item.image or DEFAULT_ITEM_IMAGE,
        "badge": "Nedostupno" if not item.available else None,
        "estimatedPreparationMinutes": item.estimated_preparation_minutes,
        "available": bool(item.available),
        "options": options,
    }


def get_filtered_items(categories, request):
    category_ids = [category.id for category in categories]

    if not category_ids:
        return []

    queryset = (
        MenuItems.objects.select_related("category")
        .filter(
            category_id__in=category_ids,
            active=1,
            available=1,
        )
        .order_by("category__display_order", "category__name", "name")
    )

    category_id = normalize_text(request.query_params.get("category"))

    if category_id and category_id != "sve":
        queryset = queryset.filter(category_id=category_id)

    search = normalize_text(request.query_params.get("q") or request.query_params.get("search"))

    if search:
        queryset = queryset.filter(name__icontains=search) | queryset.filter(description__icontains=search)

    limit = normalize_number(request.query_params.get("limit"))

    if limit and limit > 0:
        queryset = queryset[: min(limit, 100)]

    return list(queryset)


@api_view(["GET"])
def mobile_menu_catalog(request):
    auth_session, error_response = require_mobile_session(request)

    if error_response is not None:
        return error_response

    venue = get_active_venue(normalize_text(request.query_params.get("venue_id")), auth_session)

    if venue is None:
        return Response({"venue": None, "categories": [], "items": []})

    categories = get_active_categories(venue)
    items = get_filtered_items(categories, request)
    options_by_item = build_options_by_item(items)

    return Response(
        {
            "venue": {
                "id": venue.id,
                "name": venue.name,
                "address": venue.address or "",
                "description": venue.description or "",
            },
            "categories": [serialize_category(category) for category in categories],
            "items": [serialize_item(item, options_by_item) for item in items],
        }
    )


@api_view(["GET"])
def mobile_menu_categories(request):
    auth_session, error_response = require_mobile_session(request)

    if error_response is not None:
        return error_response

    venue = get_active_venue(normalize_text(request.query_params.get("venue_id")), auth_session)

    if venue is None:
        return Response([])

    return Response([serialize_category(category) for category in get_active_categories(venue)])


@api_view(["GET"])
def mobile_menu_items(request):
    auth_session, error_response = require_mobile_session(request)

    if error_response is not None:
        return error_response

    venue = get_active_venue(normalize_text(request.query_params.get("venue_id")), auth_session)

    if venue is None:
        return Response([])

    categories = get_active_categories(venue)
    items = get_filtered_items(categories, request)
    options_by_item = build_options_by_item(items)

    return Response([serialize_item(item, options_by_item) for item in items])
