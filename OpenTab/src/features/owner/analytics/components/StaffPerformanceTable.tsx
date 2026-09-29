// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type {
  StaffPerformanceRow,
  StaffSortColumn,
  StaffSortState,
} from "../../../../entities/analytics/analytics.types";
import { GlassBadge } from "../../../../shared/ui/GlassBadge";
import { formatGoalValue } from "../hooks/useAnalyticsDashboard";

type StaffPerformanceTableProps = {
  rows: StaffPerformanceRow[];
  sort: StaffSortState;
  onSortColumn: (column: StaffSortColumn) => void;
  onOpenDetails: (staffId: string) => void;
};

const columns: {
  label: string;
  value: StaffSortColumn;
}[] = [
  { label: "Konobar", value: "name" },
  { label: "Prihod", value: "revenue" },
  { label: "Narudžbine", value: "orders" },
  { label: "Stolovi", value: "tables" },
  { label: "Ocena", value: "rating" },
  { label: "Cilj", value: "goal" },
];

function getInitials(fullName: string) {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

export function StaffPerformanceTable({
  rows,
  sort,
  onSortColumn,
  onOpenDetails,
}: StaffPerformanceTableProps) {
  return (
    <div className="chart-card staff-performance-card">
      <div className="chart-header">
        <div>
          <span className="chart-title">Performanse konobara</span>
          <p className="chart-subtitle">Sortiranje po prihodu, narudžbinama, stolovima i ciljevima</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="analytics-empty-state">
          <span>◌</span>
          <p>Nema dostupnih podataka za izabrani period.</p>
        </div>
      ) : (
        <div className="table-responsive custom-scrollbar">
          <table className="performance-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.value}
                    className="sortable-header"
                    onClick={() => onSortColumn(column.value)}
                  >
                    {column.label}
                    {sort.column === column.value ? (
                      <span className="sort-icon">{sort.direction === "asc" ? "↑" : "↓"}</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => onOpenDetails(row.id)}>
                  <td>
                    <div className="staff-table-user">
                      <div className="staff-table-avatar">
                        {row.avatarUrl ? <img src={row.avatarUrl} alt={row.fullName} /> : getInitials(row.fullName)}
                      </div>

                      <div>
                        <strong>{row.fullName}</strong>
                        <span>@{row.username}</span>
                      </div>
                    </div>
                  </td>

                  <td>{row.revenue.toLocaleString("sr-RS")} RSD</td>
                  <td>{row.orders}</td>
                  <td>{row.tables}</td>
                  <td>⭐ {row.rating.toFixed(1)}</td>

                  <td>
                    {row.goalAmount ? (
                      <div className="goal-cell">
                        <div className="goal-cell-top">
                          <GlassBadge tone={row.goalCompleted ? "success" : "warning"} dot className={row.goalCompleted ? "goal-badge completed" : "goal-badge"}>
                            {row.goalCompleted
                              ? "Cilj ispunjen ✓"
                              : formatGoalValue(row.goalAmount, row.goalMetric)}
                          </GlassBadge>

                          {row.goalBonus ? <small>🎁 {row.goalBonus}</small> : null}
                        </div>

                        <div className="goal-progress">
                          <div
                            className="goal-progress-bar"
                            style={{
                              width: `${row.goalProgress}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="muted-dash">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}