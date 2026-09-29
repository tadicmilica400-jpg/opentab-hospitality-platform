// Autori: Nina Kaljević, indeks: ____/____, Ivana Mušikić 2023/0204
//
// Glavna komponenta: rutiranje između ekrana aplikacije.

import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import PhoneFrame from './components/shell/PhoneFrame';
import MenuScreen from './screens/MenuScreen';
import StatusScreen from './screens/StatusScreen';
import PaymentScreen from './screens/PaymentScreen';
import ReservationScreen from './screens/ReservationScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ScanQrScreen from './screens/ScanQrScreen';
import FriendsScreen from './screens/FriendsScreen';
import GroupScreen from './screens/GroupScreen';
import TableRequiredScreen from './screens/TableRequiredScreen';
import { useTableSession } from './context/TableSessionContext';

/**
 * RequireTableSession prikazuje traženi ekran samo ako je sto povezan.
 * Ako sto nije povezan, prikazuje ekran za skeniranje QR koda.
 * @param children Ekran koji zahteva aktivan sto.
 * @returns JSX ekran ili poruka da sto nije povezan.
 */
function RequireTableSession({ children }: { children: ReactNode }) {
  const { hasActiveTableSession, isCheckingTableSession } = useTableSession();

  if (isCheckingTableSession) {
    return (
      <div className="screen ssu-table-required-screen ssu-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card ssu-table-required-card">
          <div className="ssu-centered-icon">…</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Povezivanje stola</p>
            <h1>Proveravamo sesiju</h1>
            <p>Sačekajte trenutak dok aplikacija proveri da li ste već povezani sa stolom.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!hasActiveTableSession) {
    return <TableRequiredScreen />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PhoneFrame />}>
          <Route index element={<Navigate to="/profile" replace />} />

          <Route
            path="menu"
            element={
              <RequireTableSession>
                <MenuScreen />
              </RequireTableSession>
            }
          />

          <Route path="cart" element={<Navigate to="/menu" replace />} />

          <Route
            path="status"
            element={
              <RequireTableSession>
                <StatusScreen />
              </RequireTableSession>
            }
          />

          <Route
            path="bill"
            element={
              <RequireTableSession>
                <PaymentScreen />
              </RequireTableSession>
            }
          />

          <Route
            path="payment"
            element={
              <RequireTableSession>
                <PaymentScreen />
              </RequireTableSession>
            }
          />

          <Route path="reservation" element={<ReservationScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="login" element={<LoginScreen />} />
          <Route path="register" element={<RegisterScreen />} />
          <Route path="scan" element={<ScanQrScreen />} />
          <Route path="friends" element={<FriendsScreen />} />
          <Route path="group" element={<GroupScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}