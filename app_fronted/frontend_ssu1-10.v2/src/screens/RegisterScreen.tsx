// Autor: Ivana Mušikić 2023/0204
//
// SSU1 — Registracija korisnika.
// Komponenta prikazuje formu za kreiranje korisničkog naloga.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useTableSession } from '../context/TableSessionContext';

export default function RegisterScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session, isAnonymous, register, continueAsGuest } = useMobileAuth();
  const { hasActiveTableSession } = useTableSession();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatedPassword, setRepeatedPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);

  const isCurrentAnonymousGuest = Boolean(session?.token && isAnonymous);
  const guestReturnLabel = hasActiveTableSession ? 'Vrati se na meni' : 'Skeniraj QR kod';
  const guestReturnPath = hasActiveTableSession ? '/menu' : '/scan';

  async function handleRegister() {
    if (
      !fullName.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password.trim() ||
      !repeatedPassword.trim()
    ) {
      showToast('error', 'Popunite sva polja');
      return;
    }

    if (password !== repeatedPassword) {
      showToast('error', 'Lozinke se ne poklapaju');
      return;
    }

    if (password.length < 6) {
      showToast('error', 'Lozinka mora imati bar 6 karaktera');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });

      showToast('success', 'Nalog je uspešno kreiran');

      setTimeout(() => {
        navigate('/profile');
      }, 500);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Registracija nije uspela');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGuest() {
    if (isCurrentAnonymousGuest) {
      navigate(guestReturnPath);
      return;
    }

    setIsGuestSubmitting(true);

    try {
      await continueAsGuest();
      showToast('info', 'Nastavljate kao gost');

      setTimeout(() => {
        navigate('/scan');
      }, 500);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Nije moguće nastaviti kao gost');
    } finally {
      setIsGuestSubmitting(false);
    }
  }

  return (
    <div className="screen ssu-register-screen ssu-screen ssu-centered-access-screen">
      <section className="glass-card ssu-centered-access-card ssu-auth-centered-card ssu-register-centered-card">
        <div className="ssu-centered-icon">+</div>

        <div className="ssu-centered-copy">
          <p className="eyebrow">Novi nalog</p>
          <h1>Kreirajte OpenTab profil</h1>
          <p>
            Sa nalogom čuvate profil, dodajete prijatelje, pravite grupe i šaljete
            rezervacije.
          </p>
        </div>

        <div className="ssu-centered-form">
          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="register-full-name">
              Ime i prezime
            </label>
            <input
              id="register-full-name"
              className="ssu-input"
              type="text"
              placeholder="Pera Perić"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={isSubmitting || isGuestSubmitting}
            />
          </div>

          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="register-username">
              Korisničko ime
            </label>
            <input
              id="register-username"
              className="ssu-input"
              type="text"
              placeholder="pera.p"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSubmitting || isGuestSubmitting}
            />
          </div>

          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="register-email">
              Email adresa
            </label>
            <input
              id="register-email"
              className="ssu-input"
              type="email"
              placeholder="pera@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting || isGuestSubmitting}
            />
          </div>

          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="register-password">
              Lozinka
            </label>
            <input
              id="register-password"
              className="ssu-input"
              type="password"
              placeholder="Lozinka"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting || isGuestSubmitting}
            />
          </div>

          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="register-repeated-password">
              Ponovite lozinku
            </label>
            <input
              id="register-repeated-password"
              className="ssu-input"
              type="password"
              placeholder="Ponovo unesite lozinku"
              value={repeatedPassword}
              onChange={(event) => setRepeatedPassword(event.target.value)}
              disabled={isSubmitting || isGuestSubmitting}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleRegister();
                }
              }}
            />
          </div>
        </div>

        <div className="ssu-centered-actions">
          <button className="primary-action-button ssu-main-action" onClick={handleRegister} disabled={isSubmitting || isGuestSubmitting}>
            <span>{isSubmitting ? 'Kreiranje naloga...' : 'Registruj se'}</span>
            <span>→</span>
          </button>

          <button className="ssu-link-button" onClick={() => navigate('/login')} disabled={isSubmitting || isGuestSubmitting}>
            Već imate nalog? Prijavite se
          </button>

          <button className="ssu-link-button muted" onClick={handleGuest} disabled={isSubmitting || isGuestSubmitting}>
            {isCurrentAnonymousGuest ? guestReturnLabel : isGuestSubmitting ? 'Pokretanje gosta...' : 'Nastavi kao gost'}
          </button>
        </div>
      </section>
    </div>
  );
}
