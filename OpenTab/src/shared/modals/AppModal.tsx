import { useEffect } from "react";

type AppModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  overlayClassName?: string;
  containerClassName?: string;
  bodyClassName?: string;
  closeOnOverlay?: boolean;
};

export function AppModal({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
  overlayClassName = "",
  containerClassName = "",
  bodyClassName = "",
  closeOnOverlay = true,
}: AppModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={`modal-overlay active ${overlayClassName}`.trim()}
      onMouseDown={(event) => {
        if (closeOnOverlay && event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div
        className={`modal-container ${containerClassName}`.trim()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-accent-top" />

        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-divider-wrap">
          <div className="divider-elegant" />
        </div>

        <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>

        {footer ? (
          <>
            <div className="modal-divider-wrap">
              <div className="divider-elegant" />
            </div>

            <div className="modal-footer">{footer}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}