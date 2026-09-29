import { useNavigate } from 'react-router-dom';
import TrayIcon from '../icons/TrayIcon';
import PrimaryActionButton from '../ui/PrimaryActionButton';

export default function CartEmptyState() {
  const navigate = useNavigate();
  return (
    <div className="empty-state">
      <div className="empty-icon"><TrayIcon /></div>
      <div className="empty-title">Korpa je prazna</div>
      <p>Dodajte stavke iz menija pre slanja narudžbine.</p>
      <PrimaryActionButton label="Pogledaj meni" onClick={() => navigate('/menu')} />
    </div>
  );
}
