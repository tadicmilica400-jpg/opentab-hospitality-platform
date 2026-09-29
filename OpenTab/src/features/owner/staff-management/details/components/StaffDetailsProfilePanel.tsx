// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type {
  StaffDetailsFormValues,
  StaffDetailsProfile,
  StaffGender,
} from "../../../../../entities/staff/staff-details.types";
import { GlassDatePicker } from "../../../../../shared/forms/GlassDatePicker";
import { GlassDropdown } from "../../../../../shared/forms/GlassDropdown";
import { ModalTextField } from "../../../../../shared/forms/ModalTextField";
import { GlassButton } from "../../../../../shared/ui/GlassButton";
import { GlassBadge } from "../../../../../shared/ui/GlassBadge";
import { SegmentedSlider } from "../../../../../shared/ui/SegmentedSlider";

const genderOptions = [
  { value: "male", label: "Muški" },
  { value: "female", label: "Ženski" },
  { value: "other", label: "Ostalo" },
] satisfies {
  value: StaffGender;
  label: string;
}[];

type StaffDetailsProfilePanelProps = {
  profile: StaffDetailsProfile;
  values: StaffDetailsFormValues;
  roles: string[];
  hasChanges: boolean;
  onChange: <K extends keyof StaffDetailsFormValues>(field: K, value: StaffDetailsFormValues[K]) => void;
  onSave: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
};

function getInitials(fullName: string) {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "OT"
  );
}


function getSafeNumber(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getRoleIcon(role: string) {
  if (role.toLowerCase().includes("menad")) return "♛";
  if (role.toLowerCase().includes("šank")) return "◈";
  if (role.toLowerCase().includes("konobar")) return "◎";
  return "◇";
}

function getYearsSince(dateValue: string) {
  const hireDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(hireDate.getTime())) {
    return "—";
  }

  const diff = Date.now() - hireDate.getTime();
  const years = Math.max(Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)), 0);

  if (years === 0) return "< 1 god.";
  if (years === 1) return "1 god.";
  return `${years} god.`;
}

export function StaffDetailsProfilePanel({
  profile,
  values,
  roles,
  hasChanges,
  onChange,
  onSave,
  onToggleStatus,
  onDelete,
}: StaffDetailsProfilePanelProps) {
  const statusLabel = values.status === "active" ? "Aktivan nalog" : "Neaktivan nalog";
  const safeRating = getSafeNumber(profile.rating);
  const toggleStatusLabel = values.status === "active" ? "Deaktiviraj" : "Aktiviraj";
  const roleOptions = roles.map((role) => ({
    label: role,
    value: role,
    icon: getRoleIcon(role),
  }));

  return (
    <aside className="staff-details-profile-card">
      <div className="staff-details-profile-scroll custom-scrollbar">
        <div className="staff-details-avatar-block">
          <div className="staff-details-avatar-ring">
            <div className="staff-details-avatar-xl">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={values.fullName} /> : getInitials(values.fullName)}
            </div>
          </div>

          <h2>{values.fullName || "Novi radnik"}</h2>

          <div className="staff-details-profile-meta">
            <span>@{values.username || "username"}</span>
            <span>·</span>
            <span>{values.role}</span>
          </div>

          <GlassBadge tone={values.status === "active" ? "success" : "muted"} dot className={`staff-details-status ${values.status === "inactive" ? "inactive" : ""}`}>
            {statusLabel}
          </GlassBadge>
        </div>

        <div className="staff-details-profile-stats">
          <div>
            <span>Ocena</span>
            <strong>{safeRating.toFixed(1)}</strong>
          </div>
          <div>
            <span>Staž</span>
            <strong>{getYearsSince(values.hireDate)}</strong>
          </div>
          <div>
            <span>Smena</span>
            <strong>{values.shiftType.split(" ")[0]}</strong>
          </div>
        </div>

        <div className="divider-elegant staff-details-profile-divider" />

        <div className="staff-details-form-grid">
          <ModalTextField label="Ime i prezime" value={values.fullName} onChange={(fullName) => onChange("fullName", fullName)} />

          <ModalTextField label="Korisničko ime" value={values.username} onChange={(username) => onChange("username", username)} />

          <ModalTextField label="Email" type="email" value={values.email} onChange={(email) => onChange("email", email)} />

          <ModalTextField label="Telefon" value={values.phone} onChange={(phone) => onChange("phone", phone)} />

          <div className="modal-field staff-details-role-field">
            <label>Uloga</label>
            <GlassDropdown
              value={values.role}
              options={roleOptions}
              onChange={(role) => onChange("role", role)}
              placeholder="Izaberi ulogu"
              triggerClassName="modal-dropdown staff-details-role-trigger"
            />
          </div>

          <ModalTextField label="Plata" value={values.salary} inputMode="numeric" onChange={(salary) => onChange("salary", salary)} />

          <GlassDatePicker label="Datum zaposlenja" value={values.hireDate} onChange={(hireDate) => onChange("hireDate", hireDate)} />

          <GlassDatePicker label="Datum rođenja" value={values.birthday} onChange={(birthday) => onChange("birthday", birthday)} />

          <div className="modal-field staff-details-gender-field">
            <label>Pol</label>
            <SegmentedSlider
              value={values.gender}
              options={genderOptions}
              onChange={(gender) => onChange("gender", gender)}
              className="staff-details-gender-slider"
            />
          </div>

          <ModalTextField label="Tip smene" value={values.shiftType} onChange={(shiftType) => onChange("shiftType", shiftType)} />

          <ModalTextField
            label="Interna beleška"
            multiline
            rows={4}
            className="staff-details-note-field"
            value={values.note}
            onChange={(note) => onChange("note", note)}
          />
        </div>
      </div>

      <div className="staff-details-profile-footer">
        <GlassButton
          variant="default"
          className={`staff-details-status-toggle ${values.status === "active" ? "deactivate" : "activate"}`}
          onClick={onToggleStatus}
        >
          {toggleStatusLabel}
        </GlassButton>

        <div className="divider-elegant staff-details-footer-divider" />

        <div className="staff-details-footer-row">
          <GlassButton variant="primary" className={!hasChanges ? "disabled-soft" : ""} disabled={!hasChanges} onClick={onSave}>
            Sačuvaj
          </GlassButton>

          <GlassButton variant="danger" onClick={onDelete}>
            Obriši
          </GlassButton>
        </div>
      </div>
    </aside>
  );
}
