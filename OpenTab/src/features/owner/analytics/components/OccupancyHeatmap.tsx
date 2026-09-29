// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useState } from "react";
import type { HeatmapCell } from "../../../../entities/analytics/analytics.types";
const analyticsDays = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const analyticsHours = Array.from({ length: 17 }, (_, index) => index + 7);

type OccupancyHeatmapProps = {
  cells: HeatmapCell[];
};

export function OccupancyHeatmap({ cells }: OccupancyHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const getCell = (day: string, hour: number) =>
    cells.find((cell) => cell.day === day && cell.hour === hour);

  const rows = analyticsDays.map((day) => {
    const rowCells = analyticsHours.map((hour) => {
      const cell = getCell(day, hour);

      return {
        day,
        hour,
        value: cell?.value ?? 0,
        intensity: cell?.intensity ?? 0,
      };
    });

    return {
      day,
      cells: rowCells,
      total: rowCells.reduce((sum, cell) => sum + cell.value, 0),
    };
  });

  return (
    <div className="chart-card occupancy-card">
      <div className="chart-header">
        <div>
          <span className="chart-title">Prosečna zauzetost lokala po satima</span>
          <p className="chart-subtitle">Hover preko reda naglašava ceo dan i ukupan zbir desno</p>
        </div>
      </div>

      {cells.length === 0 ? (
        <div className="analytics-empty-state">
          <span>◌</span>
          <p>Nema dostupnih podataka za izabrani period.</p>
        </div>
      ) : (
        <div className="heatmap-container custom-scrollbar">
          <div className="heatmap-table">
            <div className="heatmap-row heatmap-head-row">
              <div className="heatmap-cell header heatmap-corner" />

              {analyticsHours.map((hour) => (
                <div className="heatmap-cell header hour-label" key={hour}>
                  {hour}h
                </div>
              ))}

              <div className="heatmap-cell header heatmap-total-header">Ukupno</div>
            </div>

            {rows.map((row) => {
              const rowHovered = hoveredDay === row.day;

              return (
                <div
                  className={`heatmap-row heatmap-body-row ${rowHovered ? "hovered" : ""}`}
                  key={row.day}
                  onMouseEnter={() => setHoveredDay(row.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <div className="heatmap-cell header day-label">{row.day}</div>

                  {row.cells.map((cell) => (
                    <div
                      className="heatmap-cell data"
                      key={`${cell.day}-${cell.hour}`}
                      title={`${cell.day}, ${cell.hour}:00 · ${cell.value} aktivnih stolova/narudžbina`}
                      style={{
                        background: `rgba(197, 161, 91, ${0.09 + cell.intensity * 0.54})`,
                      }}
                    >
                      {cell.value}
                    </div>
                  ))}

                  <div className="heatmap-cell data heatmap-total-cell">{row.total}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}