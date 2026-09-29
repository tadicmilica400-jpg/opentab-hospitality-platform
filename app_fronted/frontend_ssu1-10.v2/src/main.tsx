import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import './styles/guest-theme.css';
import './styles/guest-components.css';
import './styles/guest-screens.css';
import './styles/ssu1-5.css';
import App from './App';
import { CartProvider } from './context/CartContext';
import { CartSheetProvider } from './context/CartSheetContext';
import { ModalProvider } from './context/ModalContext';
import { OrderProvider } from './context/OrderContext';
import { ReservationProvider } from './context/ReservationContext';
import { ToastProvider } from './context/ToastContext';
import { MobileAuthProvider } from './context/MobileAuthContext';
import { TableSessionProvider } from './context/TableSessionContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <MobileAuthProvider>
        <TableSessionProvider>
          <OrderProvider>
            <ReservationProvider>
              <CartProvider>
                <CartSheetProvider>
                  <ModalProvider>
                    <App />
                  </ModalProvider>
                </CartSheetProvider>
              </CartProvider>
            </ReservationProvider>
          </OrderProvider>
        </TableSessionProvider>
      </MobileAuthProvider>
    </ToastProvider>
  </StrictMode>,
);
