import type { OrderStage } from '../../types';

const labels: Record<OrderStage, string> = {
  sent: 'Poslato',
  approved: 'Odobreno',
  preparing: 'U pripremi',
  served: 'Posluženo',
};

export default function StatusPill({ stage }: { stage: OrderStage }) {
  return <span className={`status-pill ${stage}`}>{labels[stage]}</span>;
}
