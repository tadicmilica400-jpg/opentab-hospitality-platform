import { useMemo, useState } from "react";
import type { ActionResult } from "../types/action.types";
import { AppModal } from "./AppModal";
import {
  AssignmentPickerModal,
  type AssignmentPickerItem,
} from "./AssignmentPickerModal";
import { EmojiPicker } from "../forms/EmojiPicker";
import { GlassSearchInput } from "../forms/GlassSearchInput";

export type GroupManagerGroup = {
  key: string;
  name: string;
  icon: string;
  memberCount: number;
};

export type GroupManagerMember = AssignmentPickerItem;

export type GroupMutationValues = {
  name: string;
  icon: string;
  memberIds: string[];
};

type GroupFormState =
  | {
      mode: "create";
      group: null;
    }
  | {
      mode: "edit";
      group: GroupManagerGroup;
    }
  | null;

type GroupManagerModalProps = {
  open: boolean;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  addLabel: string;
  emptyText: string;
  groups: GroupManagerGroup[];
  members: GroupManagerMember[];
  defaultIcon: string;
  emojis: string[];
  formCreateTitle: string;
  formEditTitle: string;
  formCreateSubtitle: string;
  formEditSubtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  selectedSectionLabel: string;
  addMembersLabel: string;
  selectedEmptyText: string;
  pickerTitle: string;
  pickerSubtitle: string;
  pickerSearchPlaceholder: string;
  pickerEmptyText: string;
  pickerConfirmLabel: string;
  getMemberCountLabel?: (count: number) => string;
  onClose: () => void;
  onCreateGroup: (values: GroupMutationValues) => ActionResult | Promise<ActionResult>;
  onUpdateGroup: (groupKey: string, values: GroupMutationValues) => ActionResult | Promise<ActionResult>;
  onDeleteGroup: (groupKey: string) => ActionResult | Promise<ActionResult>;
  getAssignedMemberIds: (groupKey: string) => string[];
};

export function GroupManagerModal({
  open,
  title,
  subtitle,
  searchPlaceholder,
  addLabel,
  emptyText,
  groups,
  members,
  defaultIcon,
  emojis,
  formCreateTitle,
  formEditTitle,
  formCreateSubtitle,
  formEditSubtitle,
  nameLabel,
  namePlaceholder,
  selectedSectionLabel,
  addMembersLabel,
  selectedEmptyText,
  pickerTitle,
  pickerSubtitle,
  pickerSearchPlaceholder,
  pickerEmptyText,
  pickerConfirmLabel,
  getMemberCountLabel = (count) => `${count} povezanih stavki`,
  onClose,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  getAssignedMemberIds,
}: GroupManagerModalProps) {
  const [search, setSearch] = useState("");
  const [managerError, setManagerError] = useState("");
  const [formState, setFormState] = useState<GroupFormState>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState(defaultIcon);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return groups;
    }

    return groups.filter((group) => group.name.toLowerCase().includes(normalizedSearch));
  }, [groups, search]);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedMemberIds.includes(member.id)),
    [members, selectedMemberIds],
  );

  const pickerItems = useMemo(() => {
    const normalizedSearch = pickerSearch.trim().toLowerCase();

    return members.filter((member) => {
      const alreadySelected = selectedMemberIds.includes(member.id);
      const matchesSearch =
        !normalizedSearch ||
        member.title.toLowerCase().includes(normalizedSearch) ||
        member.subtitle?.toLowerCase().includes(normalizedSearch) ||
        member.meta?.toLowerCase().includes(normalizedSearch);

      return !alreadySelected && matchesSearch;
    });
  }, [members, selectedMemberIds, pickerSearch]);

  const closeRootModal = () => {
    setManagerError("");
    setFormState(null);
    setPickerOpen(false);
    setPickerSelectedIds([]);
    setPickerSearch("");
    onClose();
  };

  const openCreateForm = () => {
    setFormState({ mode: "create", group: null });
    setFormName("");
    setFormIcon(defaultIcon);
    setSelectedMemberIds([]);
    setFormError("");
    setPickerOpen(false);
    setPickerSelectedIds([]);
    setPickerSearch("");
  };

  const openEditForm = (group: GroupManagerGroup) => {
    setFormState({ mode: "edit", group });
    setFormName(group.name);
    setFormIcon(group.icon || defaultIcon);
    setSelectedMemberIds(getAssignedMemberIds(group.key));
    setFormError("");
    setPickerOpen(false);
    setPickerSelectedIds([]);
    setPickerSearch("");
  };

  const closeForm = () => {
    setFormState(null);
    setFormName("");
    setFormIcon(defaultIcon);
    setSelectedMemberIds([]);
    setFormError("");
    setPickerOpen(false);
    setPickerSelectedIds([]);
    setPickerSearch("");
  };

  const openPicker = () => {
    setPickerSelectedIds([]);
    setPickerSearch("");
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerSelectedIds([]);
    setPickerSearch("");
    setPickerOpen(false);
  };

  const togglePickerItem = (itemId: string) => {
    setPickerSelectedIds((currentIds) =>
      currentIds.includes(itemId)
        ? currentIds.filter((id) => id !== itemId)
        : [...currentIds, itemId],
    );
  };

  const addPickedItems = () => {
    setSelectedMemberIds((currentIds) => [
      ...currentIds,
      ...pickerSelectedIds.filter((id) => !currentIds.includes(id)),
    ]);

    closePicker();
  };

  const removeSelectedMember = (memberId: string) => {
    setSelectedMemberIds((currentIds) => currentIds.filter((id) => id !== memberId));
  };

  const submitForm = async () => {
    if (!formState || isSubmitting) {
      return;
    }

    const values = {
      name: formName,
      icon: formIcon.trim() || defaultIcon,
      memberIds: selectedMemberIds,
    };

    try {
      setIsSubmitting(true);
      const result =
        formState.mode === "create"
          ? await onCreateGroup(values)
          : await onUpdateGroup(formState.group.key, values);

      if (result.ok === false) {
        setFormError(result.message);
        return;
      }

      closeForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteGroup = async (groupKey: string) => {
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await onDeleteGroup(groupKey);

      if (result.ok === false) {
        setManagerError(result.message);
        return;
      }

      setManagerError("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppModal
        open={open}
        title={title}
        subtitle={subtitle}
        onClose={closeRootModal}
        containerClassName="group-manager-container"
        bodyClassName="group-manager-body"
        footer={
          <div className="modal-actions">
            <button type="button" className="btn-modal btn-modal-cancel" onClick={closeRootModal}>
              Zatvori
            </button>
          </div>
        }
      >
        <div className="group-manager-toolbar">
          <GlassSearchInput value={search} placeholder={searchPlaceholder} onChange={setSearch} />

          <button type="button" className="btn-add-group" onClick={openCreateForm}>
            <span className="plus-icon">+</span>
            <span>{addLabel}</span>
          </button>
        </div>

        {managerError ? <div className="group-manager-error">{managerError}</div> : null}

        <div className="group-cards-list">
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <div className="group-card" key={group.key}>
                <div className="group-card-header">
                  <div className="group-card-title">
                    <span className="group-card-icon">{group.icon || defaultIcon}</span>

                    <div>
                      <h3>{group.name}</h3>
                      <p>{getMemberCountLabel(group.memberCount)}</p>
                    </div>
                  </div>

                  <div className="group-card-actions">
                    <button type="button" className="group-edit-btn" onClick={() => openEditForm(group)}>
                      ✎
                    </button>

                    <button type="button" className="group-delete-btn" disabled={isSubmitting} onClick={() => deleteGroup(group.key)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M4 7h16" strokeLinecap="round" />
                        <path d="M10 11v6" strokeLinecap="round" />
                        <path d="M14 11v6" strokeLinecap="round" />
                        <path d="M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="group-empty-state">{emptyText}</div>
          )}
        </div>
      </AppModal>

      <AppModal
        open={formState !== null}
        title={formState?.mode === "create" ? formCreateTitle : formEditTitle}
        subtitle={formState?.mode === "create" ? formCreateSubtitle : formEditSubtitle}
        onClose={closeForm}
        overlayClassName="group-form-overlay"
        containerClassName="group-form-container"
        bodyClassName="group-form-body"
        footer={
          <div className="modal-actions">
            <button type="button" className="btn-modal btn-modal-cancel" onClick={closeForm}>
              Otkaži
            </button>

            <button type="button" className="btn-modal btn-modal-primary" disabled={isSubmitting} onClick={submitForm}>
              {isSubmitting ? "Čuvanje..." : formState?.mode === "create" ? "Dodaj" : "Sačuvaj izmene"}
            </button>
          </div>
        }
      >
        <div className="group-form-grid">
          <EmojiPicker value={formIcon} onChange={setFormIcon} emojis={emojis} />

          <div className="modal-field">
            <label>
              {nameLabel} <span className="required-mark">*</span>
            </label>
            <input
              type="text"
              className={`modal-input ${formError ? "error" : ""}`}
              value={formName}
              placeholder={namePlaceholder}
              onChange={(event) => {
                setFormName(event.target.value);
                setFormError("");
              }}
            />
            {formError ? <div className="field-error-msg visible">{formError}</div> : null}
          </div>
        </div>

        <div className="group-selected-section">
          <div className="group-section-title group-section-title-with-action">
            <div className="group-section-heading">
              <span>{selectedSectionLabel}</span>
              <small>{selectedMembers.length}</small>
            </div>

            <button type="button" className="btn-open-assignment-picker" onClick={openPicker}>
              + {addMembersLabel}
            </button>
          </div>

          <div className="group-selected-pills">
            {selectedMembers.length > 0 ? (
              selectedMembers.map((member) => (
                <button
                  type="button"
                  className="selected-group-member-pill"
                  key={member.id}
                  onClick={() => removeSelectedMember(member.id)}
                >
                  <span>{member.title}</span>
                  <span>×</span>
                </button>
              ))
            ) : (
              <div className="selected-group-members-empty">{selectedEmptyText}</div>
            )}
          </div>
        </div>
      </AppModal>

      <AssignmentPickerModal
        open={pickerOpen}
        title={pickerTitle}
        subtitle={pickerSubtitle}
        search={pickerSearch}
        searchPlaceholder={pickerSearchPlaceholder}
        items={pickerItems}
        selectedIds={pickerSelectedIds}
        emptyText={pickerEmptyText}
        confirmLabel={pickerConfirmLabel}
        onSearchChange={setPickerSearch}
        onToggle={togglePickerItem}
        onClose={closePicker}
        onConfirm={addPickedItems}
      />
    </>
  );
}