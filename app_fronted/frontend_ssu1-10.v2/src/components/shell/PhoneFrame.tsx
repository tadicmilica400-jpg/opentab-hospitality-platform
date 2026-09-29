import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import GuestHeader from './GuestHeader';
import ItemDetailSheet from '../menu/ItemDetailSheet';
import FloatingTrayButton from '../menu/FloatingTrayButton';
import CartSheet from '../cart/CartSheet';
import { useCartSheet } from '../../context/CartSheetContext';
import Toast from '../ui/Toast';
import { useTableSession } from '../../context/TableSessionContext';

export default function PhoneFrame() {
  const { pathname } = useLocation();
  const { isCartOpen } = useCartSheet();
  const { tableSession, hasActiveTableSession } = useTableSession();

  const venueName = tableSession?.venue.name || 'Kafe Aurora';
  const tableLabel = tableSession?.table.label || '';

  const isAuthScreen =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/profile';

  const showHeader = !isAuthScreen && hasActiveTableSession;

  const showFloatingTray = pathname === '/menu' && hasActiveTableSession && !isCartOpen;

  return (
    <div className="desktop-wrapper">
      <div className="phone-frame">
        <div className="app-shell">
          {showHeader && (
            <GuestHeader
              venueName={venueName}
              tableLabel={tableLabel}
              sessionLabel="aktivna sesija"
            />
          )}

          <main className={isAuthScreen ? 'guest-screen-slot auth-entry-slot' : 'guest-screen-slot'}>
            <Outlet />
          </main>

          {showFloatingTray && <FloatingTrayButton />}
          {!isAuthScreen && <BottomNav />}
          <Toast />
          <ItemDetailSheet />
          <CartSheet />
        </div>
      </div>
    </div>
  );
}