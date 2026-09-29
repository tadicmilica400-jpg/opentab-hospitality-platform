import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartSheet } from '../context/CartSheetContext';

export default function CartScreen() {
  const navigate = useNavigate();
  const { openCart } = useCartSheet();

  useEffect(() => {
    openCart();
    navigate('/menu', { replace: true });
  }, [navigate, openCart]);

  return null;
}
