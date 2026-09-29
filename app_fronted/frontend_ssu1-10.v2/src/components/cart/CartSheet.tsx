import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { mobileCreateOrder } from '../../api/mobileOrders';
import { useCart } from '../../context/CartContext';
import { useCartSheet } from '../../context/CartSheetContext';
import { useMobileAuth } from '../../context/MobileAuthContext';
import { useOrder } from '../../context/OrderContext';
import { useTableSession } from '../../context/TableSessionContext';
import { useToast } from '../../context/ToastContext';
import XIcon from '../icons/XIcon';
import PrimaryActionButton from '../ui/PrimaryActionButton';
import CartEmptyState from './CartEmptyState';
import CartItemCard from './CartItemCard';

export default function CartSheet() {
  const navigate = useNavigate();
  const { isCartOpen, closeCart } = useCartSheet();
  const { cart, changeQty, removeFromCart, clearCart, totalPrice, totalItems } = useCart();
  const { session } = useMobileAuth();
  const { tableSession } = useTableSession();
  const { setCurrentOrder } = useOrder();
  const { showToast } = useToast();
  const panelRef = useRef<HTMLElement | null>(null);
  const startY = useRef<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      closeCart();
      setIsClosing(false);
    }, 280);
  };

  if (!isCartOpen) return null;

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    panelRef.current?.classList.add('dragging');
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null || !panelRef.current) return;
    const delta = Math.max(0, event.clientY - startY.current);
    panelRef.current.style.transform = `translateY(${Math.min(delta, 240)}px)`;
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null || !panelRef.current) return;
    const delta = event.clientY - startY.current;
    const closeThreshold = panelRef.current.getBoundingClientRect().height * 0.2;
    startY.current = null;
    panelRef.current.classList.remove('dragging');
    panelRef.current.style.transform = '';
    if (delta > closeThreshold) { requestClose(); return; }
  };

  const handleSend = async () => {
    if (cart.length === 0 || isSending) return;

    if (!session?.token) {
      showToast('error', 'Prvo se prijavite ili nastavite kao gost.');
      navigate('/login');
      return;
    }

    if (!tableSession) {
      showToast('error', 'Prvo skenirajte QR kod stola.');
      navigate('/scan');
      return;
    }

    setIsSending(true);

    try {
      const response = await mobileCreateOrder(session.token, cart);

      if (!response.order) {
        throw new Error('Narudžbina nije vraćena iz baze.');
      }

      setCurrentOrder(response.order);
      clearCart();
      requestClose();
      showToast('success', 'Narudžbina je poslata konobaru.');
      window.setTimeout(() => navigate('/status'), 300);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Slanje narudžbine nije uspelo.');
    } finally {
      setIsSending(false);
    }
  };

  const venueName = tableSession?.venue.name ?? 'Lokal';
  const tableLabel = tableSession?.table.label ?? 'Sto';

  return (
    <div className={`cart-sheet-overlay standard-sheet-overlay${isClosing ? ' closing' : ''}`} role="dialog" aria-label="Korpa" onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className={`cart-sheet-panel standard-bottom-sheet${isClosing ? ' closing' : ''}`} ref={panelRef}>
        <div className="sheet-sticky-chrome cart-sheet-chrome">
          <button
            className="cart-sheet-handle"
            type="button"
            aria-label="Povucite nadole za zatvaranje korpe"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <button className="sheet-close danger" type="button" aria-label="Zatvori korpu" onClick={requestClose}><XIcon /></button>
        </div>
        <div className="cart-sheet-head">
          <div className="cart-title-group">
            <div className="cart-title">Korpa</div>
            <div className="cart-subtitle">{totalItems} stavki · {venueName} · {tableLabel}</div>
          </div>
        </div>

        <div className="cart-sheet-scroll">
          {cart.length === 0 ? <CartEmptyState /> : (
            <div className="cart-item-list">
              {cart.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onMinus={() => changeQty(item.id, -1)}
                  onPlus={() => changeQty(item.id, 1)}
                  onRemove={() => removeFromCart(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-sheet-action">
            <PrimaryActionButton label={isSending ? 'Šalje se' : 'Pošalji narudžbinu'} price={`${totalPrice.toLocaleString('sr-RS')} RSD`} onClick={handleSend} disabled={isSending} />
          </div>
        )}
      </section>
    </div>
  );
}
