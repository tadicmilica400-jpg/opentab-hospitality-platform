from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework import status

from api import views, waiter_services, waiter_views
from api.models import Orders, TableSessions, WaiterShifts


class SSU11PrijavaKonobaraTests(SimpleTestCase):
    def test_uloga_se_normalizuje_i_proverava(self):
        waiter = SimpleNamespace(role=" WAITER ")
        owner = SimpleNamespace(role="owner")
        self.assertEqual(views.normalize_login_role(waiter.role), "waiter")
        self.assertTrue(views.user_has_waiter_access(waiter))
        self.assertFalse(views.user_has_waiter_access(owner))
        self.assertIsNone(views.resolve_user_role(waiter, "owner"))

    def test_greska_servisa_pravilno_mapira_http_status(self):
        missing = waiter_views.waiter_service_error_response("Sto nije pronadjen.")
        forbidden = waiter_views.waiter_service_error_response({"detail": "Zabranjeno", "status": 403})
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)


class SSU12OdobravanjeNarudzbineTests(SimpleTestCase):
    def test_status_narudzbine_se_mapira_na_prikaz_konobara(self):
        expected = {
            "pending_approval": "pending",
            "in_preparation": "approved",
            "completed": "completed",
            "expired": "expired",
            "partial": "partial",
            "rejected": "rejected",
        }
        for source, target in expected.items():
            with self.subTest(source=source):
                self.assertEqual(waiter_services.map_waiter_order_status(source), target)

    def test_delimicno_odobravanje_uzima_sve_grane(self):
        self.assertEqual(
            waiter_services._resolve_processed_order_status("partial", {"i1": True, "i2": False}),
            waiter_services.PARTIAL_ORDER_STATUS,
        )
        self.assertEqual(
            waiter_services._resolve_processed_order_status("partial", {"i1": True}),
            waiter_services.APPROVED_ORDER_STATUS,
        )
        self.assertEqual(
            waiter_services._resolve_processed_order_status("partial", {"i1": False}),
            waiter_services.REJECTED_ORDER_STATUS,
        )

    def test_model_ima_razlog_odbijanja(self):
        self.assertTrue(Orders._meta.get_field("rejection_reason").blank)


class SSU13PremestanjeStolaTests(SimpleTestCase):
    def test_premestanje_je_dozvoljeno_ako_je_jedan_sto_u_sektoru_konobara(self):
        venue = SimpleNamespace(id="v1")
        waiter = SimpleNamespace(user_id="w1")
        own = SimpleNamespace(sector_id="s1")
        other = SimpleNamespace(sector_id="s2")
        with patch.object(waiter_services, "get_waiter_active_transfer_sector_id", return_value=("s1", None)):
            self.assertEqual(waiter_services.waiter_can_transfer_between_sectors(waiter, venue, own, other), (True, None))

    def test_premestanje_izmedju_tudjih_sektora_je_zabranjeno(self):
        venue = SimpleNamespace(id="v1")
        waiter = SimpleNamespace(user_id="w1")
        first = SimpleNamespace(sector_id="s2")
        second = SimpleNamespace(sector_id="s3")
        with patch.object(waiter_services, "get_waiter_active_transfer_sector_id", return_value=("s1", None)):
            allowed, message = waiter_services.waiter_can_transfer_between_sectors(waiter, venue, first, second)
        self.assertFalse(allowed)
        self.assertIn("svog sektora", message)


class SSU14RucniUnosNarudzbineTests(SimpleTestCase):
    def test_rucni_unos_je_dozvoljen_za_sto_aktivnog_sektora(self):
        venue = SimpleNamespace(id="v1")
        waiter = SimpleNamespace(user_id="w1")
        table = SimpleNamespace(sector_id="s1")
        shift = SimpleNamespace(sector_id="s1", sector=SimpleNamespace(venue_id="v1"))
        self.assertEqual(waiter_services.waiter_can_create_manual_order(waiter, venue, table, shift), (True, None))

    def test_rucni_unos_bez_smene_je_zabranjen(self):
        allowed, message = waiter_services.waiter_can_create_manual_order(
            SimpleNamespace(user_id="w1"), SimpleNamespace(id="v1"), SimpleNamespace(sector_id="s1"), None
        )
        self.assertFalse(allowed)
        self.assertEqual(message, waiter_services.MANUAL_ORDER_NO_SCOPE_MESSAGE)


class SSU15ZatvaranjeStolaTests(SimpleTestCase):
    def test_status_stola_za_naplatu_ima_prioritet(self):
        table = SimpleNamespace(status="occupied")
        session = SimpleNamespace(status="waiting_payment")
        self.assertEqual(waiter_services.map_db_table_status(table, session), "payment")

    def test_aktivna_sesija_se_prikazuje_kao_zauzet_sto(self):
        table = SimpleNamespace(status="free")
        session = SimpleNamespace(status="active")
        self.assertEqual(waiter_services.map_db_table_status(table, session), "occupied")

    def test_sesija_podrazumevano_pocinje_aktivna(self):
        self.assertEqual(TableSessions._meta.get_field("status").get_default(), "active")
        self.assertEqual(WaiterShifts._meta.get_field("status").get_default(), "confirmed")

