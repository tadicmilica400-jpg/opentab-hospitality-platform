import type { ReactNode } from "react";

type GlassActionButtonProps = {
  children: ReactNode;
  icon?: ReactNode;
  type?: "button" | "submit" | "reset";
  className?: string;
  onClick?: () => void;
};

export function GlassActionButton({
  children,
  icon,
  type = "button",
  className = "",
  onClick,
}: GlassActionButtonProps) {
  return (
    <button
      type={type}
      className={`glass-action-button ${className}`.trim()}
      onClick={onClick}
    >
      <span className="glass-action-wash" />
      <span className="glass-action-highlight" />
      <span className="glass-action-refraction" />

      {icon ? <span className="glass-action-icon">{icon}</span> : null}
      <span className="glass-action-text">{children}</span>
    </button>
  );
}