import { useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useCart } from '../../context/CartContext';
import { useModal } from '../../context/ModalContext';
import { useReservation } from '../../context/ReservationContext';
import { useToast } from '../../context/ToastContext';
import type { CartItem, MenuItem, MenuOption } from '../../types';
import TrayIcon from '../icons/TrayIcon';
import XIcon from '../icons/XIcon';
import QuantityStepper from '../ui/QuantityStepper';
import PrimaryActionButton from '../ui/PrimaryActionButton';
import OptionSelector from './OptionSelector';

function optionGroupName(option: MenuOption): string {
  return option.group?.trim() || 'Ostalo';
}

function groupOptions(options: MenuOption[]): Record<string, MenuOption[]> {
  return options.reduce<Record<string, MenuOption[]>>((acc, option) => {
    const group = optionGroupName(option);
    acc[group] = acc[group] ? [...acc[group], option] : [option];
    return acc;
  }, {});
}

function initialOptions(item: MenuItem): MenuOption[] {
  const selected: MenuOption[] = [];

  Object.values(groupOptions(item.options ?? [])).forEach((options) => {
    const first = options[0];
    const minChoices = first?.minChoices ?? 0;
    const required = Boolean(first?.required) || minChoices > 0;

    if (!required) return;

    const count = Math.max(1, minChoices);
    selected.push(...options.slice(0, count));
  });

  return selected;
}

function findMissingRequiredGroup(item: MenuItem, selectedOptions: MenuOption[]): string | null {
  const selectedByGroup = groupOptions(selectedOptions);

  for (const [group, options] of Object.entries(groupOptions(item.options ?? []))) {
    const first = options[0];
    const minChoices = first?.minChoices ?? 0;
    const required = Boolean(first?.required) || minChoices > 0;

    if (!required) continue;

    if ((selectedByGroup[group]?.length ?? 0) < Math.max(1, minChoices)) {
      return group;
    }
  }

  return null;
}

function cartSignature(item: MenuItem, options: MenuOption[], note: string): string {
  const optionIds = options.map((option) => option.id).sort().join('-');
  return `${item.id}-${optionIds}-${note.trim().toLowerCase()}`;
}

function makeCartItem(item: MenuItem, selectedOptions: MenuOption[], note: string, qty: number): CartItem {
  const unitPrice = item.price + selectedOptions.reduce((sum, option) => sum + (option.priceDelta ?? 0), 0);
  return {
    id: cartSignature(item, selectedOptions, note),
    menuItem: item,
    qty,
    selectedOptions,
    note,
    unitPrice,
    totalPrice: unitPrice * qty,
  };
}

export default function ItemDetailSheet() {
  const { item, mode, closeItem } = useModal();
  if (!item) return null;
  return <ItemDetailContent key={`${mode}-${item.id}`} item={item} mode={mode} closeItem={closeItem} />;
}

function ItemDetailContent({ item, mode, closeItem }: { item: MenuItem; mode: 'cart' | 'preorder'; closeItem: () => void }) {
  const { addToCart } = useCart();
  const { addPreorder } = useReservation();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<MenuOption[]>(() => initialOptions(item));
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  const startY = useRef<number | null>(null);
  const unitPrice = useMemo(() => item.price + selected.reduce((sum, option) => sum + (option.priceDelta ?? 0), 0), [item.price, selected]);
  const totalPrice = unitPrice * qty;

  const beginDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (isAdding) return;
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetRef.current?.classList.add('dragging');
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null || !sheetRef.current) return;
    const delta = Math.max(0, event.clientY - startY.current);
    sheetRef.current.style.transform = `translateY(${Math.min(delta, 260)}px)`;
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null || !sheetRef.current) return;
    const delta = event.clientY - startY.current;
    const closeThreshold = sheetRef.current.getBoundingClientRect().height * 0.2;
    startY.current = null;
    sheetRef.current.classList.remove('dragging');
    sheetRef.current.style.transform = '';
    if (delta > closeThreshold) closeItem();
  };

  const handleAdd = () => {
    if (isAdding) return;

    const missingGroup = findMissingRequiredGroup(item, selected);
    if (missingGroup) {
      showToast('error', `Izaberite opciju: ${missingGroup}`);
      return;
    }

    setIsAdding(true);
    closeItem();
    window.setTimeout(() => {
      const cleanNote = note.trim();
      if (mode === 'preorder') {
        addPreorder(makeCartItem(item, selected, cleanNote, qty));
        showToast('success', 'Dodato u preorder');
        return;
      }
      addToCart(item, selected, cleanNote, qty);
    }, 380);
  };

  return (
    <div className="sheet-overlay visible standard-sheet-overlay" onClick={(event) => { if (event.target === event.currentTarget && !isAdding) closeItem(); }}>
      <section className={`item-detail-sheet standard-bottom-sheet${isAdding ? ' adding' : ''}`} ref={sheetRef}>
        <div className="sheet-sticky-chrome item-sheet-chrome">
          <button
            className="cart-sheet-handle"
            type="button"
            aria-label="Povucite nadole za zatvaranje"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
          <button className="sheet-close danger" type="button" aria-label="Zatvori" onClick={closeItem} disabled={isAdding}><XIcon /></button>
        </div>
        <div className="item-detail-scroll">
          <img className="sheet-image" src={item.image} alt={item.name} />
          <div className="sheet-title-row">
            <div>
              <h2>{item.name}</h2>
              <p>{item.desc}</p>
            </div>
            <span className="sheet-price">{unitPrice.toLocaleString('sr-RS')} RSD</span>
          </div>
          <div className="sheet-section-label">Opcije i dodaci</div>
          <OptionSelector options={item.options ?? []} selected={selected} onChange={setSelected} />
          <label className="sheet-section-label" htmlFor="item-note">Napomena za pripremu</label>
          <textarea id="item-note" className="note-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="npr. manje leda, bez šećera, alergija..." />
        </div>
        <div className="sheet-footer-row">
          <QuantityStepper value={qty} onMinus={() => setQty((value) => Math.max(1, value - 1))} onPlus={() => setQty((value) => value + 1)} />
          <PrimaryActionButton label={isAdding ? 'Dodaje se' : mode === 'preorder' ? 'Dodaj u preorder' : 'Dodaj'} price={`${totalPrice.toLocaleString('sr-RS')} RSD`} onClick={handleAdd} disabled={isAdding} />
        </div>
        {isAdding && (
          <div className="cart-fly-chip" aria-hidden="true">
            <TrayIcon />
            <span>{qty}</span>
          </div>
        )}
      </section>
    </div>
  );
}
