import { AppModal } from "./AppModal";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <AppModal
      open={open}
      title={title}
      onClose={onClose}
      overlayClassName="confirm-modal"
      containerClassName="confirm-modal-container"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn-modal btn-modal-cancel" onClick={onClose}>
            Otkaži
          </button>

          <button
            type="button"
            className={`btn-modal btn-modal-primary ${danger ? "btn-modal-danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="confirm-message">{message}</p>
    </AppModal>
  );
}