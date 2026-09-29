import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mobileGetActiveOrder, mobileGetOrderStatus } from '../api/mobileOrders';
import CheckIcon from '../components/icons/CheckIcon';
import ClockIcon from '../components/icons/ClockIcon';
import XIcon from '../components/icons/XIcon';
import InfoPill from '../components/ui/InfoPill';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useOrder } from '../context/OrderContext';
import { useToast } from '../context/ToastContext';
import type { OrderStage } from '../types';

const steps: OrderStage[] = ['sent', 'approved', 'preparing', 'served'];
const stepLabels: Record<OrderStage, string> = { sent: 'Poslato', approved: 'Odobreno', preparing: 'U pripremi', served: 'Posluženo' };

export default function StatusScreen() {
  const navigate = useNavigate();
  const { session } = useMobileAuth();
  const { currentOrder, setCurrentOrder } = useOrder();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveOrder() {
      if (!session?.token) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        if (currentOrder?.id) {
          const response = await mobileGetOrderStatus(session.token, currentOrder.id);

          if (!cancelled) {
            setCurrentOrder(response.order);
          }

          return;
        }

        const response = await mobileGetActiveOrder(session.token);

        if (!cancelled) {
          setCurrentOrder(response.active ? response.order : null);
        }
      } catch (error) {
        if (!cancelled) {
          showToast('error', error instanceof Error ? error.message : 'Status narudžbine nije učitan.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadActiveOrder();

    return () => {
      cancelled = true;
    };
  }, [currentOrder?.id, session?.token, setCurrentOrder, showToast]);

  useEffect(() => {
    if (!session?.token || !currentOrder?.id) return undefined;

    const orderId = currentOrder.id;
    let alive = true;

    const fetchStatus = async () => {
      try {
        const response = await mobileGetOrderStatus(session.token, orderId);

        if (alive) {
          setCurrentOrder(response.order);
        }
      } catch {
        return;
      }
    };

    const id = window.setInterval(fetchStatus, 3000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [currentOrder?.id, session?.token, setCurrentOrder]);

  const sentTime = useMemo(() => {
    if (!currentOrder) return '';

    return new Intl.DateTimeFormat('sr-RS', { hour: '2-digit', minute: '2-digit' }).format(new Date(currentOrder.sentAt));
  }, [currentOrder]);

  if (loading) {
    return (
      <div className="screen status-screen ssu-screen ssu-centered-access-screen ssu-status-empty-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon"><ClockIcon /></div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Status narudžbine</p>
            <h1>Učitavamo narudžbinu</h1>
            <p>Proveravamo šta je trenutno vezano za vaš sto.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!currentOrder) {
    return (
      <div className="screen status-screen ssu-screen ssu-centered-access-screen ssu-status-empty-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon"><ClockIcon /></div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Status narudžbine</p>
            <h1>Nema aktivne narudžbine</h1>
            <p>Kada pošaljete narudžbinu, njen status će se prikazati ovde.</p>
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

  const currentIndex = Math.max(0, steps.indexOf(currentOrder.stage));

  return (
    <div className="screen status-screen">
      <div className="page-head"><div><h1>Status narudžbine</h1><p>Pratite pripremu narudžbine</p></div></div>
      <section className="active-order-card glass-card">
        <div className="order-meta-row">
          <span className="order-number">Narudžbina</span>
          <span className="order-time">Poslato u {sentTime}</span>
        </div>
        <div className="order-info-row">
          <InfoPill className="primary" label="Status" value={stepLabels[currentOrder.stage]} />
          <InfoPill className="eta" label="Dolazak" value={`${currentOrder.etaMinutes ?? 12} min`} />
        </div>
        <p className="order-status-desc">Status se čita direktno iz baze. Kada osoblje odobri, pripremi ili posluži narudžbinu, ovde se vidi promena.</p>
        <div className="order-progress">
          {steps.map((stage, index) => (
            <div key={stage} className={`progress-step ${index < currentIndex ? 'completed' : index === currentIndex ? 'active' : 'waiting'}`}>
              <div className="progress-dot">{index <= currentIndex ? <CheckIcon /> : <ClockIcon />}</div>
              <span>{stepLabels[stage]}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="order-items-section">
        <div className="order-items-title">Stavke narudžbine</div>
        {currentOrder.items.map((item) => {
          const itemStatus = currentOrder.itemStatuses.find((status) => status.cartItemId === item.id);
          const rejected = itemStatus?.status === 'rejected';
          const served = itemStatus?.status === 'served';
          return (
            <article className="order-status-item" key={item.id}>
              <div className="order-item-main">
                <div className="order-item-name">{item.menuItem.name} <span>×{item.qty}</span></div>
                <div className="order-item-options">{item.selectedOptions.map((option) => option.label).join(' · ') || item.note || item.menuItem.desc}</div>
                {itemStatus?.staffComment && <div className="staff-comment">Komentar: {itemStatus.staffComment}</div>}
              </div>
              <span className={`item-status-pill ${rejected ? 'rejected' : 'preparing'}`}>{rejected ? <XIcon /> : served ? <CheckIcon /> : <ClockIcon />}{rejected ? 'Odbijeno' : served ? 'Posluženo' : 'U pripremi'}</span>
            </article>
          );
        })}
      </section>
    </div>
  );
}
