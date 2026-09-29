// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { GoalMetric } from "../../../../entities/analytics/analytics.types";
import {
  formatGoalDateRange,
  formatGoalValue,
  getGoalMetricLabel,
} from "../hooks/useAnalyticsDashboard";

export type CurrentGoalCardItem = {
  id: string;
  staffId: string;
  staffName: string;
  username: string;
  amount: number;
  currentValue: number;
  metric: GoalMetric;
  progress: number;
  completed: boolean;
  startDate: string;
  endDate: string;
  bonus: string;
};

type CurrentGoalsCardProps = {
  goals: CurrentGoalCardItem[];
  onOpenGoalModal: () => void;
};

export function CurrentGoalsCard({ goals, onOpenGoalModal }: CurrentGoalsCardProps) {
  return (
    <div className="chart-card current-goals-card">
      <div className="chart-header">
        <div>
          <span className="chart-title">Trenutni ciljevi</span>
          <p className="chart-subtitle">Aktivni ciljevi po konobarima</p>
        </div>

        <button type="button" className="btn-glass primary compact-action" onClick={onOpenGoalModal}>
          + Postavi cilj
        </button>
      </div>

      {goals.length > 0 ? (
        <div className="current-goals-grid">
          {goals.map((goal) => (
            <div className="current-goal-card" key={goal.id}>
              <div className="current-goal-top">
                <div>
                  <strong>{goal.staffName}</strong>
                  <span>@{goal.username}</span>
                </div>

                <small className={goal.completed ? "completed" : ""}>
                  {goal.completed ? "Ispunjen" : getGoalMetricLabel(goal.metric)}
                </small>
              </div>

              <div className="current-goal-values">
                <span>{formatGoalValue(goal.currentValue, goal.metric)}</span>
                <strong>{formatGoalValue(goal.amount, goal.metric)}</strong>
              </div>

              <div className="goal-progress current-goal-progress">
                <div
                  className="goal-progress-bar"
                  style={{
                    width: `${goal.progress}%`,
                  }}
                />
              </div>

              <div className="current-goal-bottom">
                <span>{Math.round(goal.progress)}%</span>
                <span>{formatGoalDateRange(goal.startDate, goal.endDate)}</span>
                {goal.bonus ? <span>🎁 {goal.bonus}</span> : <span>Bez bonusa</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="analytics-empty-state compact">
          <span>◌</span>
          <p>Trenutno nema postavljenih ciljeva.</p>
        </div>
      )}
    </div>
  );
}