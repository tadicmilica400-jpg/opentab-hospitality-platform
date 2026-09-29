import { useToast } from '../../context/ToastContext';
import CheckIcon from '../icons/CheckIcon';

export default function Toast() {
  const { toast } = useToast();
  const isPreorderNotice = toast.msg === 'Dodato u preorder';
  const isReservationNotice = toast.scope === 'reservation';

  if (!toast.show || (!isPreorderNotice && !isReservationNotice)) return null;

  return (
    <div
      className={`preorder-top-notice app-top-notice ${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
    >
      {toast.kind === 'error' ? <span className="app-top-notice-symbol" aria-hidden="true">!</span> : <CheckIcon />}
      <span>{toast.msg}</span>
    </div>
  );
}
