import { useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import XIcon from '../icons/XIcon';

interface StandardBottomSheetProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  sheetClassName?: string;
  children: ReactNode;
}

export default function StandardBottomSheet({ open, onClose, ariaLabel, sheetClassName = '', children }: StandardBottomSheetProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const startY = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  if (!open) return null;

  const finishClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 280);
  };

  const beginDrag = (event: PointerEvent<HTMLButtonElement>) => {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    panelRef.current?.classList.add('dragging');
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null || !panelRef.current) return;
    const delta = Math.max(0, event.clientY - startY.current);
    panelRef.current.style.transform = `translateY(${Math.min(delta, 260)}px)`;
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (startY.current === null || !panelRef.current) return;
    const delta = event.clientY - startY.current;
    const closeThreshold = panelRef.current.getBoundingClientRect().height * 0.2;
    startY.current = null;
    panelRef.current.classList.remove('dragging');
    panelRef.current.style.transform = '';
    if (delta > closeThreshold) finishClose();
  };

  const host = document.querySelector('.app-shell') ?? document.body;

  return createPortal(
    <div
      className={`standard-global-sheet-overlay${closing ? ' closing' : ''}`}
      role="dialog"
      aria-label={ariaLabel}
      onClick={(event) => {
        if (event.target === event.currentTarget) finishClose();
      }}
    >
      <section
        className={`standard-global-sheet standard-bottom-sheet ${sheetClassName}${closing ? ' closing' : ''}`}
        ref={panelRef}
      >
        <div className="standard-global-sheet-chrome sheet-sticky-chrome">
          <button
            className="cart-sheet-handle"
            type="button"
            aria-label="Povucite nadole za zatvaranje"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
          <button className="sheet-close danger" type="button" aria-label="Zatvori" onClick={finishClose}>
            <XIcon />
          </button>
        </div>
        {children}
      </section>
    </div>,
    host,
  );
}
