import { AppModal } from "./AppModal";
import { GlassSearchInput } from "../forms/GlassSearchInput";

export type AssignmentPickerItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  avatarText?: string;
  icon?: string;
  meta?: string;
};

type AssignmentPickerModalProps = {
  open: boolean;
  title: string;
  subtitle: string;
  search: string;
  searchPlaceholder: string;
  items: AssignmentPickerItem[];
  selectedIds: string[];
  emptyText: string;
  confirmLabel: string;
  onSearchChange: (value: string) => void;
  onToggle: (itemId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function AssignmentPickerModal({
  open,
  title,
  subtitle,
  search,
  searchPlaceholder,
  items,
  selectedIds,
  emptyText,
  confirmLabel,
  onSearchChange,
  onToggle,
  onClose,
  onConfirm,
}: AssignmentPickerModalProps) {
  return (
    <AppModal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      overlayClassName="assignment-picker-overlay"
      containerClassName="assignment-picker-container"
      bodyClassName="assignment-picker-body"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn-modal btn-modal-cancel" onClick={onClose}>
            Otkaži
          </button>

          <button
            type="button"
            className="btn-modal btn-modal-primary"
            disabled={selectedIds.length === 0}
            onClick={onConfirm}
          >
            {confirmLabel} {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
        </div>
      }
    >
      <GlassSearchInput value={search} placeholder={searchPlaceholder} onChange={onSearchChange} />

      <div className="assignment-picker-list">
        {items.length > 0 ? (
          items.map((item) => {
            const isSelected = selectedIds.includes(item.id);

            return (
              <button
                type="button"
                key={item.id}
                className={`assignment-picker-row ${isSelected ? "selected" : ""}`}
                onClick={() => onToggle(item.id)}
              >
                <div className="assignment-picker-avatar">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} />
                  ) : (
                    <span>{item.avatarText ?? item.icon ?? "◎"}</span>
                  )}
                </div>

                <div className="assignment-picker-info">
                  <p>{item.title}</p>
                  {item.subtitle ? <span>{item.subtitle}</span> : null}
                </div>

                {item.meta ? <span className="assignment-picker-meta">{item.meta}</span> : null}

                {isSelected ? (
                  <span className="assignment-picker-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span />
                )}
              </button>
            );
          })
        ) : (
          <div className="assignment-picker-empty">{emptyText}</div>
        )}
      </div>
    </AppModal>
  );
}