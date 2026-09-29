// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { StaffDetailAnalytics } from "../../../../entities/analytics/analytics.types";
import { AppModal } from "../../../../shared/modals/AppModal";
import { PreviewDivider } from "../../../../shared/ui/PreviewDivider";

type StaffDetailModalProps = {
  open: boolean;
  detail: StaffDetailAnalytics | null;
  onClose: () => void;
};

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

export function StaffDetailModal({ open, detail, onClose }: StaffDetailModalProps) {
  const maxRevenue = Math.max(...(detail?.activityByDay.map((day) => day.revenue) ?? [1]), 1);

  return (
    <AppModal
      open={open}
      title="Detalji radnika"
      subtitle="Napredni uvid u performanse i aktivnost"
      onClose={onClose}
      containerClassName="staff-detail-modal-container"
      bodyClassName="staff-detail-modal-body"
    >
      {detail ? (
        <>
          <div className="staff-detail-card">
            <div className="staff-detail-header">
              <div className="staff-detail-avatar">
                {detail.avatarUrl ? <img src={detail.avatarUrl} alt={detail.fullName} /> : getInitials(detail.fullName)}
              </div>

              <div className="staff-detail-info">
                <h3>{detail.fullName}</h3>
                <p>
                  @{detail.username} · {detail.role}
                </p>
              </div>
            </div>

            <div className="staff-detail-stats">
              <div>
                <span>Prihod</span>
                <strong>{detail.revenue.toLocaleString("sr-RS")} RSD</strong>
              </div>

              <div>
                <span>Narudžbine</span>
                <strong>{detail.orders}</strong>
              </div>

              <div>
                <span>Stolovi</span>
                <strong>{detail.tables}</strong>
              </div>

              <div>
                <span>Ocena</span>
                <strong>⭐ {detail.rating.toFixed(1)}</strong>
              </div>
            </div>

            {detail.goalAmount ? (
              <div className="staff-detail-goal">
                <div>
                  <span>Cilj prihoda</span>
                  <strong>{detail.goalAmount.toLocaleString("sr-RS")} RSD</strong>
                  {detail.goalBonus ? <p>Bonus: {detail.goalBonus}</p> : null}
                </div>

                <div className="goal-progress large">
                  <div
                    className="goal-progress-bar"
                    style={{
                      width: `${detail.goalProgress}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <PreviewDivider label="Aktivnost" />

          <div className="staff-detail-grid">
            <div className="staff-detail-panel">
              <h4>Prihod po danima</h4>

              <div className="staff-activity-bars">
                {detail.activityByDay.map((day) => (
                  <div className="staff-activity-row" key={day.label}>
                    <span>{day.label}</span>

                    <div>
                      <i
                        style={{
                          width: `${Math.max(8, (day.revenue / maxRevenue) * 100)}%`,
                        }}
                      />
                    </div>

                    <strong>{day.revenue.toLocaleString("sr-RS")}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="staff-detail-panel">
              <h4>Najčešće posluženo</h4>

              <div className="staff-detail-list">
                {detail.topItems.map((item) => (
                  <div key={item.name}>
                    <span>{item.name}</span>
                    <strong>{item.quantity} kom.</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="staff-detail-panel full">
              <h4>Trend ocene</h4>

              <div className="rating-trend-list">
                {detail.ratingTrend.map((point) => (
                  <div key={point.label}>
                    <span>{point.label}</span>
                    <strong>⭐ {point.rating.toFixed(1)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="analytics-empty-state">
          <span>◌</span>
          <p>Radnik nije pronađen.</p>
        </div>
      )}
    </AppModal>
  );
}