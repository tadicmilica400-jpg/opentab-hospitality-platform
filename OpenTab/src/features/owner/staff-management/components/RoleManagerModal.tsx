// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type {
  ActionResult,
  RoleMutationValues,
  StaffMember,
} from "../../../../entities/staff/staff.types";
import {
  GroupManagerModal,
  type GroupMutationValues,
} from "../../../../shared/modals/GroupManagerModal";

type RoleManagerModalProps = {
  open: boolean;
  roles: string[];
  roleIcons: Record<string, string>;
  staff: StaffMember[];
  onClose: () => void;
  onCreateRole: (values: RoleMutationValues) => ActionResult | Promise<ActionResult>;
  onUpdateRole: (roleName: string, values: RoleMutationValues) => ActionResult | Promise<ActionResult>;
  onDeleteRole: (roleName: string) => ActionResult | Promise<ActionResult>;
};

const roleEmojis = [
  "◎", "◈", "◇", "◆", "✦", "✧", "⭐", "🔥", "💎", "✨",
  "👑", "💼", "🧾", "📋", "📊", "🛡", "🔑", "⚙️", "🧠", "🎯",
  "🍽", "🍴", "🥄", "☕", "🍹", "🍸", "🍺", "🥂", "🍷", "🧊",
  "👨‍🍳", "👩‍🍳", "🧑‍🍳", "🧑‍💼", "👨‍💼", "👩‍💼", "🧑‍🔧", "🧑‍🏫", "🧑‍⚖️", "🧑‍💻",
  "🚀", "📌", "📍", "🏷", "🧩", "🪪", "🧭", "🏆", "🥇", "💰",
];

function getInitials(fullName: string) {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "👤"
  );
}

export function RoleManagerModal({
  open,
  roles,
  roleIcons,
  staff,
  onClose,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}: RoleManagerModalProps) {
  return (
    <GroupManagerModal
      open={open}
      title="Upravljanje ulogama"
      subtitle="Kreirajte uloge i dodelite radnike odgovarajućim pozicijama"
      searchPlaceholder="Pretraži uloge..."
      addLabel="Nova uloga"
      emptyText="Nema uloga koje odgovaraju pretrazi."
      groups={roles.map((role) => ({
        key: role,
        name: role,
        icon: roleIcons[role] ?? "◎",
        memberCount: staff.filter((worker) => worker.role === role).length,
      }))}
      members={staff.map((worker) => ({
        id: worker.id,
        title: worker.fullName,
        subtitle: `@${worker.username} · ${roleIcons[worker.role] ?? "◎"} ${worker.role}`,
        imageUrl: worker.avatarUrl,
        avatarText: getInitials(worker.fullName),
      }))}
      defaultIcon="◎"
      emojis={roleEmojis}
      formCreateTitle="Nova uloga"
      formEditTitle="Izmeni ulogu"
      formCreateSubtitle="Unesite naziv uloge i dodelite radnike"
      formEditSubtitle="Uredite naziv uloge i radnike koji joj pripadaju"
      nameLabel="Naziv uloge"
      namePlaceholder="npr. Hostesa"
      selectedSectionLabel="Izabrani radnici"
      addMembersLabel="Dodaj radnike"
      selectedEmptyText="Još nijedan radnik nije izabran."
      pickerTitle="Dodaj radnike"
      pickerSubtitle="Izaberite više radnika koje želite da dodelite ovoj ulozi"
      pickerSearchPlaceholder="Pretraži radnike..."
      pickerEmptyText="Nema radnika za dodavanje."
      pickerConfirmLabel="Dodaj radnike"
      getMemberCountLabel={(count) => (count === 1 ? "1 radnik" : `${count} radnika`)}
      getAssignedMemberIds={(roleName) =>
        staff.filter((worker) => worker.role === roleName).map((worker) => worker.id)
      }
      onClose={onClose}
      onCreateGroup={(values: GroupMutationValues) =>
        onCreateRole({
          name: values.name,
          icon: values.icon,
          workerIds: values.memberIds,
        })
      }
      onUpdateGroup={(roleName, values: GroupMutationValues) =>
        onUpdateRole(roleName, {
          name: values.name,
          icon: values.icon,
          workerIds: values.memberIds,
        })
      }
      onDeleteGroup={onDeleteRole}
    />
  );
}