type ModalActionsProps = {
  cancelLabel?: string;
  confirmLabel: string;
  confirmType?: "button" | "submit";
  danger?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
};

export function ModalActions({
  cancelLabel = "Otkaži",
  confirmLabel,
  confirmType = "button",
  danger = false,
  disabled = false,
  onCancel,
  onConfirm,
}: ModalActionsProps) {
  return (
    <div className="modal-actions">
      <button type="button" className="btn-modal btn-modal-cancel" onClick={onCancel}>
        {cancelLabel}
      </button>

      <button
        type={confirmType}
        className={`btn-modal ${danger ? "btn-modal-danger" : "btn-modal-primary"}`}
        disabled={disabled}
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
