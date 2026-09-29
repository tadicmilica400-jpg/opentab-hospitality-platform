// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { MenuCategory, MenuItem } from "../../../../entities/menu/menu.types";
import {
  GroupManagerModal,
  type GroupMutationValues,
} from "../../../../shared/modals/GroupManagerModal";
import type { ActionResult } from "../../../../shared/types/action.types";

type CategoryMutationValues = {
  name: string;
  emoji: string;
  itemIds: string[];
};

type MaybeActionResult = ActionResult | Promise<ActionResult>;

type CategoryManagerModalProps = {
  open: boolean;
  categories: MenuCategory[];
  items: MenuItem[];
  onClose: () => void;
  onCreateCategory: (values: CategoryMutationValues) => MaybeActionResult;
  onUpdateCategory: (categoryId: string, values: CategoryMutationValues) => MaybeActionResult;
  onDeleteCategory: (categoryId: string) => MaybeActionResult;
};

const categoryEmojis = [
  "☷", "☕", "🍵", "🫖", "🥤", "🧃", "🍋", "🍊", "🍓", "🍒",
  "🍑", "🍍", "🥭", "🥝", "🍇", "🍉", "🍌", "🍎", "🍏", "🍐",
  "🥥", "🍽", "🍴", "🥄", "🔪", "🥂", "🍷", "🍸", "🍹", "🍺",
  "🍻", "🥃", "🧊", "🍾", "🥛", "🍯", "🥐", "🥯", "🍞", "🥖",
  "🥨", "🧀", "🥚", "🍳", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖",
  "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🌮", "🌯", "🥗", "🍝",
  "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🍤", "🍰", "🧁", "🍫",
  "⭐", "🔥", "💎", "✨",
];

export function CategoryManagerModal({
  open,
  categories,
  items,
  onClose,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryManagerModalProps) {
  const getCategoryName = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.name ?? "Bez kategorije";

  return (
    <GroupManagerModal
      open={open}
      title="Upravljanje kategorijama"
      subtitle="Dodajte kategorije i uredite strukturu menija"
      searchPlaceholder="Pretraži kategorije..."
      addLabel="Nova kategorija"
      emptyText="Nema kategorija koje odgovaraju pretrazi."
      groups={categories.map((category) => ({
        key: category.id,
        name: category.name,
        icon: category.emoji || "☷",
        memberCount: items.filter((item) => item.categoryId === category.id).length,
      }))}
      members={items.map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `${getCategoryName(item.categoryId)} · ${item.price} RSD`,
        imageUrl: item.imageUrl,
        icon: "🍽",
        meta: `${item.price} RSD`,
      }))}
      defaultIcon="☷"
      emojis={categoryEmojis}
      formCreateTitle="Nova kategorija"
      formEditTitle="Izmeni kategoriju"
      formCreateSubtitle="Unesite naziv i povežite stavke sa kategorijom"
      formEditSubtitle="Uredite naziv i stavke koje pripadaju ovoj kategoriji"
      nameLabel="Naziv kategorije"
      namePlaceholder="npr. Topla pića"
      selectedSectionLabel="Izabrane stavke"
      addMembersLabel="Dodaj stavke"
      selectedEmptyText="Još nijedna stavka nije izabrana."
      pickerTitle="Dodaj stavke"
      pickerSubtitle="Izaberite više stavki koje želite da povežete sa kategorijom"
      pickerSearchPlaceholder="Pretraži stavke..."
      pickerEmptyText="Nema stavki za dodavanje."
      pickerConfirmLabel="Dodaj stavke"
      getMemberCountLabel={(count) => (count === 1 ? "1 stavka" : `${count} stavki`)}
      getAssignedMemberIds={(categoryId) =>
        items.filter((item) => item.categoryId === categoryId).map((item) => item.id)
      }
      onClose={onClose}
      onCreateGroup={(values: GroupMutationValues) =>
        onCreateCategory({
          name: values.name,
          emoji: values.icon,
          itemIds: values.memberIds,
        })
      }
      onUpdateGroup={(categoryId, values: GroupMutationValues) =>
        onUpdateCategory(categoryId, {
          name: values.name,
          emoji: values.icon,
          itemIds: values.memberIds,
        })
      }
      onDeleteGroup={onDeleteCategory}
    />
  );
}