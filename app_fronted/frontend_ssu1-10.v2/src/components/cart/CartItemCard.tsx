import type { CartItem } from '../../types';
import TrashIcon from '../icons/TrashIcon';
import QuantityStepper from '../ui/QuantityStepper';

interface CartItemCardProps {
  item: CartItem;
  onMinus: () => void;
  onPlus: () => void;
  onRemove: () => void;
}

export default function CartItemCard({ item, onMinus, onPlus, onRemove }: CartItemCardProps) {
  return (
    <article className="cart-item-card">
      <img className="cart-item-image" src={item.menuItem.image} alt={item.menuItem.name} loading="lazy" />
      <div className="cart-item-main">
        <div className="cart-item-title-row">
          <span className="cart-item-title">{item.menuItem.name}</span>
          <button className="cart-item-remove" type="button" aria-label="Ukloni stavku" onClick={onRemove}><TrashIcon /></button>
        </div>

        {item.selectedOptions.length > 0 && (
          <div className="cart-option-chips">
            {item.selectedOptions.map((option) => (
              <span className="cart-option-chip" key={option.id}>{option.label}</span>
            ))}
          </div>
        )}

        {item.note && <div className="cart-note">{item.note}</div>}

        <div className="cart-item-footer">
          <QuantityStepper value={item.qty} onMinus={onMinus} onPlus={onPlus} />
          <span className="cart-item-price">{item.unitPrice.toLocaleString('sr-RS')} RSD</span>
        </div>
      </div>
    </article>
  );
}
