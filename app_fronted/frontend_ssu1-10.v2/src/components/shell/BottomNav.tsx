import { useLocation, useNavigate } from 'react-router-dom';
import MenuIcon from '../icons/MenuIcon';
import ClockIcon from '../icons/ClockIcon';
import ReceiptIcon from '../icons/ReceiptIcon';
import PeopleIcon from '../icons/PeopleIcon';
import CalendarIcon from '../icons/CalendarIcon';

const tabs = [
  {
    path: '/menu',
    label: 'Meni',
    Icon: MenuIcon,
    match: (path: string) => path === '/' || path === '/menu',
  },
  {
    path: '/status',
    label: 'Status',
    Icon: ClockIcon,
    match: (path: string) => path === '/status',
  },
  {
    path: '/bill',
    label: 'Račun',
    Icon: ReceiptIcon,
    match: (path: string) => path === '/bill' || path === '/payment',
  },
  {
    path: '/group',
    label: 'Grupa',
    Icon: PeopleIcon,
    match: (path: string) => path === '/group',
  },
  {
    path: '/reservation',
    label: 'Rezervacija',
    Icon: CalendarIcon,
    match: (path: string) => path === '/reservation',
  },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <nav className="bottom-nav material-bar" aria-label="Donja navigacija">
      {tabs.map(({ path, label, Icon, match }) => (
        <button
          key={path}
          type="button"
          className={`nav-item${match(pathname) ? ' active' : ''}`}
          onClick={() => navigate(path)}
        >
          <span className="nav-icon">
            <Icon />
          </span>
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}