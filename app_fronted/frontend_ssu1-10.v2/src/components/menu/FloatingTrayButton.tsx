import { useEffect, useRef, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useCartSheet } from '../../context/CartSheetContext';
import TrayIcon from '../icons/TrayIcon';

export default function FloatingTrayButton() {
  const { totalItems } = useCart();
  const { openCart } = useCartSheet();
  const previousTotal = useRef(totalItems);
  const [bumping, setBumping] = useState(false);

  useEffect(() => {
    if (totalItems > previousTotal.current) {
      setBumping(false);
      window.requestAnimationFrame(() => setBumping(true));
      const timer = window.setTimeout(() => setBumping(false), 720);
      previousTotal.current = totalItems;
      return () => window.clearTimeout(timer);
    }
    previousTotal.current = totalItems;
    return undefined;
  }, [totalItems]);

  return (
    <button className={`floating-cart${bumping ? ' cart-bump' : ''}`} type="button" onClick={openCart} aria-label="Otvori korpu">
      <span className="cart-icon"><TrayIcon /></span>
      {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
    </button>
  );
}
