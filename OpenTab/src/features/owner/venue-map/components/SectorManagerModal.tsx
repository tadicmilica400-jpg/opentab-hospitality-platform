// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type {
  SectorMutationValues,
  VenueSector,
  VenueTable,
} from "../../../../entities/venue-map/venueMap.types";
import {
  GroupManagerModal,
  type GroupMutationValues,
} from "../../../../shared/modals/GroupManagerModal";
import type { ActionResult } from "../../../../shared/types/action.types";

type SectorManagerModalProps = {
  open: boolean;
  sectors: VenueSector[];
  tables: VenueTable[];
  onClose: () => void;
  onCreateSector: (values: SectorMutationValues) => ActionResult | Promise<ActionResult>;
  onUpdateSector: (sectorId: string, values: SectorMutationValues) => ActionResult | Promise<ActionResult>;
  onDeleteSector: (sectorId: string) => ActionResult | Promise<ActionResult>;
};

const sectorEmojis = [
  "☷", "🏠", "🏢", "🏛", "🌿", "🌳", "🌲", "☀️", "🌙", "⭐",
  "🔥", "💎", "✨", "🪑", "🍽", "🍷", "☕", "🍹", "🎵", "🎯",
  "🏷", "📍", "📌", "🧭", "🚪", "🪟", "🌺", "🌴", "🪴", "🧱",
  "🔲", "🔳", "◈", "◇", "◆", "◎", "◉", "⬡", "⬢", "✦",
];

function getShapeLabel(shape: VenueTable["shape"]) {
  if (shape === "round") {
    return "Okrugli";
  }

  if (shape === "square") {
    return "Četvrtasti";
  }

  return "Duguljasti";
}

export function SectorManagerModal({
  open,
  sectors,
  tables,
  onClose,
  onCreateSector,
  onUpdateSector,
  onDeleteSector,
}: SectorManagerModalProps) {
  const getSectorName = (sectorId: string) =>
    sectors.find((sector) => sector.id === sectorId)?.name ?? "Bez sektora";

  return (
    <GroupManagerModal
      open={open}
      title="Sektori"
      subtitle="Dodajte sektore i jasno premeštajte stolove između njih"
      searchPlaceholder="Pretraži sektore..."
      addLabel="Novi sektor"
      emptyText="Nema sektora koji odgovaraju pretrazi."
      groups={sectors.map((sector) => ({
        key: sector.id,
        name: sector.name,
        icon: sector.emoji || "☷",
        memberCount: tables.filter((table) => table.sectorId === sector.id).length,
      }))}
      members={tables.map((table) => ({
        id: table.id,
        title: `Sto ${table.number}`,
        subtitle: `Trenutno u sektoru: ${getSectorName(table.sectorId)} · ${table.seats} mesta · ${getShapeLabel(table.shape)}`,
        icon: "🍽",
        meta: table.hasActiveOrder ? "Aktivna narudžbina" : "Biće premešten",
      }))}
      defaultIcon="☷"
      emojis={sectorEmojis}
      formCreateTitle="Novi sektor"
      formEditTitle="Izmeni sektor"
      formCreateSubtitle="Stolovi koje izaberete biće premešteni u ovaj sektor"
      formEditSubtitle="Dodavanjem stola ovde, on automatski prestaje da pripada prethodnom sektoru"
      nameLabel="Naziv sektora"
      namePlaceholder="npr. Bašta, VIP zona, Šank..."
      selectedSectionLabel="Stolovi u ovom sektoru"
      addMembersLabel="Prebaci stolove"
      selectedEmptyText="Još nijedan sto nije povezan sa sektorom."
      pickerTitle="Prebaci stolove"
      pickerSubtitle="Sto može pripadati samo jednom sektoru. Ako ga izaberete ovde, biće premešten iz prethodnog sektora."
      pickerSearchPlaceholder="Pretraži stolove..."
      pickerEmptyText="Nema stolova za dodavanje."
      pickerConfirmLabel="Prebaci stolove"
      getMemberCountLabel={(count) => (count === 1 ? "1 sto" : `${count} stolova`)}
      getAssignedMemberIds={(sectorId) =>
        tables.filter((table) => table.sectorId === sectorId).map((table) => table.id)
      }
      onClose={onClose}
      onCreateGroup={(values: GroupMutationValues) =>
        onCreateSector({
          name: values.name,
          icon: values.icon,
          tableIds: values.memberIds,
        })
      }
      onUpdateGroup={(sectorId, values: GroupMutationValues) =>
        onUpdateSector(sectorId, {
          name: values.name,
          icon: values.icon,
          tableIds: values.memberIds,
        })
      }
      onDeleteGroup={onDeleteSector}
    />
  );
}