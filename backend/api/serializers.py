from rest_framework import serializers

from .models import (
    MenuCategories,
    MenuItemOptionGroups,
    MenuItemOptions,
    MenuItems,
    Users,
    Waiters,
    Venues,
    VenueSectors,
    VenueTables,
)


class AuthUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "username",
            "role",
            "status",
            "image",
        ]


class StaffMemberSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="user_id")
    fullName = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username")
    password = serializers.SerializerMethodField()
    role = serializers.CharField(source="staff_role")
    status = serializers.SerializerMethodField()
    avatarUrl = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="user.created_at")
    updatedAt = serializers.DateTimeField(source="user.updated_at")
    email = serializers.CharField(source="user.email")
    phone = serializers.CharField(source="user.phone")
    hireDate = serializers.DateField(source="employed_at", allow_null=True)
    shiftType = serializers.CharField(source="shift_type", allow_null=True)
    rating = serializers.SerializerMethodField()

    class Meta:
        model = Waiters
        fields = [
            "id",
            "fullName",
            "username",
            "password",
            "role",
            "status",
            "gender",
            "avatarUrl",
            "createdAt",
            "updatedAt",
            "email",
            "phone",
            "hireDate",
            "birthday",
            "salary",
            "shiftType",
            "rating",
            "note",
        ]

    def get_fullName(self, waiter):
        return f"{waiter.user.first_name} {waiter.user.last_name}".strip()

    def get_password(self, waiter):
        return ""

    def get_status(self, waiter):
        return "active" if waiter.active == 1 and waiter.user.status == "active" else "inactive"

    def get_avatarUrl(self, waiter):
        return waiter.user.image or ""

    def get_rating(self, waiter):
        try:
            return float(waiter.rating or 0)
        except (TypeError, ValueError):
            return 0


class StaffRoleSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    icon = serializers.CharField()
    worker_count = serializers.IntegerField()


class MenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuCategories
        fields = [
            "id",
            "venue",
            "name",
            "emoji",
            "description",
            "display_order",
            "active",
        ]


class MenuOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItemOptions
        fields = ["id", "name", "extra_price"]


class MenuOptionGroupSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()

    class Meta:
        model = MenuItemOptionGroups
        fields = ["id", "name", "options"]

    def get_options(self, group):
        options = MenuItemOptions.objects.filter(
            option_group=group,
            active=1,
            deleted_at__isnull=True,
        ).order_by("name")

        return MenuOptionSerializer(options, many=True).data


class MenuItemSerializer(serializers.ModelSerializer):
    option_groups = serializers.SerializerMethodField()

    class Meta:
        model = MenuItems
        fields = [
            "id",
            "category",
            "name",
            "description",
            "composition",
            "price",
            "image",
            "estimated_preparation_minutes",
            "active",
            "available",
            "option_groups",
        ]

    def get_option_groups(self, item):
        groups = MenuItemOptionGroups.objects.filter(
            menu_item=item,
            active=1,
        ).order_by("display_order", "name")

        return MenuOptionGroupSerializer(groups, many=True).data


class VenueSerializer(serializers.ModelSerializer):
    floor = serializers.CharField(source="floor_type")

    class Meta:
        model = Venues
        fields = ["id", "name", "address", "description", "floor", "active"]


class VenueSectorSerializer(serializers.ModelSerializer):
    x = serializers.DecimalField(source="position_x", max_digits=10, decimal_places=2, coerce_to_string=False)
    y = serializers.DecimalField(source="position_y", max_digits=10, decimal_places=2, coerce_to_string=False)

    class Meta:
        model = VenueSectors
        fields = [
            "id",
            "venue",
            "name",
            "emoji",
            "description",
            "x",
            "y",
            "width",
            "height",
            "display_order",
            "active",
        ]


class VenueTableSerializer(serializers.ModelSerializer):
    sector = serializers.CharField(source="sector_id")
    number = serializers.CharField(source="table_number")
    seats = serializers.IntegerField(source="capacity")
    x = serializers.DecimalField(source="position_x", max_digits=10, decimal_places=2, coerce_to_string=False)
    y = serializers.DecimalField(source="position_y", max_digits=10, decimal_places=2, coerce_to_string=False)
    qr_code_url = serializers.CharField(source="qr_url")
    has_active_order = serializers.SerializerMethodField()

    class Meta:
        model = VenueTables
        fields = [
            "id",
            "sector",
            "number",
            "seats",
            "shape",
            "status",
            "x",
            "y",
            "width",
            "height",
            "qr_code_url",
            "has_active_order",
            "active",
        ]

    def get_has_active_order(self, table):
        return table.status in {
            "occupied",
            "waiting_order",
            "in_preparation",
            "waiting_payment",
        }
