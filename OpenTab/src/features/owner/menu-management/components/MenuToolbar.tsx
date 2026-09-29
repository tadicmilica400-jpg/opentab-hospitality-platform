// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
type MenuToolbarProps = {
  onAddItem: () => void;
};

export function MenuToolbar({ onAddItem }: MenuToolbarProps) {
  return (
    <div className="header-row-top">
      <div className="map-title">
        <h1>Upravljanje menijem</h1>
        <p>Dodajte, izmenite ili deaktivirajte stavke menija</p>
      </div>

      <div className="header-actions">
        <button type="button" className="btn-glass primary" onClick={onAddItem}>
          + Dodaj stavku
        </button>
      </div>
    </div>
  );
}