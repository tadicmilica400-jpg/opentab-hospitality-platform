// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { routes } from "../../../../app/routes";
import type { GoalFormValues, GoalMetric } from "../../../../entities/analytics/analytics.types";
import type {
    StaffDetailsData,
    StaffDetailsFormValues,
    StaffDetailsTab,
} from "../../../../entities/staff/staff-details.types";
import { GoalModal } from "../../analytics/components/GoalModal";
import { createAnalyticsGoal } from "../../analytics/api/analyticsApi";
import {
    StaffDetailsContent,
    type StaffDetailsGoalSummary,
} from "./components/StaffDetailsContent";
import { StaffDetailsProfilePanel } from "./components/StaffDetailsProfilePanel";
import { StaffDetailsTabs } from "./components/StaffDetailsTabs";
import {
    activateStaffMember,
    createStaffShift,
    deactivateStaffMember,
    deleteStaffMember,
    deleteStaffShift,
    getStaffDetails,
    getStaffRoles,
    updateStaffMember,
    updateStaffShift,
} from "../api/staffApi";
import { AppModal } from "../../../../shared/modals/AppModal";
import { ConfirmModal } from "../../../../shared/modals/ConfirmModal";
import { ModalActions } from "../../../../shared/modals/ModalActions";
import { GlassDatePicker } from "../../../../shared/forms/GlassDatePicker";
import { GlassTimePicker } from "../../../../shared/forms/GlassTimePicker";
import { GlassDropdown } from "../../../../shared/forms/GlassDropdown";
import type { ActionResult } from "../../../../shared/types/action.types";
import { Toast } from "../../../../shared/feedback/Toast";
import { GlassButton } from "../../../../shared/ui/GlassButton";
import { notifyOwnerSidebarChanged } from "../../../../layouts/sidebar/ownerSidebarApi";

type ToastState = {
    id: number;
    message: string;
} | null;

type ShiftType = "Jutarnja" | "Popodnevna" | "Večernja" | "Drugo";

type ShiftDraft = {
    date: string;
    startTime: string;
    endTime: string;
    sector: string;
    type: ShiftType;
};

type ConfirmState = "deactivate" | "delete" | null;

const sectorOptions = [
    { label: "Glavna sala", value: "Glavna sala", icon: "◎" },
    { label: "Terasa", value: "Terasa", icon: "◇" },
    { label: "Bašta", value: "Bašta", icon: "◆" },
    { label: "Šank", value: "Šank", icon: "◈" },
    { label: "VIP separe", value: "VIP separe", icon: "✦" },
];

function getTodayInputDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
    const date = new Date(`${value}T00:00:00`);

    return Number.isNaN(date.getTime()) ? null : date;
}

function getDayDiff(startDate: Date, endDate: Date) {
    const oneDay = 24 * 60 * 60 * 1000;

    return Math.round((endDate.getTime() - startDate.getTime()) / oneDay);
}

function getDisplayDate(value: string) {
    const date = parseInputDate(value);

    if (!date) return { day: "—", date: value };

    const dayNames = ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"];
    const day = `${date.getDate()}`.padStart(2, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");

    return {
        day: dayNames[date.getDay()],
        date: `${day}.${month}.`,
    };
}

function createShiftFromDraft(id: string, draft: ShiftDraft) {
    const displayDate = getDisplayDate(draft.date);

    return {
        id,
        day: displayDate.day,
        date: displayDate.date,
        inputDate: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        time: `${draft.startTime} - ${draft.endTime}`,
        sector: draft.sector,
        type: draft.type,
        status: "confirmed" as const,
    };
}

function createInitialValues(data: StaffDetailsData): StaffDetailsFormValues {
    return {
        fullName: data.profile.fullName || "",
        username: data.profile.username || "",
        email: data.profile.email || "",
        phone: data.profile.phone || "",
        role: data.profile.role || "Konobar",
        salary: String(data.profile.salary ?? ""),
        hireDate: data.profile.hireDate || "",
        birthday: data.profile.birthday || "",
        gender: data.profile.gender ?? "other",
        shiftType: data.profile.shiftType || "",
        status: data.profile.status || "active",
        note: data.profile.note || "",
    };
}

function getMetricLabel(metric: GoalMetric) {
    if (metric === "orders") return "Cilj narudžbina";
    if (metric === "tables") return "Cilj stolova";
    return "Cilj prihoda";
}

function getGoalPace(metric: GoalMetric) {
    if (metric === "orders") return 0.64;
    if (metric === "tables") return 0.68;
    return 0.72;
}

function calculateGoalCurrentValue({
    metric,
    targetValue,
    startDate,
    endDate,
}: {
    metric: GoalMetric;
    targetValue: number;
    startDate: string;
    endDate: string;
}) {
    const start = parseInputDate(startDate);
    const end = parseInputDate(endDate);
    const today = parseInputDate(getTodayInputDate());

    if (!start || !end || !today || today < start) {
        return 0;
    }

    const totalDays = Math.max(getDayDiff(start, end) + 1, 1);
    const elapsedDays = Math.min(Math.max(getDayDiff(start, today) + 1, 0), totalDays);
    const elapsedRatio = elapsedDays / totalDays;
    const pace = getGoalPace(metric);

    return Math.min(Math.round(targetValue * elapsedRatio * pace), targetValue);
}

function ShiftModal({
    open,
    mode,
    workerName,
    draft,
    onChange,
    onClose,
    onSubmit,
}: {
    open: boolean;
    mode: "create" | "edit";
    workerName: string;
    draft: ShiftDraft;
    onChange: <K extends keyof ShiftDraft>(field: K, value: ShiftDraft[K]) => void;
    onClose: () => void;
    onSubmit: () => void;
}) {
    const shiftPresets = [
        { type: "Jutarnja", label: "Jutarnja", time: "08:00 - 16:00", startTime: "08:00", endTime: "16:00" },
        { type: "Popodnevna", label: "Popodnevna", time: "14:00 - 22:00", startTime: "14:00", endTime: "22:00" },
        { type: "Večernja", label: "Večernja", time: "16:00 - 00:00", startTime: "16:00", endTime: "00:00" },
    ] satisfies Array<{
        type: ShiftType;
        label: string;
        time: string;
        startTime: string;
        endTime: string;
    }>;

    const [manualTimeOpen, setManualTimeOpen] = useState(false);

    useEffect(() => {
        const matchesPreset = shiftPresets.some((preset) => preset.startTime === draft.startTime && preset.endTime === draft.endTime);
        setManualTimeOpen(!matchesPreset);
    }, [draft.startTime, draft.endTime]);

    const applyPreset = (preset: (typeof shiftPresets)[number]) => {
        setManualTimeOpen(false);
        onChange("type", preset.type);
        onChange("startTime", preset.startTime);
        onChange("endTime", preset.endTime);
    };

    const openManualTime = () => {
        setManualTimeOpen(true);
    };

    return (
        <AppModal
            open={open}
            title={mode === "create" ? "Dodaj smenu" : "Izmeni smenu"}
            subtitle={mode === "create" ? `Nova smena za radnika: ${workerName}` : `Ažuriranje smene za radnika: ${workerName}`}
            onClose={onClose}
            containerClassName="add-shift-modal"
            bodyClassName="add-shift-modal-body"
            footer={
                <ModalActions
                    cancelLabel="Otkaži"
                    confirmLabel={mode === "create" ? "Sačuvaj smenu" : "Sačuvaj izmene"}
                    onCancel={onClose}
                    onConfirm={onSubmit}
                />
            }
        >
            <div className="shift-modal-grid">
                <GlassDatePicker
                    label="Datum smene"
                    value={draft.date}
                    onChange={(date) => onChange("date", date)}
                />

                <div className="modal-field add-shift-sector-field">
                    <label>Sektor</label>

                    <GlassDropdown
                        value={draft.sector}
                        options={sectorOptions}
                        onChange={(sector) => onChange("sector", sector)}
                        placeholder="Izaberite sektor"
                        triggerClassName="modal-dropdown add-shift-sector-trigger"
                    />
                </div>
            </div>

            <div className="modal-field shift-preset-section">
                <label>Prečice za smenu</label>

                <div className="shift-preset-pills">
                    {shiftPresets.map((preset) => (
                        <button
                            key={preset.type}
                            type="button"
                            className={`shift-preset-pill ${!manualTimeOpen && draft.type === preset.type ? "active" : ""}`.trim()}
                            onClick={() => applyPreset(preset)}
                        >
                            <strong>{preset.label}</strong>
                            <span>{preset.time}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`shift-preset-pill custom ${manualTimeOpen ? "active" : ""}`.trim()}
                        onClick={openManualTime}
                    >
                        <strong>Drugo</strong>
                        <span>Ručna satnica</span>
                    </button>
                </div>
            </div>

            {manualTimeOpen ? (
                <div className="modal-field staff-details-time-section">
                    <label>Ručna satnica</label>

                    <div className="staff-details-time-grid">
                        <GlassTimePicker
                            label="Od"
                            value={draft.startTime}
                            onChange={(startTime) => onChange("startTime", startTime)}
                            stepMinutes={15}
                        />

                        <GlassTimePicker
                            label="Do"
                            value={draft.endTime}
                            onChange={(endTime) => onChange("endTime", endTime)}
                            stepMinutes={15}
                        />
                    </div>
                </div>
            ) : null}
        </AppModal>
    );
}

function getSafeNumber(value: unknown, fallback = 0) {
    const numberValue = typeof value === "number" ? value : Number(value);

    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Došlo je do greške pri komunikaciji sa bazom.";
}

const emptyFormValues: StaffDetailsFormValues = {
    fullName: "",
    username: "",
    email: "",
    phone: "",
    role: "Konobar",
    salary: "",
    hireDate: "",
    birthday: "",
    gender: "other",
    shiftType: "",
    status: "active",
    note: "",
};

function getTargetPayload(goalValues: GoalFormValues) {
    if (goalValues.metric === "orders") {
        return { targetOrderCount: goalValues.amount };
    }

    if (goalValues.metric === "tables") {
        return { targetTableCount: goalValues.amount };
    }

    return { targetRevenue: goalValues.amount };
}

export function StaffDetailsFeature() {
    const navigate = useNavigate();
    const { workerId = "" } = useParams();
    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const initialTab: StaffDetailsTab = tabParam === "performance" ? "performance" : tabParam === "schedule" ? "schedule" : "tables";

    const [data, setData] = useState<StaffDetailsData | null>(null);
    const [roles, setRoles] = useState<string[]>(["Konobar"]);
    const [activeTab, setActiveTab] = useState<StaffDetailsTab>(initialTab);
    const [values, setValues] = useState<StaffDetailsFormValues>(emptyFormValues);
    const [initialValues, setInitialValues] = useState<StaffDetailsFormValues>(emptyFormValues);
    const [toast, setToast] = useState<ToastState>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [confirmState, setConfirmState] = useState<ConfirmState>(null);
    const [schedule, setSchedule] = useState<StaffDetailsData["schedule"]>([]);
    const [shiftDraft, setShiftDraft] = useState<ShiftDraft>({
        date: getTodayInputDate(),
        startTime: "16:00",
        endTime: "00:00",
        sector: "Glavna sala",
        type: "Večernja",
    });
    const [workerGoals, setWorkerGoals] = useState<StaffDetailsGoalSummary[]>([]);

    const showToast = (message: string) => {
        setToast({
            id: Date.now(),
            message,
        });

        window.setTimeout(() => {
            setToast(null);
        }, 2800);
    };

    const applyDetails = (nextData: StaffDetailsData) => {
        const nextValues = createInitialValues(nextData);

        setData(nextData);
        setValues(nextValues);
        setInitialValues(nextValues);
        setSchedule(nextData.schedule);
        setWorkerGoals(nextData.goals ?? []);
    };

    const loadDetails = async () => {
        if (!workerId) {
            throw new Error("Radnik nije pronađen.");
        }

        const [detailsResponse, rolesResponse] = await Promise.all([
            getStaffDetails(workerId),
            getStaffRoles(),
        ]);

        setRoles(rolesResponse.role_names?.length ? rolesResponse.role_names : [detailsResponse.profile.role]);
        applyDetails(detailsResponse);
    };

    useEffect(() => {
        let cancelled = false;

        async function loadInitialDetails() {
            try {
                setIsLoading(true);
                setError(null);
                const [detailsResponse, rolesResponse] = await Promise.all([
                    getStaffDetails(workerId),
                    getStaffRoles(),
                ]);

                if (cancelled) {
                    return;
                }

                setRoles(rolesResponse.role_names?.length ? rolesResponse.role_names : [detailsResponse.profile.role]);
                applyDetails(detailsResponse);
                setActiveTab(initialTab);
            } catch (loadError) {
                if (!cancelled) {
                    setError(getErrorMessage(loadError));
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadInitialDetails();

        return () => {
            cancelled = true;
        };
    }, [workerId, initialTab]);

    const hasChanges = JSON.stringify(values) !== JSON.stringify(initialValues);

    const setField = <K extends keyof StaffDetailsFormValues>(field: K, value: StaffDetailsFormValues[K]) => {
        setValues((currentValues) => ({
            ...currentValues,
            [field]: value,
        }));
    };

    const setShiftField = <K extends keyof ShiftDraft>(field: K, value: ShiftDraft[K]) => {
        setShiftDraft((currentDraft) => ({
            ...currentDraft,
            [field]: value,
        }));
    };

    const saveChanges = async () => {
        if (!data || !workerId) {
            return;
        }

        try {
            await updateStaffMember(workerId, {
                fullName: values.fullName,
                username: values.username,
                password: "",
                role: values.role,
                gender: values.gender,
                avatarUrl: data.profile.avatarUrl,
                email: values.email,
                phone: values.phone,
                salary: values.salary,
                hireDate: values.hireDate,
                birthday: values.birthday,
                shiftType: values.shiftType,
                status: values.status,
                note: values.note,
            });
            await loadDetails();
            notifyOwnerSidebarChanged();
            showToast("Podaci radnika su sačuvani u bazi.");
        } catch (saveError) {
            showToast(getErrorMessage(saveError));
        }
    };

    const openCreateShiftModal = () => {
        setEditingShiftId(null);
        setShiftDraft({
            date: getTodayInputDate(),
            startTime: "16:00",
            endTime: "00:00",
            sector: "Glavna sala",
            type: "Večernja",
        });
        setIsShiftModalOpen(true);
    };

    const openEditShiftModal = (shiftId: string) => {
        const shift = schedule.find((item) => item.id === shiftId);

        if (!shift) {
            return;
        }

        setEditingShiftId(shiftId);
        setShiftDraft({
            date: shift.inputDate,
            startTime: shift.startTime,
            endTime: shift.endTime,
            sector: shift.sector,
            type: shift.type,
        });
        setIsShiftModalOpen(true);
    };

    const saveShift = async () => {
        if (!workerId) {
            return;
        }

        const localShift = createShiftFromDraft(editingShiftId ?? `shift-${Date.now()}`, shiftDraft);

        try {
            if (editingShiftId) {
                const updatedShift = await updateStaffShift(workerId, editingShiftId, shiftDraft);
                setSchedule((currentSchedule) =>
                    currentSchedule.map((shift) => (shift.id === editingShiftId ? updatedShift : shift)),
                );
                showToast(`Smena za "${values.fullName}" je izmenjena u bazi.`);
            } else {
                const createdShift = await createStaffShift(workerId, shiftDraft);
                setSchedule((currentSchedule) => [createdShift, ...currentSchedule]);
                showToast(`Smena za "${values.fullName}" je dodata u bazu.`);
            }
        } catch (shiftError) {
            setSchedule((currentSchedule) =>
                editingShiftId
                    ? currentSchedule.map((shift) => (shift.id === editingShiftId ? localShift : shift))
                    : [localShift, ...currentSchedule],
            );
            showToast(getErrorMessage(shiftError));
        }

        setEditingShiftId(null);
        setIsShiftModalOpen(false);
    };

    const deleteShift = async (shiftId: string) => {
        if (!workerId) {
            return;
        }

        try {
            await deleteStaffShift(workerId, shiftId);
            setSchedule((currentSchedule) => currentSchedule.filter((shift) => shift.id !== shiftId));
            showToast("Smena je uklonjena iz baze.");
        } catch (deleteError) {
            showToast(getErrorMessage(deleteError));
        }
    };

    const toggleWorkerStatus = async () => {
        if (!workerId) {
            return;
        }

        if (values.status === "active") {
            setConfirmState("deactivate");
            return;
        }

        try {
            await activateStaffMember(workerId);
            await loadDetails();
            notifyOwnerSidebarChanged();
            showToast("Radnik je ponovo aktiviran.");
        } catch (activateError) {
            showToast(getErrorMessage(activateError));
        }
    };

    const confirmDeactivateWorker = async () => {
        if (!workerId) {
            return;
        }

        try {
            await deactivateStaffMember(workerId);
            await loadDetails();
            notifyOwnerSidebarChanged();
            setConfirmState(null);
            showToast("Radnik je deaktiviran.");
        } catch (deactivateError) {
            showToast(getErrorMessage(deactivateError));
        }
    };

    const createGoalForWorker = async (goalValues: GoalFormValues): Promise<ActionResult> => {
        if (!data) {
            return { ok: false, message: "Radnik nije učitan." };
        }

        if (!Number.isFinite(goalValues.amount) || goalValues.amount <= 0) {
            return {
                ok: false,
                message: "Vrednost cilja mora biti veća od nule.",
            };
        }

        if (!goalValues.startDate || !goalValues.endDate) {
            return {
                ok: false,
                message: "Izaberite početni i krajnji datum cilja.",
            };
        }

        if (goalValues.startDate > goalValues.endDate) {
            return {
                ok: false,
                message: "Početni datum ne može biti posle krajnjeg datuma.",
            };
        }

        const optimisticGoal: StaffDetailsGoalSummary = {
            id: `goal-${Date.now()}`,
            label: getMetricLabel(goalValues.metric),
            metric: goalValues.metric,
            targetValue: goalValues.amount,
            currentValue: calculateGoalCurrentValue({
                metric: goalValues.metric,
                targetValue: goalValues.amount,
                startDate: goalValues.startDate,
                endDate: goalValues.endDate,
            }),
            startDate: goalValues.startDate,
            endDate: goalValues.endDate,
            bonus: goalValues.bonus.trim(),
        };

        setWorkerGoals((currentGoals) => [optimisticGoal, ...currentGoals]);

        try {
            await createAnalyticsGoal({
                targetMode: "single",
                targetMetric: goalValues.metric,
                waiterId: data.profile.id,
                waiterIds: [data.profile.id],
                periodStart: goalValues.startDate,
                periodEnd: goalValues.endDate,
                bonus: goalValues.bonus.trim(),
                ...getTargetPayload(goalValues),
            });
            await loadDetails();
            showToast(`Cilj za "${values.fullName}" je dodat u bazu.`);
            return { ok: true };
        } catch (goalError) {
            setWorkerGoals((currentGoals) => currentGoals.filter((goal) => goal.id !== optimisticGoal.id));
            return { ok: false, message: getErrorMessage(goalError) };
        }
    };

    const headerAction =
        activeTab === "schedule"
            ? {
                label: "Dodaj smenu",
                icon: "+",
                onClick: openCreateShiftModal,
            }
            : activeTab === "performance"
                ? {
                    label: "Postavi cilj",
                    icon: "◎",
                    onClick: () => setIsGoalModalOpen(true),
                }
                : null;

    const deleteWorker = () => {
        setConfirmState("delete");
    };

    const confirmDeleteWorker = async () => {
        if (!workerId) {
            return;
        }

        try {
            await deleteStaffMember(workerId);
            notifyOwnerSidebarChanged();
            setConfirmState(null);
            navigate(routes.owner.staff);
        } catch (deleteError) {
            showToast(getErrorMessage(deleteError));
        }
    };

    if (isLoading) {
        return <div className="empty-state">Učitavanje detalja radnika iz baze...</div>;
    }

    if (error || !data) {
        return (
            <div className="empty-state error-state">
                {error ?? "Radnik nije pronađen."}
            </div>
        );
    }

    const goalStaffMembers = [
        {
            id: data.profile.id,
            fullName: values.fullName,
            username: values.username,
            role: values.role,
            rating: getSafeNumber(data.profile.rating),
            avatarUrl: data.profile.avatarUrl,
        },
    ];

    return (
        <div className="staff-details-layout">
            <div className="staff-details-header-shell">
                <div className="staff-details-header-card">
                    <div className="staff-details-header-left">
                        <button
                            type="button"
                            className="staff-details-back-button"
                            onClick={() => navigate(routes.owner.staff)}
                            aria-label="Nazad na osoblje"
                        >
                            <span className="staff-details-back-wash" />

                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M19 12H5" />
                                <path d="M12 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="map-title staff-details-title-wrapper">
                            <h1>Detalji radnika</h1>
                            <p>{values.fullName || "Novi radnik"} · {values.role} · @{values.username || "username"}</p>
                        </div>
                    </div>

                    {headerAction ? (
                        <div className="header-actions staff-details-header-actions">
                            <GlassButton variant="primary" onClick={headerAction.onClick}>
                                {headerAction.icon} {headerAction.label}
                            </GlassButton>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="staff-details-main">
                <StaffDetailsProfilePanel
                    profile={data.profile}
                    values={values}
                    roles={roles}
                    hasChanges={hasChanges}
                    onChange={setField}
                    onSave={saveChanges}
                    onToggleStatus={toggleWorkerStatus}
                    onDelete={deleteWorker}
                />

                <section className="staff-details-content-card">
                    <div className="staff-details-content-header only-tabs">
                        <StaffDetailsTabs value={activeTab} onChange={setActiveTab} />
                    </div>

                    <StaffDetailsContent
                        data={{
                            ...data,
                            profile: {
                                ...data.profile,
                                ...values,
                            },
                            schedule,
                        }}
                        activeTab={activeTab}
                        goals={workerGoals}
                        onEditShift={openEditShiftModal}
                        onDeleteShift={deleteShift}
                    />
                </section>
            </div>

            <GoalModal
                open={isGoalModalOpen}
                staffMembers={goalStaffMembers}
                initialTargetMode="single"
                onClose={() => setIsGoalModalOpen(false)}
                onSubmit={createGoalForWorker}
            />

            <ShiftModal
                open={isShiftModalOpen}
                mode={editingShiftId ? "edit" : "create"}
                workerName={values.fullName}
                draft={shiftDraft}
                onChange={setShiftField}
                onClose={() => {
                    setIsShiftModalOpen(false);
                    setEditingShiftId(null);
                }}
                onSubmit={saveShift}
            />

            <ConfirmModal
                open={confirmState === "deactivate"}
                title="Deaktivirati nalog?"
                message={`Radnik ${values.fullName} više neće moći da koristi nalog dok ga ponovo ne aktiviraš.`}
                confirmLabel="Deaktiviraj"
                danger
                onClose={() => setConfirmState(null)}
                onConfirm={confirmDeactivateWorker}
            />

            <ConfirmModal
                open={confirmState === "delete"}
                title="Obrisati radnika?"
                message={`Ova akcija uklanja radnika ${values.fullName} iz liste osoblja.`}
                confirmLabel="Obriši"
                danger
                onClose={() => setConfirmState(null)}
                onConfirm={confirmDeleteWorker}
            />

            {toast ? <Toast key={toast.id} message={toast.message} /> : null}
        </div>
    );
}
