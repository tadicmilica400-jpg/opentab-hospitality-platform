import type { ReactNode } from "react";

export type GlassBadgeTone = "gold" | "success" | "warning" | "danger" | "muted" | "info";

type GlassBadgeProps = {
  children: ReactNode;
  tone?: GlassBadgeTone;
  dot?: boolean;
  className?: string;
  title?: string;
};

export function GlassBadge({
  children,
  tone = "gold",
  dot = false,
  className = "",
  title,
}: GlassBadgeProps) {
  return (
    <span className={`glass-badge glass-badge-${tone} ${className}`.trim()} title={title}>
      {dot ? <span className="glass-badge-dot" aria-hidden="true" /> : null}
      <span className="glass-badge-label">{children}</span>
    </span>
  );
}
