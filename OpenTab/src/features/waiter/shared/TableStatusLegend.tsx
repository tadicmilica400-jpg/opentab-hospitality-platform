// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
export function TableStatusLegend() {
  return (
    <div className="waiter-table-legend" aria-label="Legenda statusa stolova">
      <span className="waiter-table-legend-title">Legenda</span>
      <span className="waiter-legend-item occupied"><i /> Zauzet</span>
      <span className="waiter-legend-item free"><i /> Slobodan</span>
      <span className="waiter-legend-item reserved"><i /> Rezervisan</span>
      <span className="waiter-legend-item payment"><i /> Čeka naplatu</span>
    </div>
  );
}
