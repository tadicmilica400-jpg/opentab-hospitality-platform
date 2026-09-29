// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useState } from "react";
import type {
  TableFormValues,
  TableShape,
  VenueSector,
  VenueTable,
} from "../../../../entities/venue-map/venueMap.types";
import { AppModal } from "../../../../shared/modals/AppModal";
import { ModalActions } from "../../../../shared/modals/ModalActions";
import { GlassDropdown } from "../../../../shared/forms/GlassDropdown";
import { GlassNumberInput } from "../../../../shared/forms/GlassNumberInput";
import { ModalTextField } from "../../../../shared/forms/ModalTextField";
import { PreviewDivider } from "../../../../shared/ui/PreviewDivider";
import { ShapeSelector } from "../../../../shared/forms/ShapeSelector";
import { GlassButton } from "../../../../shared/ui/GlassButton";
import type { ActionResult } from "../../../../shared/types/action.types";
import { TableVisual } from "./TableVisual";

type TableFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  table: VenueTable | null;
  sectors: VenueSector[];
  onClose: () => void;
  onSubmit: (values: TableFormValues) => ActionResult | Promise<ActionResult>;
  onRequestDelete: (table: VenueTable) => void;
  onDownloadQr: (table: VenueTable) => void;
};

type TableFormErrors = Partial<Record<keyof TableFormValues, string>> & {
  general?: string;
};

const shapeOptions = [
  {
    label: "Okrugli",
    value: "round",
    preview: <span className="shape-preview shape-preview-round" />,
  },
  {
    label: "Četvrtasti",
    value: "square",
    preview: <span className="shape-preview shape-preview-square" />,
  },
  {
    label: "Duguljasti",
    value: "rectangle",
    preview: <span className="shape-preview shape-preview-rectangle" />,
  },
] satisfies {
  label: string;
  value: TableShape;
  preview: React.ReactNode;
}[];

function getInitialValues(table: VenueTable | null, sectors: VenueSector[]): TableFormValues {
  if (table) {
    return {
      sectorId: table.sectorId,
      number: table.number,
      seats: table.seats,
      shape: table.shape,
    };
  }

  return {
    sectorId: sectors[0]?.id ?? "",
    number: "",
    seats: 4,
    shape: "round",
  };
}

export function TableFormModal({
  open,
  mode,
  table,
  sectors,
  onClose,
  onSubmit,
  onRequestDelete,
  onDownloadQr,
}: TableFormModalProps) {
  const [values, setValues] = useState<TableFormValues>(() => getInitialValues(table, sectors));
  const [errors, setErrors] = useState<TableFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(getInitialValues(table, sectors));
    setErrors({});
    setIsSubmitting(false);
  }, [open, table, sectors]);

  const setField = <K extends keyof TableFormValues>(field: K, value: TableFormValues[K]) => {
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
    const nextErrors: TableFormErrors = {};

    if (!values.sectorId) {
      nextErrors.sectorId = "Sektor je obavezno polje.";
    }

    if (!values.number.trim()) {
      nextErrors.number = "Broj stola je obavezno polje.";
    }

    if (!Number.isFinite(values.seats) || values.seats < 1 || values.seats > 12) {
      nextErrors.seats = "Broj mesta mora biti između 1 i 12.";
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

  const title = mode === "create" ? "Dodaj novi sto" : "Izmeni sto";
  const subtitle =
    mode === "create"
      ? "Konfigurišite oblik, kapacitet i broj stola"
      : "Pregled i izmena informacija o stolu";

  return (
    <AppModal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      containerClassName="table-form-container"
      footer={
        <ModalActions
          confirmLabel={isSubmitting ? "Čuvanje..." : mode === "create" ? "Dodaj sto" : "Sačuvaj izmene"}
          onCancel={onClose}
          onConfirm={submit}
        />
      }
    >
      <div className="modal-field">
        <label>
          Sektor <span className="required-mark">*</span>
        </label>

        <GlassDropdown
          value={values.sectorId}
          options={sectors.map((sector) => ({
            label: sector.name,
            value: sector.id,
            icon: sector.emoji,
          }))}
          onChange={(sectorId) => setField("sectorId", sectorId)}
        />

        {errors.sectorId ? <div className="field-error-msg visible">{errors.sectorId}</div> : null}
      </div>

      <ModalTextField
        label="Broj stola"
        required
        value={values.number}
        error={errors.number}
        placeholder="npr. 14"
        hint="Mora biti jedinstven unutar sektora"
        onChange={(number) => setField("number", number)}
      />

      <div className="modal-field">
        <label>
          Oblik <span className="required-mark">*</span>
        </label>

        <ShapeSelector
          value={values.shape}
          options={shapeOptions}
          onChange={(shape) => setField("shape", shape)}
        />
      </div>

      <div className="modal-field">
        <label>
          Broj mesta <span className="required-mark">*</span>
        </label>

        <GlassNumberInput
          value={values.seats}
          min={1}
          max={12}
          step={1}
          ariaLabel="Broj mesta"
          className="table-seats-input"
          onChange={(seats) => setField("seats", seats)}
        />

        {errors.seats ? <div className="field-error-msg visible">{errors.seats}</div> : null}

        <p className="table-form-hint">Min 1, max 12 mesta</p>
      </div>

      {errors.general ? <div className="staff-form-error">{errors.general}</div> : null}

      <PreviewDivider />

      <div className="table-preview-container">
        <div className="modal-preview-wrapper">
          <TableVisual
            number={values.number}
            shape={values.shape}
            seats={values.seats}
            preview
            activeOrder={table?.hasActiveOrder}
          />
        </div>
      </div>

      {mode === "edit" && table ? (
        <div className="table-qr-card">
          <div className="table-qr-preview-box" aria-label={`QR kod za sto ${table.number}`}>
            <span className="table-qr-corner top-left" />
            <span className="table-qr-corner top-right" />
            <span className="table-qr-corner bottom-left" />
            <span className="table-qr-noise" />
            <strong>{table.number}</strong>
          </div>

          <div className="table-qr-copy">
            <span className="table-qr-label">QR kod</span>
            <strong>Sto {table.number}</strong>
            <p>{table.qrCodeUrl}</p>
          </div>

          <GlassButton className="table-qr-button" onClick={() => onDownloadQr(table)}>
            Preuzmi QR
          </GlassButton>
        </div>
      ) : null}

      {mode === "edit" && table ? (
        <div className="table-delete-zone">
          <GlassButton variant="danger" className="table-delete-button" onClick={() => onRequestDelete(table)}>
            Obriši sto
          </GlassButton>
        </div>
      ) : null}
    </AppModal>
  );
}