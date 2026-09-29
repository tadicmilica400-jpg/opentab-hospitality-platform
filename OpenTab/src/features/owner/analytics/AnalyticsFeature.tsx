// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AnalyticsPeriod,
  CustomAnalyticsRange,
} from "../../../entities/analytics/analytics.types";
import { CurrentGoalsCard } from "./components/CurrentGoalsCard";
import { GoalModal } from "./components/GoalModal";
import { KpiCard } from "./components/KpiCard";
import { OccupancyHeatmap } from "./components/OccupancyHeatmap";
import { RevenueChart } from "./components/RevenueChart";
import { StaffPerformanceTable } from "./components/StaffPerformanceTable";
import { TopItemsCard } from "./components/TopItemsCard";
import { useAnalyticsDashboard } from "./hooks/useAnalyticsDashboard";
import { GlassDatePicker } from "../../../shared/forms/GlassDatePicker";
import { SegmentedSlider } from "../../../shared/ui/SegmentedSlider";
import { GlassButton } from "../../../shared/ui/GlassButton";

type ToastState = {
  id: number;
  message: string;
} | null;

const periodOptions = [
  { label: "Danas", value: "day" },
  { label: "Nedelja", value: "week" },
  { label: "Mesec", value: "month" },
  { label: "Ručno", value: "custom" },
] satisfies {
  label: string;
  value: AnalyticsPeriod;
}[];

export function AnalyticsFeature() {
  const dashboard = useAnalyticsDashboard();
  const navigate = useNavigate();
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [customPanelOpen, setCustomPanelOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomAnalyticsRange>(dashboard.customRange);
  const [customError, setCustomError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    setCustomDraft(dashboard.customRange);
  }, [dashboard.customRange]);

  const showToast = (message: string) => {
    setToast({
      id: Date.now(),
      message,
    });

    window.setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const handlePeriodChange = (period: AnalyticsPeriod) => {
    if (period === "custom") {
      setCustomPanelOpen((currentValue) => !currentValue);
      return;
    }

    setCustomPanelOpen(false);
    setCustomError("");
    dashboard.setPeriod(period);
  };

  const applyCustomRange = () => {
    const result = dashboard.setCustomPeriod(customDraft);

    if (result.ok === false) {
      setCustomError(result.message);
      return;
    }

    setCustomError("");
    setCustomPanelOpen(true);
    showToast("Ručni period je primenjen.");
  };

  const hasInitialLoading =
    dashboard.isLoading &&
    dashboard.revenuePoints.length === 0 &&
    dashboard.topItems.length === 0 &&
    dashboard.staffRows.length === 0;

  return (
    <div className="dashboard-main">
      <div className="map-header dashboard-header">
        <div className="header-row-top dashboard-header-row">
          <div className="map-title">
            <h1>Analitički dashboard</h1>
            <p>Pregled prihoda, narudžbina, zauzetosti i performansi osoblja</p>
          </div>

          <SegmentedSlider
            value={customPanelOpen ? "custom" : dashboard.period}
            options={periodOptions}
            onChange={handlePeriodChange}
            className="dashboard-period-slider"
          />
        </div>

        {customPanelOpen ? (
          <div className="custom-range-panel">
            <div className="custom-range-copy">
              <span>Ručni period</span>
              <p>Izaberite početni i krajnji datum za analizu.</p>
            </div>

            <GlassDatePicker
              label="Od"
              value={customDraft.startDate}
              onChange={(startDate) => {
                setCustomDraft((currentRange) => ({
                  ...currentRange,
                  startDate,
                }));
                setCustomError("");
              }}
              max={customDraft.endDate || undefined}
            />

            <GlassDatePicker
              label="Do"
              value={customDraft.endDate}
              onChange={(endDate) => {
                setCustomDraft((currentRange) => ({
                  ...currentRange,
                  endDate,
                }));
                setCustomError("");
              }}
              min={customDraft.startDate || undefined}
            />

            <GlassButton variant="primary" className="custom-range-apply" onClick={applyCustomRange}>
              Primeni
            </GlassButton>

            {customError ? <div className="custom-range-error">{customError}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="dashboard-scroll-area custom-scrollbar">
        <div className="kpi-grid">
          {dashboard.kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>

        {hasInitialLoading ? (
          <div className="dashboard-status-card">
            <span>◌</span>
            <div>
              <strong>Učitavanje analitike...</strong>
              <p>Front čeka odgovor sa Django backend-a.</p>
            </div>
          </div>
        ) : null}

        {dashboard.error ? (
          <div className="dashboard-status-card error">
            <span>!</span>
            <div>
              <strong>Analitika nije učitana.</strong>
              <p>{dashboard.error}</p>
              <button type="button" className="btn-glass compact-action" onClick={() => dashboard.reload()}>
                Pokušaj ponovo
              </button>
            </div>
          </div>
        ) : null}

        {!dashboard.error && dashboard.noData ? (
          <div className="dashboard-no-data-banner">
            <span>◌</span>
            <div>
              <strong>Nema dostupnih podataka za izabrani period.</strong>
              <p>Grafikoni i tabele ostaju prazni, bez greške u prikazu.</p>
            </div>
          </div>
        ) : null}

        {!dashboard.error ? (
          <>
            <div className="dashboard-row">
              <RevenueChart points={dashboard.revenuePoints} periodLabel={dashboard.periodLabel} />

              <TopItemsCard
                items={dashboard.topItems}
                categories={dashboard.categories}
                sort={dashboard.topItemsSort}
                categoryFilter={dashboard.categoryFilter}
                onSortChange={dashboard.setTopItemsSort}
                onCategoryChange={dashboard.setCategoryFilter}
              />
            </div>

            <OccupancyHeatmap cells={dashboard.heatmap} />

            <CurrentGoalsCard
              goals={dashboard.currentGoals}
              onOpenGoalModal={() => setIsGoalModalOpen(true)}
            />

            <StaffPerformanceTable
              rows={dashboard.staffRows}
              sort={dashboard.staffSort}
              onSortColumn={dashboard.setSortColumn}
              onOpenDetails={(staffId) => navigate(`/owner/staff/${staffId}?tab=performance`)}
            />
          </>
        ) : null}
      </div>

      <GoalModal
        open={isGoalModalOpen}
        staffMembers={dashboard.staffMembers}
        onClose={() => setIsGoalModalOpen(false)}
        onSubmit={async (values) => {
          const result = await dashboard.createGoal(values);

          if (result.ok) {
            showToast("Cilj je uspešno sačuvan i povezan sa izabranim konobarima.");
          }

          return result;
        }}
      />

      {toast ? (
        <div className="menu-toast" key={toast.id}>
          <span className="menu-toast-dot" />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
