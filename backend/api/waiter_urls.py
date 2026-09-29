# Autori: Milica Tadić ([student ID omitted], SSU11-15), Boško Trifunović ([student ID omitted], SSU20)
from django.urls import path

from . import waiter_views

urlpatterns = [
    path("me/", waiter_views.waiter_me, name="waiter-me"),
    path("venue-map/", waiter_views.waiter_venue_map, name="waiter-venue-map"),
    path("tables/", waiter_views.waiter_tables, name="waiter-tables"),
    path("tables/transfer/", waiter_views.waiter_transfer_table, name="waiter-transfer-table"),
    path("tables/<str:table_id>/occupy/", waiter_views.waiter_occupy_table, name="waiter-occupy-table"),
    path("tables/<str:table_id>/release/", waiter_views.waiter_release_table, name="waiter-release-table"),
    path("tables/<str:table_id>/payments/", waiter_views.waiter_table_payment, name="waiter-table-payment"),
    path("tables/<str:table_id>/close/", waiter_views.waiter_close_table, name="waiter-close-table"),
    path("tables/<str:table_id>/orders/", waiter_views.waiter_create_table_order, name="waiter-create-table-order"),
    path("tables/<str:table_id>/", waiter_views.waiter_table_detail, name="waiter-table-detail"),
    path("menu/", waiter_views.waiter_menu, name="waiter-menu"),
    path("orders/", waiter_views.waiter_orders, name="waiter-orders"),
    path("orders/pending/", waiter_views.waiter_pending_orders, name="waiter-pending-orders"),
    path("orders/archive/", waiter_views.waiter_archive_orders, name="waiter-archive-orders"),
    path("orders/pending/<str:order_id>/process/", waiter_views.waiter_process_pending_order, name="waiter-process-pending-order"),
    path("reservations/pending/", waiter_views.waiter_pending_reservations, name="waiter-pending-reservations"),
    path("reservations/<str:reservation_id>/process/", waiter_views.waiter_process_reservation, name="waiter-process-reservation"),
    path("performance/", waiter_views.waiter_performance, name="waiter-performance"),
    path("shifts/", waiter_views.waiter_shifts, name="waiter-shifts"),
]
