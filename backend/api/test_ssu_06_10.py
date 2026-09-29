from decimal import Decimal
from types import SimpleNamespace

from django.test import SimpleTestCase

from api import mobile_menu_views, mobile_order_views, mobile_payment_views, mobile_reservation_views
from api.models import Bills, MenuCategories, MenuItems, Orders, Payments, Reservations


class SSU06PregledMenijaTests(SimpleTestCase):
    def test_broj_i_decimalna_vrednost_se_normalizuju(self):
        self.assertEqual(mobile_menu_views.normalize_number("7"), 7)
        self.assertIsNone(mobile_menu_views.normalize_number("sedam"))
        self.assertEqual(mobile_menu_views.decimal_to_float(Decimal("349.50")), 349.5)

    def test_kategorija_i_stavka_imaju_kontrolu_aktivnosti(self):
        self.assertEqual(MenuCategories._meta.get_field("active").get_default(), 1)
        self.assertEqual(MenuItems._meta.get_field("available").get_default(), 1)


class SSU07DodavanjeStavkiTests(SimpleTestCase):
    def test_kolicina_je_ogranicena_na_opseg_0_do_99(self):
        self.assertEqual(mobile_order_views.normalize_quantity(-1), 0)
        self.assertEqual(mobile_order_views.normalize_quantity(2), 2)
        self.assertEqual(mobile_order_views.normalize_quantity(1000), 99)
        self.assertEqual(mobile_order_views.normalize_quantity("neispravno"), 0)

    def test_razliciti_nazivi_polja_stavke_i_opcija(self):
        self.assertEqual(mobile_order_views.get_item_menu_id({"menu_item_id": "m-1"}), "m-1")
        self.assertEqual(
            mobile_order_views.get_option_ids({"selectedOptions": [{"id": "o-1"}, "o-2", {}]}),
            ["o-1", "o-2"],
        )

    def test_narudzbina_podrazumevano_pocinje_kao_nacrt(self):
        self.assertEqual(Orders._meta.get_field("status").get_default(), "draft")


class SSU08PracenjeStatusaTests(SimpleTestCase):
    def test_statusi_baze_se_mapiraju_na_mobilni_prikaz(self):
        self.assertEqual(mobile_order_views.item_status_to_mobile("rejected"), "rejected")
        self.assertEqual(mobile_order_views.item_status_to_mobile("served"), "served")
        self.assertEqual(mobile_order_views.item_status_to_mobile("ready"), "preparing")

    def test_model_cuva_vremena_odobravanja_i_izmene(self):
        self.assertTrue(Orders._meta.get_field("approved_at").null)
        self.assertFalse(Orders._meta.get_field("updated_at").null)


class SSU09OnlinePlacanjeTests(SimpleTestCase):
    def test_novac_se_zaokruzuje_i_neispravan_unos_daje_nulu(self):
        self.assertEqual(mobile_payment_views.money("10.125"), Decimal("10.13"))
        self.assertEqual(mobile_payment_views.money("nije-broj"), Decimal("0.00"))

    def test_nepodrzana_opcija_se_menja_rezervnom(self):
        self.assertEqual(mobile_payment_views.normalize_choice("card", {"cash", "card"}, "cash"), "card")
        self.assertEqual(mobile_payment_views.normalize_choice("crypto", {"cash", "card"}, "cash"), "cash")

    def test_racun_i_placanje_imaju_pocetne_statuse(self):
        self.assertEqual(Bills._meta.get_field("status").get_default(), "open")
        self.assertEqual(Payments._meta.get_field("status").get_default(), "pending")


class SSU10RezervacijaTests(SimpleTestCase):
    def test_vreme_prihvata_granice_i_odbija_neispravne_vrednosti(self):
        self.assertEqual(str(mobile_reservation_views.parse_time_value("00:00")), "00:00:00")
        self.assertEqual(str(mobile_reservation_views.parse_time_value("23.59")), "23:59:00")
        self.assertIsNone(mobile_reservation_views.parse_time_value("24:00"))
        self.assertIsNone(mobile_reservation_views.parse_time_value("12:7"))

    def test_broj_gostiju_je_u_opsegu_1_do_30(self):
        self.assertEqual(mobile_reservation_views.normalize_guest_count(0), 1)
        self.assertEqual(mobile_reservation_views.normalize_guest_count(8), 8)
        self.assertEqual(mobile_reservation_views.normalize_guest_count(31), 30)

    def test_zona_none_prihvata_svaki_sektor(self):
        table = SimpleNamespace(sector=SimpleNamespace(id="vip", name="VIP", description="separe"))
        self.assertTrue(mobile_reservation_views.sector_matches_zone(table, "none"))
        self.assertTrue(mobile_reservation_views.sector_matches_zone(table, "VIP"))
        self.assertFalse(mobile_reservation_views.sector_matches_zone(table, "nepoznata-zona"))

    def test_rezervacija_podrazumevano_ceka(self):
        self.assertEqual(Reservations._meta.get_field("status").get_default(), "pending")

