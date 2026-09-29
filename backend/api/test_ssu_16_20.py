from decimal import Decimal
from types import SimpleNamespace

from django.test import SimpleTestCase

from api import views, waiter_services
from api.models import MenuItems, VenueSectors, VenueTables, WaiterRevenueGoals, Waiters


class SSU16UpravljanjeMenijemTests(SimpleTestCase):
    def test_konverzije_ulaza_ne_propustaju_neispravne_vrednosti(self):
        self.assertEqual(views.get_bool(True), 1)
        self.assertEqual(views.get_bool("false"), 0)
        self.assertEqual(views.get_int("12"), 12)
        self.assertEqual(views.get_int("x", 7), 7)
        self.assertEqual(views.get_decimal("19.90"), Decimal("19.90"))
        self.assertEqual(views.get_decimal("x", "3.5"), Decimal("3.5"))

    def test_slika_prihvata_https_i_odbija_nepodrzan_format(self):
        self.assertEqual(views.get_clean_image(" https://example.test/item.png "), "https://example.test/item.png")
        with self.assertRaises(ValueError):
            views.get_clean_image("http://example.test/item.png")
        with self.assertRaises(ValueError):
            views.get_clean_image("data:image/svg+xml;base64,PHN2Zz4=")

    def test_stavka_menija_ima_cenu_i_stanje_dostupnosti(self):
        self.assertEqual(MenuItems._meta.get_field("available").get_default(), 1)
        self.assertEqual(MenuItems._meta.get_field("price").decimal_places, 2)


class SSU17KonfiguracijaMapeTests(SimpleTestCase):
    def test_sektor_i_sto_imaju_koordinate_i_dimenzije(self):
        for model in (VenueSectors, VenueTables):
            for field_name in ("position_x", "position_y", "width", "height"):
                with self.subTest(model=model.__name__, field=field_name):
                    self.assertTrue(model._meta.get_field(field_name).null)

    def test_oblik_stola_podrazumevano_je_okrugao(self):
        self.assertEqual(VenueTables._meta.get_field("shape").get_default(), "round")


class SSU18UpravljanjeOsobljemTests(SimpleTestCase):
    def test_ime_radnika_se_deli_na_ime_i_prezime(self):
        self.assertEqual(views.split_full_name("  Ana   Anić  "), ("Ana", "Anić"))
        self.assertEqual(views.split_full_name("Ana"), ("Ana", "-"))
        self.assertEqual(views.split_full_name(""), ("", ""))

    def test_opcioni_datum_prihvata_iso_i_odbija_neispravan_format(self):
        value, error = views.parse_optional_date("2026-07-12", "Datum")
        self.assertEqual(str(value), "2026-07-12")
        self.assertIsNone(error)
        value, error = views.parse_optional_date("12/07/2026", "Datum")
        self.assertIsNone(value)
        self.assertEqual(error.status_code, 400)

    def test_konobar_je_aktivan_i_ima_pocetnu_ocenu(self):
        self.assertEqual(Waiters._meta.get_field("active").get_default(), 1)
        self.assertEqual(Waiters._meta.get_field("rating").get_default(), 0)


class SSU19AnalitickiDashboardTests(SimpleTestCase):
    def test_procentualna_promena_pokriva_nultu_osnovu_i_pad(self):
        self.assertIsNone(views.percent_change(0, 0))
        self.assertEqual(views.percent_change(10, 0), 100)
        self.assertEqual(views.percent_change(75, 100), -25.0)
        self.assertEqual(views.percent_change(125, 100), 25.0)

    def test_novac_se_zaokruzuje_na_dve_decimale(self):
        self.assertEqual(views.to_money(12.345), 12.35)
        self.assertEqual(views.to_number(None), 0.0)

    def test_cilj_prihoda_ima_podrazumevani_rezim_i_metriku(self):
        self.assertEqual(WaiterRevenueGoals._meta.get_field("target_mode").get_default(), "single")
        self.assertEqual(WaiterRevenueGoals._meta.get_field("target_metric").get_default(), "revenue")


class SSU20InteraktivnaMapaKonobaraTests(SimpleTestCase):
    def test_svi_statusi_baze_se_mapiraju_u_status_mape(self):
        expected = {
            "reserved": "reserved",
            "waiting_payment": "payment",
            "occupied": "occupied",
            "waiting_order": "occupied",
            "in_preparation": "occupied",
            "free": "free",
        }
        for status, mapped in expected.items():
            with self.subTest(status=status):
                self.assertEqual(waiter_services.map_db_table_status(SimpleNamespace(status=status)), mapped)

    def test_sesija_za_naplatu_nadglasava_status_stola(self):
        result = waiter_services.map_db_table_status(
            SimpleNamespace(status="reserved"),
            SimpleNamespace(status="waiting_payment"),
        )
        self.assertEqual(result, "payment")

    def test_mapa_ima_poredak_sektora_i_broj_stola(self):
        self.assertEqual(VenueSectors._meta.get_field("display_order").get_default(), 0)
        self.assertFalse(VenueTables._meta.get_field("table_number").null)

