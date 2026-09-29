// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { routes } from "../../../app/routes";
import type {
  ActionResult,
  StaffFormErrors,
  StaffFormValues,
  StaffMember,
  StaffRole,
  StaffRoleFilter,
  StaffStatusFilter,
} from "../../../entities/staff/staff.types";
import { RoleManagerModal } from "./components/RoleManagerModal";
import { useStaff } from "./hooks/useStaff";
import { AppModal } from "../../../shared/modals/AppModal";
import { ModalActions } from "../../../shared/modals/ModalActions";
import { ConfirmModal } from "../../../shared/modals/ConfirmModal";
import { GlassDropdown } from "../../../shared/forms/GlassDropdown";
import { ImageUploadField } from "../../../shared/forms/ImageUploadField";
import { ModalTextField } from "../../../shared/forms/ModalTextField";
import { GlassSearchInput } from "../../../shared/forms/GlassSearchInput";
import { StatusPills } from "../../../shared/ui/StatusPills";
import { GlassButton } from "../../../shared/ui/GlassButton";
import { GlassBadge } from "../../../shared/ui/GlassBadge";
import { IconButton } from "../../../shared/ui/IconButton";
import { PreviewDivider } from "../../../shared/ui/PreviewDivider";
import { SegmentedSlider } from "../../../shared/ui/SegmentedSlider";
import { Toast } from "../../../shared/feedback/Toast";

type StaffFormModalState =
  | {
      mode: "create";
      worker: null;
    }
  | {
      mode: "edit";
      worker: StaffMember;
    }
  | null;

type ConfirmModalState =
  | {
      type: "delete" | "deactivate";
      worker: StaffMember;
    }
  | null;

type ToastState = {
  id: number;
  message: string;
} | null;

const maxImageSize = 3 * 1024 * 1024;

const genderOptions = [
  { value: "male", label: "Muški" },
  { value: "female", label: "Ženski" },
  { value: "other", label: "Ostalo" },
] satisfies {
  value: StaffFormValues["gender"];
  label: string;
}[];

function getInitials(fullName: string) {
  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return initials || "👤";
}

function isValidImageFile(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= maxImageSize;
}

function StaffFormModal({
  open,
  mode,
  worker,
  roles,
  roleIcons,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  worker: StaffMember | null;
  roles: StaffRole[];
  roleIcons: Record<string, string>;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => ActionResult | Promise<ActionResult>;
}) {
  const [values, setValues] = useState<StaffFormValues>({
    fullName: "",
    username: "",
    password: "",
    role: roles[0] ?? "Konobar",
    gender: "male",
    avatarUrl: "",
  });
  const [errors, setErrors] = useState<StaffFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(
      worker
        ? {
            fullName: worker.fullName,
            username: worker.username,
            password: "",
            role: worker.role,
            gender: worker.gender,
            avatarUrl: worker.avatarUrl,
          }
        : {
            fullName: "",
            username: "",
            password: "",
            role: roles[0] ?? "Konobar",
            gender: "male",
            avatarUrl: "",
          },
    );

    setErrors({});
  }, [open, worker, roles]);

  if (!open) {
    return null;
  }

  const setField = <K extends keyof StaffFormValues>(field: K, value: StaffFormValues[K]) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      general: undefined,
    }));
  };

  const validate = () => {
    const nextErrors: StaffFormErrors = {};

    if (!values.fullName.trim()) {
      nextErrors.fullName = "Ime i prezime su obavezni.";
    }

    if (!values.username.trim()) {
      nextErrors.username = "Korisničko ime je obavezno.";
    }

    if (mode === "create" && !values.password.trim()) {
      nextErrors.password = "Lozinka je obavezna za novog radnika.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate() || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await onSubmit(values);

      if (result.ok === false) {
        setErrors({
          general: result.message,
        });
        return;
      }

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const readImage = (file: File) => {
    if (!isValidImageFile(file)) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        general: "Dozvoljene su JPG, PNG i WEBP slike do 3MB.",
      }));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setField("avatarUrl", reader.result);
      }
    };

    reader.readAsDataURL(file);
  };

  const previewName = values.fullName.trim() || "Ime i prezime";
  const previewUsername = values.username.trim() ? `@${values.username.trim()}` : "@korisnicko_ime";
  const genderLabel = genderOptions.find((option) => option.value === values.gender)?.label ?? "Muški";

  return (
    <AppModal
      open={open}
      title={mode === "create" ? "Dodaj radnika" : "Izmeni radnika"}
      subtitle={mode === "create" ? "Kreirajte novi nalog za radnika" : "Izmenite podatke postojećeg naloga"}
      onClose={onClose}
      footer={
        <ModalActions
          confirmLabel={isSubmitting ? "Čuvanje..." : mode === "create" ? "Dodaj radnika" : "Sačuvaj izmene"}
          disabled={isSubmitting}
          onCancel={onClose}
          onConfirm={submit}
        />
      }
    >
      <ImageUploadField
        imageUrl={values.avatarUrl}
        alt={previewName}
        fallback={getInitials(values.fullName)}
        onFileSelected={readImage}
      />

      <ModalTextField
        label="Ime i prezime"
        required
        value={values.fullName}
        error={errors.fullName}
        placeholder="npr. Marko Todorović"
        onChange={(fullName) => setField("fullName", fullName)}
      />

      <ModalTextField
        label="Korisničko ime"
        required
        value={values.username}
        error={errors.username}
        placeholder="npr. marko.t"
        onChange={(username) => setField("username", username)}
      />

      <ModalTextField
        label="Lozinka"
        required={mode === "create"}
        type="password"
        value={values.password}
        error={errors.password}
        placeholder="••••••••"
        hint={mode === "create" ? "Unesite inicijalnu lozinku." : "Ostavite prazno da zadržite postojeću lozinku."}
        onChange={(password) => setField("password", password)}
      />

      <div className="modal-field worker-gender-field">
        <label>Pol</label>

        <SegmentedSlider
          value={values.gender}
          options={genderOptions}
          onChange={(gender) => setField("gender", gender)}
          className="worker-gender-slider"
        />
      </div>

      <div className="modal-field">
        <label>
          Uloga <span className="required-mark">*</span>
        </label>

        <GlassDropdown
          value={values.role}
          options={roles.map((role) => ({
            label: role,
            value: role,
            icon: roleIcons[role] ?? "◎",
          }))}
          onChange={(role) => setField("role", role)}
        />
      </div>

      {errors.general ? <div className="staff-form-error">{errors.general}</div> : null}

      <PreviewDivider label="Pregled" className="worker-preview-divider" />

      <div className="worker-preview-card">
        <div className="worker-preview-header">
          <div className="worker-preview-image">
            {values.avatarUrl ? (
              <img src={values.avatarUrl} alt={previewName} />
            ) : (
              <span>{getInitials(values.fullName)}</span>
            )}
          </div>

          <div className="worker-preview-info">
            <h4>{previewName}</h4>
            <div className="worker-preview-details">
              <span>{previewUsername}</span>
              <span>·</span>
              <span>{genderLabel}</span>
              <span>·</span>
              <span>
                {roleIcons[values.role] ?? "◎"} {values.role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  );
}

export function StaffManagementFeature() {
  const staff = useStaff();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [formModal, setFormModal] = useState<StaffFormModalState>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (searchParams.get("modal") === "roles") {
      setIsRoleModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const closeRoleManager = () => {
    setIsRoleModalOpen(false);

    if (searchParams.get("modal") === "roles") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("modal");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast({
      id: Date.now(),
      message,
    });

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const openWorkerDetails = (worker: StaffMember) => {
    navigate(`${routes.owner.staff}/${worker.id}`);
  };

  const handleSubmitWorker = async (values: StaffFormValues): Promise<ActionResult> => {
    const result =
      formModal?.mode === "edit"
        ? await staff.updateWorker(formModal.worker.id, values)
        : await staff.createWorker(values);

    if (result.ok) {
      showToast(formModal?.mode === "edit" ? "Podaci radnika su uspešno ažurirani." : "Radnik je uspešno dodat.");
    }

    return result;
  };

  const confirmAction = async () => {
    if (!confirmModal) {
      return;
    }

    if (confirmModal.type === "delete") {
      const result = await staff.deleteWorker(confirmModal.worker.id);
      if (result.ok) {
        showToast(`Radnik "${confirmModal.worker.fullName}" je obrisan.`);
      } else if ("message" in result) {
        showToast(result.message);
      }
    }

    if (confirmModal.type === "deactivate") {
      const result = await staff.deactivateWorker(confirmModal.worker.id);
      if (result.ok) {
        showToast(`Radnik "${confirmModal.worker.fullName}" je deaktiviran.`);
      } else if ("message" in result) {
        showToast(result.message);
      }
    }

    setConfirmModal(null);
  };

  const handleToggleStatus = async (worker: StaffMember) => {
    if (worker.status === "active") {
      setConfirmModal({
        type: "deactivate",
        worker,
      });
      return;
    }

    const result = await staff.activateWorker(worker.id);
    if (result.ok) {
      showToast(`Radnik "${worker.fullName}" je ponovo aktiviran.`);
    } else if ("message" in result) {
      showToast(result.message);
    }
  };

  return (
    <div className="osoblje-layout">
      <div className="map-header">
        <div className="header-row-top">
          <div className="map-title">
            <h1>Upravljanje osobljem</h1>
            <p>Kreirajte, pregledajte ili deaktivirajte naloge radnika</p>
          </div>

          <div className="header-actions">
            <GlassButton variant="primary" onClick={() => setFormModal({ mode: "create", worker: null })}>
              + Dodaj radnika
            </GlassButton>
          </div>
        </div>

        <div className="osoblje-filters">
          <div className="filter-row">
            <div className="search-wrapper">
              <GlassSearchInput value={staff.search} placeholder="Pretraži radnike..." onChange={staff.setSearch} />
            </div>

            <div className="dropdown-wrapper">
              <GlassDropdown<StaffRoleFilter>
                value={staff.roleFilter}
                options={[
                  { label: "Sve uloge", value: "all", icon: "◎" },
                  ...staff.roles.map((role) => ({
                    label: role,
                    value: role,
                    icon: staff.roleIcons[role] ?? "◎",
                  })),
                ]}
                onChange={staff.setRoleFilter}
                triggerClassName="category-filter-trigger"
              />
            </div>
          </div>

          <div className="status-pills-wrapper">
            <StatusPills<StaffStatusFilter>
              value={staff.statusFilter}
              onChange={staff.setStatusFilter}
              options={[
                { label: "Svi", value: "all", count: staff.counters.all },
                { label: "Aktivni", value: "active", count: staff.counters.active },
                { label: "Neaktivni", value: "inactive", count: staff.counters.inactive },
              ]}
            />
          </div>
        </div>
      </div>


      {staff.isLoading ? <div className="empty-state">Učitavanje osoblja iz baze...</div> : null}
      {staff.error ? <div className="empty-state error-state">{staff.error}</div> : null}

      <div className="osoblje-table-container">
        <div className="table-header">
          <div className="col-avatar" />
          <div className="col-name table-header-cell">Ime i prezime</div>
          <div className="col-username table-header-cell">Korisničko ime</div>
          <div className="col-role table-header-cell">Uloga</div>
          <div className="col-status table-header-cell">Status</div>
          <div className="col-actions" />
        </div>

        <div className="table-body">
          {staff.filteredStaff.length > 0 ? (
            staff.filteredStaff.map((worker) => (
              <div
                className={`table-row clickable ${worker.status === "inactive" ? "inactive" : ""}`}
                key={worker.id}
                role="button"
                tabIndex={0}
                onClick={() => openWorkerDetails(worker)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openWorkerDetails(worker);
                  }
                }}
              >
                <div className="col-avatar">
                  <div className="staff-avatar">
                    {worker.avatarUrl ? <img src={worker.avatarUrl} alt={worker.fullName} /> : getInitials(worker.fullName)}
                  </div>
                </div>

                <div className="col-name staff-name-cell">{worker.fullName}</div>
                <div className="col-username staff-muted-cell">@{worker.username}</div>
                <div className="col-role staff-muted-cell">
                  {staff.roleIcons[worker.role] ?? "◎"} {worker.role}
                </div>

                <div className="col-status">
                  <GlassBadge tone={worker.status === "active" ? "success" : "muted"} dot className={`staff-status-badge ${worker.status === "inactive" ? "inactive" : ""}`}>
                    {worker.status === "active" ? "Aktivan" : "Neaktivan"}
                  </GlassBadge>
                </div>

                <div className="col-actions">
                  <IconButton
                    className="mobile-edit-action"
                    title="Detalji radnika"
                    onClick={(event) => {
                      event.stopPropagation();
                      openWorkerDetails(worker);
                    }}
                  >
                    ✎
                  </IconButton>

                  <IconButton
                    variant={worker.status === "inactive" ? "success" : "default"}
                    title={worker.status === "active" ? "Deaktiviraj" : "Aktiviraj"}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleStatus(worker);
                    }}
                  >
                    {worker.status === "active" ? "⊘" : "✓"}
                  </IconButton>

                  <IconButton
                    variant="danger"
                    title="Obriši"
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmModal({
                        type: "delete",
                        worker,
                      });
                    }}
                  >
                    🗑
                  </IconButton>
                </div>
              </div>
            ))
          ) : (
            <div className="staff-empty-state">Nema pronađenih radnika.</div>
          )}
        </div>
      </div>

      <StaffFormModal
        open={formModal !== null}
        mode={formModal?.mode ?? "create"}
        worker={formModal?.mode === "edit" ? formModal.worker : null}
        roles={staff.roles}
        roleIcons={staff.roleIcons}
        onClose={() => setFormModal(null)}
        onSubmit={handleSubmitWorker}
      />

      <ConfirmModal
        open={confirmModal !== null}
        title={confirmModal?.type === "delete" ? "Potvrda brisanja" : "Potvrda deaktivacije"}
        message={
          confirmModal?.type === "delete"
            ? `Da li ste sigurni da želite da obrišete "${confirmModal.worker.fullName}"?`
            : `Deaktivacijom naloga "${confirmModal?.worker.fullName}" radnik više neće moći da se prijavi na sistem. Da li ste sigurni?`
        }
        confirmLabel={confirmModal?.type === "delete" ? "Obriši" : "Deaktiviraj"}
        danger
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmAction}
      />

      <RoleManagerModal
        open={isRoleModalOpen}
        roles={staff.roles}
        roleIcons={staff.roleIcons}
        staff={staff.staff}
        onClose={closeRoleManager}
        onCreateRole={staff.createRole}
        onUpdateRole={staff.updateRole}
        onDeleteRole={staff.deleteRole}
      />

      {toast ? <Toast key={toast.id} message={toast.message} /> : null}
    </div>
  );
}