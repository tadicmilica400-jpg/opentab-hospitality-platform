import type { ReactNode } from "react";

type MetricSummaryCardProps = {
  icon: ReactNode;
  value: ReactNode;
  label?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function MetricSummaryCard({
  icon,
  value,
  label,
  children,
  className = "",
}: MetricSummaryCardProps) {
  return (
    <div className={`metric-summary-card ${className}`.trim()}>
      <div className="metric-summary-icon">{icon}</div>

      <div className="metric-summary-body">
        {label ? <span className="metric-summary-label">{label}</span> : null}
        <strong className="metric-summary-value">{value}</strong>
        {children ? <div className="metric-summary-extra">{children}</div> : null}
      </div>
    </div>
  );
}
