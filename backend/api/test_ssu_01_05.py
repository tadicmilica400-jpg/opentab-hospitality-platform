from types import SimpleNamespace

from django.test import SimpleTestCase

from api import mobile_auth_views, mobile_friend_views, mobile_group_views, mobile_table_views
from api.models import FriendRequests, GuestGroups, Guests, Users, VenueTables


class SSU01RegistracijaPrijavaTests(SimpleTestCase):
    def test_email_i_korisnicko_ime_se_normalizuju(self):
        self.assertEqual(mobile_auth_views.normalize_email("  GOST@Primer.RS  "), "gost@primer.rs")
        self.assertEqual(mobile_auth_views.normalize_username(" Gost 01!? "), "gost01")

    def test_puno_ime_i_prazan_unos(self):
        self.assertEqual(mobile_auth_views.split_name({"fullName": "Ana Anić"}), ("Ana", "Anić"))
        self.assertEqual(mobile_auth_views.split_name({}), ("Gost", "-"))

    def test_users_model_ima_jedinstvene_identifikatore(self):
        self.assertTrue(Users._meta.get_field("email").unique)
        self.assertTrue(Users._meta.get_field("username").unique)
        self.assertEqual(Users._meta.db_table, "users")


class SSU02PregledProfilaTests(SimpleTestCase):
    def test_prikaz_imena_ima_rezervnu_vrednost(self):
        named = SimpleNamespace(first_name="Mila", last_name="Milić", username="mila")
        anonymous = SimpleNamespace(first_name="", last_name="", username="")
        self.assertEqual(mobile_table_views.get_display_name(named), "Mila Milić")
        self.assertEqual(mobile_table_views.get_display_name(anonymous), "Gost")

    def test_guest_reward_points_podrazumevano_nula(self):
        field = Guests._meta.get_field("reward_points")
        self.assertEqual(field.get_default(), 0)


class SSU03SistemPrijateljaTests(SimpleTestCase):
    def test_par_prijatelja_je_kanonski_bez_obzira_na_redosled(self):
        self.assertEqual(mobile_friend_views.friend_pair("g02", "g01"), ("g01", "g02"))
        self.assertEqual(
            mobile_friend_views.friend_pair("g01", "g02"),
            mobile_friend_views.friend_pair("g02", "g01"),
        )

    def test_puno_ime_koristi_username_kada_nema_imena(self):
        user = SimpleNamespace(first_name="", last_name="", username="gost_01")
        self.assertEqual(mobile_friend_views.full_name(user), "gost_01")

    def test_zahtev_za_prijateljstvo_podrazumevano_ceka(self):
        self.assertEqual(FriendRequests._meta.get_field("status").get_default(), "pending")


class SSU04KreiranjeGrupeTests(SimpleTestCase):
    def test_oznaka_stola_za_povezanu_i_nepovezanu_grupu(self):
        session = SimpleNamespace(table_id="t01", table=SimpleNamespace(table_number="12"))
        self.assertEqual(mobile_group_views.table_label(session), "Sto 12")
        self.assertEqual(mobile_group_views.table_label(None), "Sto")

    def test_grupa_je_podrazumevano_aktivna(self):
        self.assertEqual(GuestGroups._meta.get_field("status").get_default(), "active")
        self.assertEqual(GuestGroups._meta.db_table, "guest_groups")


class SSU05SkeniranjeQRKodaTests(SimpleTestCase):
    def test_kod_stola_daje_sve_podrzane_varijante(self):
        variants = mobile_table_views.normalized_code_variants("Sto-12")
        self.assertTrue({"Sto-12", "STO-12", "12", "Sto 12", "STO12"}.issubset(variants))

    def test_prazan_qr_kod_nema_varijante(self):
        self.assertEqual(mobile_table_views.normalized_code_variants("   "), set())

    def test_model_stola_cuva_qr_token_i_podrazumevani_status(self):
        self.assertEqual(VenueTables._meta.get_field("status").get_default(), "free")
        self.assertFalse(VenueTables._meta.get_field("qr_token").null)

