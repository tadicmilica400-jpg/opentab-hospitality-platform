// Autori: Nina Kaljević 2023/0583, Ivana Mušikić 2023/0204
//
// Zaglavlje aplikacije za gosta.
// Prikazuje naziv lokala, aktivni sto/sesiju i dugme koje vodi na profil korisnika.

import { useNavigate } from 'react-router-dom';
import UserIcon from '../icons/UserIcon';

interface GuestHeaderProps {
  venueName: string;
  tableLabel: string;
  sessionLabel: string;
}

/**
 * GuestHeader prikazuje informacije o trenutnoj sesiji u lokalu.
 * Klik na ikonicu korisnika otvara ekran profila.
 * @returns JSX zaglavlje aplikacije.
 */
export default function GuestHeader({ venueName, tableLabel, sessionLabel }: GuestHeaderProps) {
  const navigate = useNavigate();

  /**
   * Vodi korisnika na ekran profila.
   * Ako je korisnik gost, ProfileScreen prikazuje opcije za prijavu i registraciju.
   * @returns void
   */
  function handleProfileClick() {
    navigate('/profile');
  }

  return (
    <header className="guest-header">
      <div className="guest-header-card material-bar">
        <div className="guest-header-main">
          <span className="guest-venue-name">{venueName}</span>

          <div className="guest-session-pill">
            <span className="session-dot" />
            <span>{tableLabel}</span>
            <span className="session-separator">·</span>
            <span>{sessionLabel}</span>
          </div>
        </div>

        <button
          className="guest-avatar-button"
          type="button"
          aria-label="Otvori profil"
          onClick={handleProfileClick}
        >
          <UserIcon />
        </button>
      </div>
    </header>
  );
}