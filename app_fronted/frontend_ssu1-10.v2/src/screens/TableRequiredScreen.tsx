// Autor: Ivana Mušikić 2023/0204
//
// Ekran koji se prikazuje dok korisnik nije povezan sa stolom.

import { useNavigate } from 'react-router-dom';

/**
 * TableRequiredScreen obaveštava korisnika da mora da skenira QR kod stola
 * pre pristupa meniju i naručivanju.
 * @returns JSX ekran za povezivanje sa stolom.
 */
export default function TableRequiredScreen() {
  const navigate = useNavigate();

  return (
    <div className="screen ssu-table-required-screen ssu-screen ssu-centered-access-screen">
      <section className="glass-card ssu-centered-access-card ssu-table-required-card">
        <div className="ssu-centered-icon">QR</div>

        <div className="ssu-centered-copy">
          <p className="eyebrow">Povezivanje stola</p>
          <h1>Prvo skenirajte sto</h1>
          <p>
            Skenirajte QR kod na stolu da biste otvorili meni, poslali narudžbinu
            i pratili račun za svoju sesiju.
          </p>
        </div>

        <div className="ssu-centered-actions">
          <button className="primary-action-button ssu-main-action" onClick={() => navigate('/scan')}>
            <span>Skeniraj QR kod</span>
            <span>⌁</span>
          </button>
        </div>
      </section>
    </div>
  );
}
