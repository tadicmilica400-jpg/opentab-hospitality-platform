// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useMemo, useState } from "react";
import type {
  GoalFormValues,
  GoalMetric,
  GoalTargetMode,
  StaffAnalyticsBase,
} from "../../../../entities/analytics/analytics.types";
import { AppModal } from "../../../../shared/modals/AppModal";
import { ModalActions } from "../../../../shared/modals/ModalActions";
import {
  AssignmentPickerModal,
  type AssignmentPickerItem,
} from "../../../../shared/modals/AssignmentPickerModal";
import { GlassDatePicker } from "../../../../shared/forms/GlassDatePicker";
import { ModalTextField } from "../../../../shared/forms/ModalTextField";
import { SearchableGlassSelect } from "../../../../shared/forms/SearchableGlassSelect";
import { SegmentedSlider } from "../../../../shared/ui/SegmentedSlider";
import { PreviewDivider } from "../../../../shared/ui/PreviewDivider";
import type { ActionResult } from "../../../../shared/types/action.types";

type GoalModalProps = {
  open: boolean;
  staffMembers: StaffAnalyticsBase[];
  onClose: () => void;
  onSubmit: (values: GoalFormValues) => ActionResult | Promise<ActionResult>;
  initialTargetMode?: GoalTargetMode;
};

const targetModeOptions: {
  value: GoalTargetMode;
  title: string;
  icon: string;
}[] = [
  {
    value: "all",
    title: "Svi konobari",
    icon: "◎",
  },
  {
    value: "single",
    title: "Jedan konobar",
    icon: "◈",
  },
  {
    value: "multiple",
    title: "Grupa konobara",
    icon: "◇",
  },
];

const metricOptions = [
  {
    value: "revenue",
    label: "Prihod",
  },
  {
    value: "orders",
    label: "Narudžbine",
  },
  {
    value: "tables",
    label: "Stolovi",
  },
] satisfies {
  value: GoalMetric;
  label: string;
}[];

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

function getTodayInputDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysInputDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseAmount(value: string) {
  const onlyDigits = value.replace(/[^\d]/g, "");
  const parsedValue = Number(onlyDigits);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getDefaultAmount(metric: GoalMetric) {
  if (metric === "orders") return 75;
  if (metric === "tables") return 35;
  return 150000;
}

function getMetricSuffix(metric: GoalMetric) {
  if (metric === "orders") return "kom.";
  if (metric === "tables") return "stolova";
  return "RSD";
}

function formatGoalValue(value: number, metric: GoalMetric) {
  if (metric === "revenue") {
    return `${value.toLocaleString("sr-RS")} RSD`;
  }

  if (metric === "orders") {
    return value === 1 ? "1 narudžbina" : `${value.toLocaleString("sr-RS")} narudžbina`;
  }

  return value === 1 ? "1 sto" : `${value.toLocaleString("sr-RS")} stolova`;
}

function formatRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return "Period nije podešen";
  }

  return `${startDate} · ${endDate}`;
}

export function GoalModal({
  open,
  staffMembers,
  onClose,
  onSubmit,
  initialTargetMode,
}: GoalModalProps) {
  const defaultStartDate = getTodayInputDate();
  const defaultEndDate = addDaysInputDate(defaultStartDate, 7);
  const defaultTargetMode = initialTargetMode ?? (staffMembers.length === 1 ? "single" : "all");

  const [values, setValues] = useState<GoalFormValues>({
    targetMode: defaultTargetMode,
    singleStaffId: staffMembers[0]?.id ?? "",
    selectedStaffIds: [],
    amount: 150000,
    metric: "revenue",
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    bonus: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const startDate = getTodayInputDate();
    const nextTargetMode = initialTargetMode ?? (staffMembers.length === 1 ? "single" : "all");

    setValues({
      targetMode: nextTargetMode,
      singleStaffId: staffMembers[0]?.id ?? "",
      selectedStaffIds: [],
      amount: 150000,
      metric: "revenue",
      startDate,
      endDate: addDaysInputDate(startDate, 7),
      bonus: "",
    });
    setError("");
    setIsSubmitting(false);
    setPickerOpen(false);
    setPickerSearch("");
    setPickerSelectedIds([]);
  }, [open, staffMembers, initialTargetMode]);

  const staffOptions = staffMembers.map((staff) => ({
    label: `${staff.fullName} · @${staff.username}`,
    value: staff.id,
    icon: "◎",
  }));

  const selectedSingleStaff = staffMembers.find((staff) => staff.id === values.singleStaffId);
  const selectedStaff = staffMembers.filter((staff) => values.selectedStaffIds.includes(staff.id));

  const targetSummary = (() => {
    if (values.targetMode === "all") {
      return `${staffMembers.length} konobara`;
    }

    if (values.targetMode === "single") {
      return selectedSingleStaff?.fullName ?? "Nije izabran konobar";
    }

    if (selectedStaff.length === 0) {
      return "Nije izabrana grupa";
    }

    return selectedStaff.length === 1 ? "1 konobar" : `${selectedStaff.length} konobara`;
  })();

  const targetPreviewText = (() => {
    if (values.targetMode === "all") {
      return "Svi aktivni konobari";
    }

    if (values.targetMode === "single") {
      return selectedSingleStaff
        ? `@${selectedSingleStaff.username} · ${selectedSingleStaff.role}`
        : "Konobar nije izabran";
    }

    if (selectedStaff.length === 0) {
      return "Još nijedan konobar nije izabran.";
    }

    return selectedStaff.map((staff) => staff.fullName).join(", ");
  })();

  const pickerItems = useMemo<AssignmentPickerItem[]>(() => {
    const normalizedSearch = pickerSearch.trim().toLowerCase();

    return staffMembers
      .filter(
        (staff) =>
          !normalizedSearch ||
          staff.fullName.toLowerCase().includes(normalizedSearch) ||
          staff.username.toLowerCase().includes(normalizedSearch),
      )
      .map((staff) => ({
        id: staff.id,
        title: staff.fullName,
        subtitle: `@${staff.username} · ${staff.role}`,
        imageUrl: staff.avatarUrl,
        avatarText: getInitials(staff.fullName),
      }));
  }, [pickerSearch, staffMembers]);

  const changeMetric = (metric: GoalMetric) => {
    setValues((currentValues) => ({
      ...currentValues,
      metric,
      amount: getDefaultAmount(metric),
    }));
    setError("");
  };

  const setTargetMode = (targetMode: GoalTargetMode) => {
    setValues((currentValues) => ({
      ...currentValues,
      targetMode,
    }));
    setError("");
  };

  const openPicker = () => {
    setPickerSelectedIds(values.selectedStaffIds);
    setPickerSearch("");
    setPickerOpen(true);
  };

  const togglePickerItem = (staffId: string) => {
    setPickerSelectedIds((currentIds) =>
      currentIds.includes(staffId)
        ? currentIds.filter((id) => id !== staffId)
        : [...currentIds, staffId],
    );
  };

  const confirmPicker = () => {
    setValues((currentValues) => ({
      ...currentValues,
      selectedStaffIds: pickerSelectedIds,
    }));
    setError("");
    setIsSubmitting(false);
    setPickerOpen(false);
  };

  const removeSelectedStaff = (staffId: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      selectedStaffIds: currentValues.selectedStaffIds.filter((id) => id !== staffId),
    }));
    setError("");
  };

  const submit = async () => {
    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);

    if (result.ok === false) {
      setError(result.message);
      return;
    }

    onClose();
  };

  return (
    <>
      <AppModal
        open={open}
        title="Postavi cilj"
        subtitle="Definišite kome se cilj dodeljuje, šta se meri i u kom periodu."
        onClose={onClose}
        containerClassName="goal-modal-container"
        bodyClassName="goal-modal-body custom-scrollbar"
        footer={<ModalActions confirmLabel={isSubmitting ? "Čuvanje..." : "Sačuvaj cilj"} disabled={isSubmitting} onCancel={onClose} onConfirm={submit} />}
      >
        <div className="modal-field">
          <label>
            Kome se cilj dodeljuje <span className="required-mark">*</span>
          </label>

          <SegmentedSlider
            value={values.targetMode}
            options={targetModeOptions.map((option) => ({
              value: option.value,
              label: option.title,
              icon: <span>{option.icon}</span>,
            }))}
            onChange={setTargetMode}
            className="goal-assignment-slider"
          />
        </div>

        {values.targetMode === "single" ? (
          <div className="modal-field goal-nested-field">
            <label>
              Konobar <span className="required-mark">*</span>
            </label>

            <SearchableGlassSelect
              value={values.singleStaffId}
              options={staffOptions}
              onChange={(singleStaffId) => {
                setValues((currentValues) => ({
                  ...currentValues,
                  singleStaffId,
                }));
                setError("");
              }}
              placeholder="Izaberite konobara"
              searchPlaceholder="Pretraži konobare..."
              emptyText="Nema konobara."
            />
          </div>
        ) : null}

        {values.targetMode === "multiple" ? (
          <div className="modal-field goal-nested-field">
            <label>
              Izabrani konobari <span className="required-mark">*</span>
            </label>

            <div className="goal-selected-workers-panel">
              <div className="goal-selected-workers-header">
                <span>{selectedStaff.length === 1 ? "1 konobar" : `${selectedStaff.length} konobara`}</span>

                <button type="button" className="btn-open-assignment-picker" onClick={openPicker}>
                  Dodaj konobare
                </button>
              </div>

              <div className="goal-selected-workers-list">
                {selectedStaff.length > 0 ? (
                  selectedStaff.map((staff) => (
                    <button
                      key={staff.id}
                      type="button"
                      className="selected-group-member-pill goal-worker-pill"
                      onClick={() => removeSelectedStaff(staff.id)}
                    >
                      <span className="goal-worker-avatar">
                        {staff.avatarUrl ? <img src={staff.avatarUrl} alt={staff.fullName} /> : getInitials(staff.fullName)}
                      </span>
                      <span className="goal-worker-copy">
                        <strong>{staff.fullName}</strong>
                        <small>@{staff.username}</small>
                      </span>
                      <span className="goal-worker-remove">×</span>
                    </button>
                  ))
                ) : (
                  <div className="goal-selected-workers-empty">
                    Još nijedan konobar nije izabran.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="modal-inner-divider goal-divider">
          <div className="divider-elegant" />
        </div>

        <div className="modal-field goal-value-field">
          <label>
            Šta se meri <span className="required-mark">*</span>
          </label>

          <SegmentedSlider
            value={values.metric}
            options={metricOptions}
            onChange={changeMetric}
            className="goal-metric-slider"
          />
        </div>

        <div className="modal-field">
          <label>
            Vrednost cilja <span className="required-mark">*</span>
          </label>

          <div className="goal-value-input-row">
            <input
              type="text"
              inputMode="numeric"
              className="modal-input goal-amount-input"
              value={values.amount.toLocaleString("sr-RS")}
              placeholder="Unesite vrednost"
              onChange={(event) => {
                setValues((currentValues) => ({
                  ...currentValues,
                  amount: parseAmount(event.target.value),
                }));
                setError("");
              }}
            />

            <span>{getMetricSuffix(values.metric)}</span>
          </div>
        </div>

        <div className="modal-field">
          <label>
            Period cilja <span className="required-mark">*</span>
          </label>

          <div className="goal-date-range-grid">
            <GlassDatePicker
              label="Od"
              value={values.startDate}
              onChange={(startDate) => {
                setValues((currentValues) => ({
                  ...currentValues,
                  startDate,
                }));
                setError("");
              }}
              max={values.endDate || undefined}
            />

            <GlassDatePicker
              label="Do"
              value={values.endDate}
              onChange={(endDate) => {
                setValues((currentValues) => ({
                  ...currentValues,
                  endDate,
                }));
                setError("");
              }}
              min={values.startDate || undefined}
            />
          </div>
        </div>

        <ModalTextField
          label="Bonus (opciono)"
          value={values.bonus}
          placeholder="npr. 5000 RSD, slobodan dan, poklon vaučer..."
          onChange={(bonus) =>
            setValues((currentValues) => ({
              ...currentValues,
              bonus,
            }))
          }
        />

        {error ? <div className="staff-form-error">{error}</div> : null}

        <PreviewDivider />

        <div className="preview-card goal-preview-card">
          <div className="preview-header">
            <div className="preview-image goal-preview-image">
              <span>🎯</span>
            </div>

            <div className="preview-info">
              <h4>{targetSummary}</h4>

              <div className="preview-meta-row">
                <span className="preview-price">
                  {formatGoalValue(values.amount, values.metric)}
                </span>
                <span className="preview-category">· {formatRange(values.startDate, values.endDate)}</span>
              </div>

              <p>{targetPreviewText}</p>

              <div className="goal-preview-bonus">
                <span>Bonus:</span>
                <strong>{values.bonus.trim() || "Bez bonusa"}</strong>
              </div>
            </div>
          </div>
        </div>
      </AppModal>

      <AssignmentPickerModal
        open={pickerOpen}
        title="Dodaj konobare"
        subtitle="Izaberite konobare kojima se dodeljuje cilj"
        search={pickerSearch}
        searchPlaceholder="Pretraži konobare..."
        items={pickerItems}
        selectedIds={pickerSelectedIds}
        emptyText="Nema konobara za prikaz."
        confirmLabel="Dodaj konobare"
        onSearchChange={setPickerSearch}
        onToggle={togglePickerItem}
        onClose={() => setPickerOpen(false)}
        onConfirm={confirmPicker}
      />
    </>
  );
}