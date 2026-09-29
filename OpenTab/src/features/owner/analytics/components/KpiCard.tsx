// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { AnalyticsKpi } from "../../../../entities/analytics/analytics.types";
import { MetricSummaryCard } from "../../../../shared/ui/MetricSummaryCard";

type KpiCardProps = {
  kpi: AnalyticsKpi;
};

export function KpiCard({ kpi }: KpiCardProps) {
  return (
    <MetricSummaryCard
      className="kpi-card"
      icon={kpi.icon}
      label={kpi.title}
      value={kpi.value}
    >
      {kpi.trend ? (
        <div className="kpi-trend">
          <span className={kpi.trend.direction === "up" ? "trend-up" : "trend-down"}>
            {kpi.trend.value}
          </span>
          <span>{kpi.trend.label}</span>
        </div>
      ) : (
        <div className="kpi-trend muted">Nema poređenja za ovaj prikaz</div>
      )}
    </MetricSummaryCard>
  );
}
