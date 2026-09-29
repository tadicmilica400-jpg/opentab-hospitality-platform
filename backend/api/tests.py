from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.db.models import Q
from django.test import SimpleTestCase
from django.utils import timezone

from . import waiter_services


class WaiterOrderScopeTests(SimpleTestCase):
    def test_pending_scope_uses_active_shift_sector_id_only(self):
        venue = SimpleNamespace(id="venue-1")
        waiter = SimpleNamespace(user_id="waiter-1")
        active_shift = SimpleNamespace(
            sector_id="sector-a",
            sector=SimpleNamespace(venue_id="venue-1"),
        )

        with patch.object(waiter_services, "get_active_waiter_shift", return_value=active_shift):
            scope = waiter_services.get_waiter_pending_order_scope_q(venue, waiter)

        self.assertEqual(scope, Q(table_session__table__sector_id="sector-a"))
        self.assertNotIn("current_waiter", str(scope))
        self.assertNotIn("created_by_waiter", str(scope))
        self.assertNotIn("approved_by_waiter", str(scope))
        self.assertNotIn("TableAssignments", str(scope))

    def test_pending_scope_is_empty_without_active_sector(self):
        venue = SimpleNamespace(id="venue-1")
        waiter = SimpleNamespace(user_id="waiter-1")

        with patch.object(waiter_services, "get_active_waiter_shift", return_value=None):
            scope = waiter_services.get_waiter_pending_order_scope_q(venue, waiter)

        self.assertEqual(scope, Q(pk__isnull=True))

    def test_archive_scope_uses_shift_window_sector_ids(self):
        now = timezone.now()
        shift_windows = [
            {
                "shift_id": "shift-a",
                "sector_id": "sector-a",
                "shift_start": now - timedelta(hours=4),
                "shift_end": now - timedelta(hours=2),
            },
            {
                "shift_id": "shift-b",
                "sector_id": "sector-b",
                "shift_start": now - timedelta(hours=2),
                "shift_end": now,
            },
        ]

        scope = waiter_services.build_waiter_archive_order_scope_q(shift_windows)
        scope_text = str(scope)

        self.assertIn("table_session__table__sector_id", scope_text)
        self.assertIn("sector-a", scope_text)
        self.assertIn("sector-b", scope_text)
        self.assertIn("created_at__gte", scope_text)
        self.assertIn("created_at__lte", scope_text)
        self.assertNotIn("current_waiter", scope_text)
        self.assertNotIn("created_by_waiter", scope_text)
        self.assertNotIn("approved_by_waiter", scope_text)

    def test_waiter_order_list_read_does_not_auto_expire_pending_orders(self):
        venue = SimpleNamespace(id="venue-1")
        waiter = SimpleNamespace(user_id="waiter-1")

        with (
            patch.object(waiter_services, "expire_stale_pending_orders") as expire_mock,
            patch.object(waiter_services.Orders.objects, "select_related") as select_related_mock,
            patch.object(waiter_services, "get_waiter_orders_payload", return_value=[]),
        ):
            query_mock = select_related_mock.return_value
            query_mock.filter.return_value = query_mock
            query_mock.__iter__.return_value = iter([])

            payload = waiter_services.get_waiter_order_lists_payload(venue, waiter)

        self.assertEqual(payload, {"pendingOrders": [], "archiveOrders": []})
        expire_mock.assert_not_called()
