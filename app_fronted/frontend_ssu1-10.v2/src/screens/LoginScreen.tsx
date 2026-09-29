// Autor: Ivana Mušikić 2023/0204
//
// SSU1 — Prijava korisnika.
// Komponenta prikazuje formu za prijavu i omogućava korisniku da nastavi kao gost.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useTableSession } from '../context/TableSessionContext';

export default function LoginScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session, isAnonymous, login, continueAsGuest } = useMobileAuth();
  const { hasActiveTableSession } = useTableSession();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);

  const isCurrentAnonymousGuest = Boolean(session?.token && isAnonymous);
  const guestReturnLabel = hasActiveTableSession ? 'Vrati se na meni' : 'Skeniraj QR kod';
  const guestReturnPath = hasActiveTableSession ? '/menu' : '/scan';

  async function handleLogin() {
    if (!identifier.trim() || !password.trim()) {
      showToast('error', 'Popunite email/korisničko ime i lozinku');
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ identifier: identifier.trim(), password });
      showToast('success', 'Uspešno ste se prijavili');

      setTimeout(() => {
        navigate('/menu');
      }, 500);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Prijava nije uspela');
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
    <div className="screen ssu-login-screen ssu-screen ssu-centered-access-screen">
      <section className="glass-card ssu-centered-access-card ssu-auth-centered-card">
        <div className="ssu-centered-icon">OT</div>

        <div className="ssu-centered-copy">
          <p className="eyebrow">OpenTab nalog</p>
          <h1>Dobrodošli nazad</h1>
          <p>
            Prijavite se da biste koristili profil, prijatelje, grupu za stolom i
            rezervacije.
          </p>
        </div>

        <div className="ssu-centered-form">
          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="login-identifier">
              Email ili korisničko ime
            </label>
            <input
              id="login-identifier"
              className="ssu-input"
              type="text"
              placeholder="pera@example.com"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={isSubmitting || isGuestSubmitting}
            />
          </div>

          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="login-password">
              Lozinka
            </label>
            <input
              id="login-password"
              className="ssu-input"
              type="password"
              placeholder="Unesite lozinku"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting || isGuestSubmitting}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleLogin();
                }
              }}
            />
          </div>
        </div>

        <div className="ssu-centered-actions">
          <button className="primary-action-button ssu-main-action" onClick={handleLogin} disabled={isSubmitting || isGuestSubmitting}>
            <span>{isSubmitting ? 'Prijavljivanje...' : 'Prijavi se'}</span>
            <span>→</span>
          </button>

          <button className="ssu-link-button" onClick={() => navigate('/register')} disabled={isSubmitting || isGuestSubmitting}>
            Nemate nalog? Registrujte se
          </button>

          <button className="ssu-link-button muted" onClick={handleGuest} disabled={isSubmitting || isGuestSubmitting}>
            {isCurrentAnonymousGuest ? guestReturnLabel : isGuestSubmitting ? 'Pokretanje gosta...' : 'Nastavi kao gost'}
          </button>
        </div>
      </section>
    </div>
  );
}
