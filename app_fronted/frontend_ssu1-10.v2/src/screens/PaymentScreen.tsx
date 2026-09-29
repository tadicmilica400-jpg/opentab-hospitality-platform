import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mobileCreatePayment, mobileGetBill } from '../api/mobilePayments';
import type { MobileBill } from '../api/mobilePayments';
import CardIcon from '../components/icons/CardIcon';
import CashIcon from '../components/icons/CashIcon';
import PosIcon from '../components/icons/PosIcon';
import PrimaryActionButton from '../components/ui/PrimaryActionButton';
import SectionTitle from '../components/ui/SectionTitle';
import StandardBottomSheet from '../components/ui/StandardBottomSheet';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useTableSession } from '../context/TableSessionContext';
import { useToast } from '../context/ToastContext';
import type { PaymentMethod, SplitMode, TipValue } from '../types';

const tipOptions: TipValue[] = [0, 5, 10, 15, 'custom'];
const splitOptions: { key: SplitMode; label: string }[] = [
  { key: 'all', label: 'Plaćam sve' },
  { key: 'equal', label: 'Podeli jednako' },
  { key: 'items', label: 'Moje stavke' },
];
const methods: { key: PaymentMethod; title: string; subtitle: string; Icon: typeof CardIcon }[] = [
  { key: 'online-card', title: 'Kartica online', subtitle: 'Plati odmah u aplikaciji', Icon: CardIcon },
  { key: 'cash-waiter', title: 'Gotovina konobaru', subtitle: 'Konobar dolazi do stola', Icon: CashIcon },
  { key: 'card-waiter', title: 'Kartica konobaru', subtitle: 'POS terminal za sto', Icon: PosIcon },
];
const ctaLabels: Record<PaymentMethod, string> = { 'online-card': 'Plati online', 'cash-waiter': 'Pozovi konobara', 'card-waiter': 'Zatraži POS terminal' };
const sheetTitles: Record<PaymentMethod, string> = { 'online-card': 'Plaćanje', 'cash-waiter': 'Poziv konobaru', 'card-waiter': 'POS terminal' };
const sheetSubtitles: Record<PaymentMethod, string> = { 'online-card': 'Pregled i potvrda online plaćanja.', 'cash-waiter': 'Konobar će doći do stola zbog naplate.', 'card-waiter': 'Konobar donosi POS terminal do stola.' };

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('sr-RS')} RSD`;
}

function statusLabel(status: MobileBill['status']) {
  if (status === 'paid') return 'Plaćeno';
  if (status === 'partially_paid') return 'Delimično plaćeno';
  if (status === 'cancelled') return 'Otkazano';
  return 'Otvoren račun';
}

export default function PaymentScreen() {
  const navigate = useNavigate();
  const { session } = useMobileAuth();
  const { tableSession, refreshTableSession } = useTableSession();
  const { showToast } = useToast();
  const [bill, setBill] = useState<MobileBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tip, setTip] = useState<TipValue>(10);
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online-card');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  const loadBill = useCallback(async () => {
    if (!session?.token) {
      setLoading(false);
      setError('Moraš biti ulogovan ili nastaviti kao gost. Revolucionaran zahtev za aplikaciju koja čuva račun.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await mobileGetBill(session.token);
      setBill(response.bill);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Račun nije učitan.');
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  const displayedItems = useMemo(() => {
    if (!bill) return [];

    if (splitMode === 'items') {
      const ownItems = bill.items.filter((item) => item.isMine);
      return ownItems.length ? ownItems : bill.items;
    }

    return bill.items;
  }, [bill, splitMode]);

  const subtotal = useMemo(() => {
    if (!bill) return 0;

    if (splitMode === 'equal') {
      return bill.equalShareAmount || bill.subtotal;
    }

    if (splitMode === 'items') {
      return bill.ownItemsTotal || displayedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    return bill.remainingAmount > 0 ? bill.remainingAmount : bill.subtotal;
  }, [bill, displayedItems, splitMode]);

  const tipAmount = typeof tip === 'number' ? Math.round((subtotal * tip) / 100) : 0;
  const total = subtotal + tipAmount;
  const selectedMethod = methods.find((method) => method.key === paymentMethod) ?? methods[0];
  const SelectedMethodIcon = selectedMethod.Icon;
  const tableLabel = bill?.table.label ?? tableSession?.table.label ?? 'Sto';
  const venueName = bill?.venue.name ?? tableSession?.venue.name ?? 'OpenTab lokal';
  const canPay = Boolean(bill && bill.items.length && subtotal > 0 && bill.status !== 'paid');

  const handleConfirmPayment = async () => {
    if (confirming || !session?.token || !canPay) return;

    setConfirming(true);
    setPaymentMessage('');

    try {
      const response = await mobileCreatePayment(session.token, {
        method: paymentMethod,
        splitMode,
        tipAmount,
      });

      setBill(response.bill);
      setPaymentMessage(response.message ?? 'Plaćanje je evidentirano.');
      showToast('success', response.message ?? 'Plaćanje je evidentirano.');
      setConfirmOpen(false);

      if (response.bill.status === 'paid') {
        await refreshTableSession().catch(() => null);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Plaćanje nije uspelo.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="screen bill-screen ssu-screen ssu-centered-access-screen ssu-bill-empty-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">₨</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Račun</p>
            <h1>Učitavamo račun</h1>
            <p>Proveravamo stavke i plaćanja vezana za vaš sto.</p>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen bill-screen ssu-screen ssu-centered-access-screen ssu-bill-empty-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">!</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Račun</p>
            <h1>Račun nije dostupan</h1>
            <p>{error}</p>
          </div>

          <div className="ssu-centered-actions">
            <button className="primary-action-button ssu-main-action" type="button" onClick={loadBill}>
              <span>Pokušaj ponovo</span>
              <span>→</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!bill || !bill.items.length) {
    return (
      <div className="screen bill-screen ssu-screen ssu-centered-access-screen ssu-bill-empty-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">₨</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Račun</p>
            <h1>Nema stavki za naplatu</h1>
            <p>Kada pošaljete narudžbinu, stavke će se pojaviti ovde.</p>
          </div>

          <div className="ssu-centered-actions">
            <button className="primary-action-button ssu-main-action" type="button" onClick={() => navigate('/menu')}>
              <span>Pogledaj meni</span>
              <span>→</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="screen bill-screen">
        <div className="page-head"><div><h1>Račun</h1><p>Pregledajte stavke i izaberite način plaćanja</p></div></div>
        <section className="bill-total-card glass-card">
          <span className="bill-total-label">Ukupan iznos za plaćanje</span>
          <strong>{formatPrice(total)}</strong>
          <small>{tableLabel} · {venueName} · {statusLabel(bill.status)}</small>
          {paymentMessage && <small>{paymentMessage}</small>}
        </section>
        <section className="bill-items-card glass-card">
          {displayedItems.map((item) => (
            <div className="bill-item-row" key={item.id}>
              <div>
                <span className="bill-item-name">{item.name}</span>
                <small>×{item.qty} {item.selectedOptions.map((option) => option.label).join(' · ')}</small>
              </div>
              <span>{formatPrice(item.totalPrice)}</span>
            </div>
          ))}
        </section>
        <section className="tip-section">
          <div className="tip-title-row"><SectionTitle title="Napojnica" /><span>Napojnica ide osoblju lokala.</span></div>
          <div className="tip-options">
            {tipOptions.map((option) => <button key={String(option)} type="button" className={`tip-pill${tip === option ? ' selected' : ''}${option === 'custom' ? ' custom' : ''}`} onClick={() => setTip(option)}>{option === 0 ? 'Bez' : option === 'custom' ? 'Drugo' : `${option}%`}</button>)}
          </div>
        </section>
        <section className="split-section">
          <SectionTitle title="Podela računa" />
          <div className="split-options">{splitOptions.map((option) => <button key={option.key} type="button" className={`split-option${splitMode === option.key ? ' selected' : ''}`} onClick={() => setSplitMode(option.key)}>{option.label}</button>)}</div>
          {splitMode === 'equal' && <p className="order-status-desc">Račun se deli na {bill.participantCount} gost(a).</p>}
        </section>
        <section className="payment-method-section">
          <SectionTitle title="Način plaćanja" />
          <div className="payment-method-list">
            {methods.map(({ key, title, subtitle, Icon }) => (
              <button key={key} type="button" className={`payment-method-card${paymentMethod === key ? ' selected' : ''}`} onClick={() => setPaymentMethod(key)}>
                <span className="payment-method-icon"><Icon /></span><span className="payment-method-info"><strong>{title}</strong><small>{subtitle}</small></span><span className="payment-method-radio"><span /></span>
              </button>
            ))}
          </div>
        </section>
        <section className="payment-summary-card glass-card">
          <div className="summary-row"><span>Međuzbir</span><span>{formatPrice(subtotal)}</span></div>
          <div className="summary-row"><span>Napojnica {typeof tip === 'number' ? `${tip}%` : ''}</span><span>{formatPrice(tipAmount)}</span></div>
          <div className="summary-button-row">
            <PrimaryActionButton label={bill.status === 'paid' ? 'Račun je plaćen' : ctaLabels[paymentMethod]} price={formatPrice(total)} onClick={() => setConfirmOpen(true)} disabled={!canPay} />
          </div>
        </section>
      </div>
      <StandardBottomSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        ariaLabel={sheetTitles[paymentMethod]}
        sheetClassName="payment-confirm-sheet"
      >
        <div className="payment-confirm-head">
          <span className="payment-confirm-icon"><SelectedMethodIcon /></span>
          <div>
            <h2>{sheetTitles[paymentMethod]}</h2>
            <p>{sheetSubtitles[paymentMethod]}</p>
          </div>
        </div>
        <div className="payment-confirm-card glass-card">
          <div className="summary-row"><span>Način</span><span>{methods.find((method) => method.key === paymentMethod)?.title}</span></div>
          <div className="summary-row"><span>Sto</span><span>{tableLabel}</span></div>
          <div className="summary-row"><span>Podela</span><span>{splitOptions.find((option) => option.key === splitMode)?.label}</span></div>
          <div className="summary-row"><span>Napojnica</span><span>{formatPrice(tipAmount)}</span></div>
          <div className="summary-total-row"><span>Ukupno</span><span>{formatPrice(total)}</span></div>
        </div>
        <PrimaryActionButton label={confirming ? 'Obrađuje se' : ctaLabels[paymentMethod]} price={formatPrice(total)} onClick={handleConfirmPayment} disabled={confirming || !canPay} />
      </StandardBottomSheet>
    </>
  );
}
