// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { RevenuePoint } from "../../../../entities/analytics/analytics.types";
import { RevenueTrendChart } from "../../../../shared/ui/RevenueTrendChart";

type RevenueChartProps = {
  points: RevenuePoint[];
  periodLabel: string;
};

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("sr-RS")} RSD`;
}

function formatShort(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }

  return `${Math.round(value)}`;
}

export function RevenueChart({ points, periodLabel }: RevenueChartProps) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const average = points.length > 0 ? total / points.length : 0;

  return (
    <div className="chart-card revenue-chart-card">
      <div className="chart-header revenue-chart-header">
        <div>
          <span className="chart-title">Prihodi po periodu</span>
          <p>{periodLabel}</p>
        </div>

        <div className="revenue-chart-summary">
          <div>
            <span>Ukupno</span>
            <strong>{formatCurrency(total)}</strong>
          </div>

          <div>
            <span>Prosek</span>
            <strong>{formatShort(average)}</strong>
          </div>
        </div>
      </div>

      <RevenueTrendChart
        points={points}
        emptyText="Nema dostupnih podataka za izabrani period."
      />
    </div>
  );
}