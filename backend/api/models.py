from django.db import models
from django.utils import timezone


# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-2
class Users(models.Model):
    id = models.CharField(primary_key=True, max_length=8)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.CharField(unique=True, max_length=255)
    phone = models.CharField(unique=True, max_length=60)
    username = models.CharField(unique=True, max_length=64)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=6)
    status = models.CharField(max_length=11, default="active")
    image = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "users"


# TODO: potvrditi stvarno autorstvo za Owners/opšti model lokala (Boško SSU16-20 ili timski)
class Owners(models.Model):
    user = models.OneToOneField(Users, models.DO_NOTHING, db_column="user_id", primary_key=True)

    class Meta:
        managed = False
        db_table = "owners"




# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-2
class Guests(models.Model):
    user = models.OneToOneField(Users, models.DO_NOTHING, db_column="user_id", primary_key=True)
    reward_points = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = "guests"


# Autori: Milica Tadić ([student ID omitted], SSU11), Boško Trifunović ([student ID omitted], SSU18)
class Waiters(models.Model):
    user = models.OneToOneField(Users, models.DO_NOTHING, db_column="user_id", primary_key=True)
    venue = models.ForeignKey("Venues", models.DO_NOTHING, db_column="venue_id")
    staff_role = models.CharField(max_length=64, default="Konobar")
    gender = models.CharField(max_length=6, default="other")
    birthday = models.DateField(blank=True, null=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    shift_type = models.CharField(max_length=64, blank=True, null=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    note = models.TextField(blank=True, null=True)
    employed_at = models.DateField(blank=True, null=True)
    active = models.IntegerField(default=1)

    class Meta:
        managed = False
        db_table = "waiters"


# Autor: Ivana Mušikić ([student ID omitted]) - SSU1-2
class UserSessions(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    user = models.ForeignKey(Users, models.CASCADE, db_column="user_id")
    device_id = models.CharField(max_length=64, blank=True, null=True)
    token = models.CharField(unique=True, max_length=255)
    expires_at = models.DateTimeField()
    meta = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "user_sessions"


# Autori: Boško Trifunović ([student ID omitted], SSU17/20), Milica Tadić ([student ID omitted], sektorska ograničenja gde postoje)
class Venues(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    owner = models.ForeignKey(Owners, models.DO_NOTHING, db_column="owner_id")
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    floor_type = models.CharField(max_length=7, default="parket")
    active = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "venues"


# Autori: Boško Trifunović ([student ID omitted], SSU17/20), Milica Tadić ([student ID omitted], sektorska ograničenja gde postoje)
class VenueSectors(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    venue = models.ForeignKey("Venues", models.DO_NOTHING, db_column="venue_id")
    name = models.CharField(max_length=128)
    emoji = models.CharField(max_length=16, default="🏠")
    description = models.TextField(blank=True, null=True)
    position_x = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    position_y = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    width = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    height = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    display_order = models.IntegerField(default=0)
    active = models.IntegerField(default=1)

    class Meta:
        managed = False
        db_table = "venue_sectors"


# Autori: Boško Trifunović ([student ID omitted], SSU17/20), Milica Tadić ([student ID omitted], sektorska ograničenja gde postoje)
class VenueTables(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    sector = models.ForeignKey(VenueSectors, models.DO_NOTHING, db_column="sector_id")
    table_number = models.CharField(max_length=32)
    capacity = models.IntegerField()
    shape = models.CharField(max_length=9, default="round")
    status = models.CharField(max_length=17, default="free")
    position_x = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    position_y = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    width = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    height = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    qr_token = models.CharField(max_length=255)
    qr_url = models.TextField()
    qr_generated_at = models.DateTimeField(default=timezone.now)
    active = models.IntegerField(default=1)

    class Meta:
        managed = False
        db_table = "venue_tables"


# Autori: Nina Kaljević ([student ID omitted], SSU6), Boško Trifunović ([student ID omitted], SSU16)
class MenuCategories(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    venue = models.ForeignKey("Venues", models.DO_NOTHING, db_column="venue_id")
    name = models.CharField(max_length=128)
    emoji = models.CharField(max_length=16, default="🍽️")
    description = models.TextField(blank=True, null=True)
    display_order = models.IntegerField(default=0)
    active = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "menu_categories"


# Autori: Nina Kaljević ([student ID omitted], SSU6), Boško Trifunović ([student ID omitted], SSU16)
class MenuItems(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    category = models.ForeignKey(MenuCategories, models.DO_NOTHING, db_column="category_id")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    composition = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.TextField(blank=True, null=True)
    estimated_preparation_minutes = models.IntegerField(blank=True, null=True)
    active = models.IntegerField(default=1)
    available = models.IntegerField(default=1)

    class Meta:
        managed = False
        db_table = "menu_items"


# Autori: Nina Kaljević ([student ID omitted], SSU6), Boško Trifunović ([student ID omitted], SSU16)
class MenuItemOptionGroups(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    menu_item = models.ForeignKey(MenuItems, models.CASCADE, db_column="menu_item_id")
    name = models.CharField(max_length=128)
    required = models.IntegerField(default=0)
    min_choices = models.IntegerField(default=0)
    max_choices = models.IntegerField(blank=True, null=True)
    display_order = models.IntegerField(default=0)
    active = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "menu_item_option_groups"


# Autori: Nina Kaljević ([student ID omitted], SSU6), Boško Trifunović ([student ID omitted], SSU16)
class MenuItemOptions(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    option_group = models.ForeignKey(MenuItemOptionGroups, models.CASCADE, db_column="option_group_id")
    name = models.CharField(max_length=128)
    extra_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    active = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "menu_item_options"


# Autori: Ivana Mušikić ([student ID omitted], SSU5), Boško Trifunović ([student ID omitted], SSU20)
class TableSessions(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    table = models.ForeignKey(VenueTables, models.DO_NOTHING, db_column="table_id")
    current_waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="current_waiter_id", blank=True, null=True)
    group_id = models.CharField(max_length=64, blank=True, null=True)
    status = models.CharField(max_length=15, default="active")
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "table_sessions"


# Autori: Ivana Mušikić ([student ID omitted], SSU5), Boško Trifunović ([student ID omitted], SSU20)
class TableSessionGuests(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    table_session = models.ForeignKey(TableSessions, models.DO_NOTHING, db_column="table_session_id")
    guest_id = models.CharField(max_length=8, blank=True, null=True)
    anonymous_token = models.CharField(max_length=255, blank=True, null=True)
    display_name = models.CharField(max_length=128, blank=True, null=True)
    type = models.CharField(max_length=10)
    joined_at = models.DateTimeField(default=timezone.now)
    left_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "table_session_guests"




# Autor: Ivana Mušikić ([student ID omitted]) - SSU3
class FriendRequests(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    sender = models.ForeignKey(Guests, models.DO_NOTHING, db_column="sender_id", related_name="sent_friend_requests")
    receiver = models.ForeignKey(Guests, models.DO_NOTHING, db_column="receiver_id", related_name="received_friend_requests")
    status = models.CharField(max_length=9, default="pending")
    sent_at = models.DateTimeField(default=timezone.now)
    responded_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "friend_requests"


# Autor: Ivana Mušikić ([student ID omitted]) - SSU3
class Friendships(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    guest1 = models.ForeignKey(Guests, models.DO_NOTHING, db_column="guest1_id", related_name="friendships_as_first")
    guest2 = models.ForeignKey(Guests, models.DO_NOTHING, db_column="guest2_id", related_name="friendships_as_second")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "friendships"



# Autor: Ivana Mušikić ([student ID omitted]) - SSU4
class GuestGroups(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    owner_guest = models.ForeignKey(Guests, models.DO_NOTHING, db_column="owner_guest_id", related_name="owned_guest_groups")
    table_session = models.ForeignKey(TableSessions, models.DO_NOTHING, db_column="table_session_id", blank=True, null=True)
    status = models.CharField(max_length=6, default="active")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "guest_groups"


# Autor: Ivana Mušikić ([student ID omitted]) - SSU4
class GuestGroupMembers(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    group = models.ForeignKey(GuestGroups, models.DO_NOTHING, db_column="group_id", related_name="members")
    guest = models.ForeignKey(Guests, models.DO_NOTHING, db_column="guest_id", related_name="group_memberships")
    status = models.CharField(max_length=8, default="invited")
    invited_at = models.DateTimeField(default=timezone.now)
    joined_at = models.DateTimeField(blank=True, null=True)
    left_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "guest_group_members"

# Autor: Nina Kaljević ([student ID omitted]) - SSU10
class Reservations(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    guest_id = models.CharField(max_length=8)
    venue = models.ForeignKey(Venues, models.DO_NOTHING, db_column="venue_id")
    table = models.ForeignKey(VenueTables, models.DO_NOTHING, db_column="table_id")
    number_of_people = models.IntegerField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=10, default="pending")
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cancellation_deadline = models.DateTimeField(blank=True, null=True)
    confirmed_by = models.CharField(max_length=8, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "reservations"


# Autori: Nina Kaljević ([student ID omitted], SSU7-8), Milica Tadić ([student ID omitted], SSU12/14)
class Orders(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    table_session = models.ForeignKey(TableSessions, models.DO_NOTHING, db_column="table_session_id")
    reservation = models.ForeignKey(Reservations, models.DO_NOTHING, db_column="reservation_id", blank=True, null=True)
    created_by_table_guest_id = models.CharField(max_length=64, blank=True, null=True)
    created_by_waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="created_by_waiter_id", related_name="created_orders", blank=True, null=True)
    approved_by_waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="approved_by_waiter_id", related_name="approved_orders", blank=True, null=True)
    creation_type = models.CharField(max_length=8)
    status = models.CharField(max_length=16, default="draft")
    note = models.TextField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "orders"


# Autori: Nina Kaljević ([student ID omitted], SSU7-8), Milica Tadić ([student ID omitted], SSU12/14)
class OrderItems(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    order = models.ForeignKey(Orders, models.DO_NOTHING, db_column="order_id")
    menu_item = models.ForeignKey(MenuItems, models.DO_NOTHING, db_column="menu_item_id")
    table_guest_id = models.CharField(max_length=64, blank=True, null=True)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=16, default="pending_approval")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "order_items"


# Autori: Nina Kaljević ([student ID omitted], SSU7-8), Milica Tadić ([student ID omitted], SSU12/14)
class OrderItemOptions(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    order_item = models.ForeignKey(OrderItems, models.DO_NOTHING, db_column="order_item_id")
    menu_item_option = models.ForeignKey(MenuItemOptions, models.DO_NOTHING, db_column="menu_item_option_id", blank=True, null=True)
    name_snapshot = models.CharField(db_column="option_name_snapshot", max_length=128)
    extra_price = models.DecimalField(db_column="extra_price_snapshot", max_digits=10, decimal_places=2, default=0)

    class Meta:
        managed = False
        db_table = "order_item_options"


# Autori: Nina Kaljević ([student ID omitted], SSU9), Milica Tadić ([student ID omitted], SSU15)
class Bills(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    table_session = models.ForeignKey(TableSessions, models.DO_NOTHING, db_column="table_session_id")
    status = models.CharField(max_length=14, default="open")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "bills"


# Autori: Nina Kaljević ([student ID omitted], SSU9), Milica Tadić ([student ID omitted], SSU15)
class Payments(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    bill = models.ForeignKey(Bills, models.DO_NOTHING, db_column="bill_id", blank=True, null=True)
    reservation = models.ForeignKey(Reservations, models.DO_NOTHING, db_column="reservation_id", blank=True, null=True)
    table_guest_id = models.CharField(max_length=64, blank=True, null=True)
    waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="waiter_id", blank=True, null=True)
    method = models.CharField(max_length=4)
    type = models.CharField(max_length=13)
    status = models.CharField(max_length=9, default="pending")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    provider_reference = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    confirmed_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "payments"


# Autori: Nina Kaljević ([student ID omitted], SSU9), Milica Tadić ([student ID omitted], SSU15)
class PaymentOrderItems(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    payment = models.ForeignKey(Payments, models.DO_NOTHING, db_column="payment_id")
    order_item = models.ForeignKey(OrderItems, models.DO_NOTHING, db_column="order_item_id")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "payment_order_items"


# Autori: Ivana Mušikić ([student ID omitted], SSU5), Boško Trifunović ([student ID omitted], SSU20)
class TableAssignments(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    table_session = models.ForeignKey(TableSessions, models.DO_NOTHING, db_column="table_session_id")
    waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="waiter_id")
    assigned_from = models.DateTimeField(default=timezone.now)
    assigned_to = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "table_assignments"


# Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU18/19)
class WaiterShifts(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="waiter_id")
    venue = models.ForeignKey(Venues, models.DO_NOTHING, db_column="venue_id")
    sector = models.ForeignKey(VenueSectors, models.DO_NOTHING, db_column="sector_id", blank=True, null=True)
    shift_type = models.CharField(max_length=10, default="Jutarnja")
    status = models.CharField(max_length=9, default="confirmed")
    shift_start = models.DateTimeField()
    shift_end = models.DateTimeField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(Users, models.DO_NOTHING, db_column="created_by")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "waiter_shifts"


# Autor: Boško Trifunović ([student ID omitted]) - SSU19
class WaiterRevenueGoals(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="waiter_id", blank=True, null=True)
    venue = models.ForeignKey(Venues, models.DO_NOTHING, db_column="venue_id")
    target_mode = models.CharField(max_length=8, default="single")
    target_metric = models.CharField(max_length=7, default="revenue")
    period_start = models.DateField()
    period_end = models.DateField()
    target_revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    target_order_count = models.IntegerField(blank=True, null=True)
    target_table_count = models.IntegerField(blank=True, null=True)
    bonus = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey(Users, models.DO_NOTHING, db_column="created_by")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "waiter_revenue_goals"


# Autor: Boško Trifunović ([student ID omitted]) - SSU19
class WaiterGoalMembers(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    goal = models.ForeignKey(WaiterRevenueGoals, models.CASCADE, db_column="goal_id")
    waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="waiter_id")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "waiter_goal_members"


# Autor: Boško Trifunović ([student ID omitted]) - SSU19
class WaiterRatings(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    waiter = models.ForeignKey(Waiters, models.DO_NOTHING, db_column="waiter_id")
    venue = models.ForeignKey(Venues, models.DO_NOTHING, db_column="venue_id")
    rating = models.DecimalField(max_digits=3, decimal_places=2)
    source_type = models.CharField(max_length=7, default="guest")
    source_user_id = models.CharField(max_length=8, blank=True, null=True)
    order = models.ForeignKey(Orders, models.DO_NOTHING, db_column="order_id", blank=True, null=True)
    table_session = models.ForeignKey(TableSessions, models.DO_NOTHING, db_column="table_session_id", blank=True, null=True)
    comment = models.TextField(blank=True, null=True)
    rated_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = "waiter_ratings"
