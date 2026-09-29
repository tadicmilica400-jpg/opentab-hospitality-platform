// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import { formatRsd } from "../../workspace/formatRsd";

type WaiterMenuItemCardProps = {
  name: string;
  description?: string;
  price: number;
  quantityInCart: number;
  onAdd: () => void;
};

export function WaiterMenuItemCard({ name, description, price, quantityInCart, onAdd }: WaiterMenuItemCardProps) {
  const inCart = quantityInCart > 0;

  return (
    <button type="button" className={`waiter-menu-card ${inCart ? "in-cart" : ""}`} onClick={onAdd}>
      <div className="waiter-menu-card-copy">
        <h4>{name}</h4>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="waiter-menu-card-foot">
        <span className="waiter-menu-card-price">{formatRsd(price)}</span>
        <span className="waiter-menu-card-add" aria-label={inCart ? `${quantityInCart} u korpi` : "Dodaj u narudžbinu"}>
          {inCart ? quantityInCart : "+"}
        </span>
      </div>
    </button>
  );
}
