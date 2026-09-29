import type { MenuItem } from '../../types';
import PlusIcon from '../icons/PlusIcon';

interface MenuItemCardProps {
  item: MenuItem;
  onOpen: (item: MenuItem) => void;
}

export default function MenuItemCard({ item, onOpen }: MenuItemCardProps) {
  return (
    <article className="product-card" onClick={() => onOpen(item)}>
      <img className="product-img" src={item.image} alt={item.name} loading="lazy" />
      <div className="product-copy">
        <div className="product-topline">
          <h3>{item.name}</h3>
          {item.badge && <span className="product-badge">{item.badge}</span>}
        </div>
        <p>{item.desc}</p>
        <div className="product-bottom">
          <span className="product-price">{item.price.toLocaleString('sr-RS')} RSD</span>
          <button className="product-add" type="button" aria-label={`Dodaj ${item.name}`} onClick={(event) => { event.stopPropagation(); onOpen(item); }}>
            <PlusIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
