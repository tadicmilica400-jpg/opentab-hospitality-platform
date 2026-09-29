// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useMemo, useState } from "react";
import type {
  MenuCategory,
  MenuItem,
  MenuItemFormErrors,
  MenuItemFormValues,
  MenuOption,
  MenuOptionGroup,
} from "../../../../entities/menu/menu.types";
import type { ActionResult } from "../../../../shared/types/action.types";
import { ImageUploadField } from "../../../../shared/forms/ImageUploadField";
import { GlassDropdown } from "../../../../shared/forms/GlassDropdown";
import { GlassNumberInput } from "../../../../shared/forms/GlassNumberInput";
import { ModalTextField } from "../../../../shared/forms/ModalTextField";
import { AppModal } from "../../../../shared/modals/AppModal";
import { ModalActions } from "../../../../shared/modals/ModalActions";
import { PreviewDivider } from "../../../../shared/ui/PreviewDivider";
import { MenuItemOptionsEditor } from "./MenuItemOptionsEditor";
import { MenuItemPreviewCard } from "./MenuItemPreviewCard";

type MenuItemFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  item: MenuItem | null;
  categories: MenuCategory[];
  initialCategoryId?: string;
  onClose: () => void;
  onSubmit: (values: MenuItemFormValues) => ActionResult | Promise<ActionResult>;
};

const maxImageSize = 3 * 1024 * 1024;
const maxStoredImageLength = 60000;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const compressedImageType = "image/jpeg";

function createLocalId(prefix: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${value}`;
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isImageDataUrl(value: string) {
  return /^data:image\/(jpeg|png|webp);base64,/.test(value);
}

function getInitialCategoryId(categories: MenuCategory[], initialCategoryId?: string) {
  if (initialCategoryId && categories.some((category) => category.id === initialCategoryId)) {
    return initialCategoryId;
  }

  return categories[0]?.id ?? "";
}

function createEmptyValues(categories: MenuCategory[], initialCategoryId?: string): MenuItemFormValues {
  return {
    name: "",
    description: "",
    composition: "",
    price: 200,
    categoryId: getInitialCategoryId(categories, initialCategoryId),
    imageUrl: "",
    optionGroups: [],
  };
}

function createValuesFromItem(item: MenuItem): MenuItemFormValues {
  return {
    name: item.name,
    description: item.description,
    composition: item.composition,
    price: item.price,
    categoryId: item.categoryId,
    imageUrl: item.imageUrl,
    optionGroups: item.optionGroups.map((group) => ({
      ...group,
      options: group.options.map((option) => ({ ...option })),
    })),
  };
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const imageUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Slika ne može da se učita."));
    };

    image.src = imageUrl;
  });
}

function calculateCanvasSize(image: HTMLImageElement, maxDimension: number) {
  const ratio = Math.min(maxDimension / image.width, maxDimension / image.height, 1);

  return {
    width: Math.max(1, Math.round(image.width * ratio)),
    height: Math.max(1, Math.round(image.height * ratio)),
  };
}

async function compressImageFile(file: File) {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Browser ne podržava kompresiju slike.");
  }

  const qualities = [0.72, 0.62, 0.52, 0.42, 0.32];
  const dimensions = [900, 720, 560, 420, 320, 240];
  let bestResult = "";

  for (const maxDimension of dimensions) {
    const size = calculateCanvasSize(image, maxDimension);
    canvas.width = size.width;
    canvas.height = size.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of qualities) {
      const result = canvas.toDataURL(compressedImageType, quality);

      if (!bestResult || result.length < bestResult.length) {
        bestResult = result;
      }

      if (result.length <= maxStoredImageLength) {
        return result;
      }
    }
  }

  throw new Error("Slika je prevelika i nakon kompresije. Izaberi manju sliku.");
}

async function readImageFile(file: File, onSuccess: (value: string) => void, onError: (message: string) => void) {
  if (!allowedImageTypes.includes(file.type)) {
    onError("Dozvoljeni formati su JPEG, PNG i WEBP.");
    return;
  }

  if (file.size > maxImageSize) {
    onError("Slika ne sme biti veća od 3MB.");
    return;
  }

  try {
    onSuccess(await compressImageFile(file));
  } catch (error) {
    onError(error instanceof Error ? error.message : "Slika ne može da se kompresuje.");
  }
}

export function MenuItemFormModal({
  open,
  mode,
  item,
  categories,
  initialCategoryId,
  onClose,
  onSubmit,
}: MenuItemFormModalProps) {
  const [values, setValues] = useState<MenuItemFormValues>(() =>
    item ? createValuesFromItem(item) : createEmptyValues(categories, initialCategoryId),
  );
  const [errors, setErrors] = useState<MenuItemFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === values.categoryId),
    [categories, values.categoryId],
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        label: category.name,
        value: category.id,
        icon: category.emoji,
      })),
    [categories],
  );

  const previewName = values.name.trim() || "Nova stavka";
  const previewDescription = values.description.trim();
  const previewImage = values.imageUrl.trim();
  const previewIcon = mode === "create" ? "🍽" : "☕";

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(item ? createValuesFromItem(item) : createEmptyValues(categories, initialCategoryId));
    setErrors({});
    setFormError("");
    setIsSubmitting(false);
  }, [open, item, categories, initialCategoryId]);

  const setField = <K extends keyof MenuItemFormValues>(field: K, value: MenuItemFormValues[K]) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
    setFormError("");
  };

  const validate = () => {
    const nextErrors: MenuItemFormErrors = {};
    const imageUrl = values.imageUrl.trim();

    if (!values.name.trim()) {
      nextErrors.name = "Naziv stavke je obavezno polje.";
    }

    if (!values.categoryId.trim()) {
      nextErrors.categoryId = "Kategorija je obavezno polje.";
    }

    if (!Number.isFinite(values.price) || values.price <= 0) {
      nextErrors.price = "Cena mora biti veća od 0.";
    }

    if (imageUrl.length > 0 && !isHttpsUrl(imageUrl) && !isImageDataUrl(imageUrl)) {
      nextErrors.imageUrl = "Slika mora biti validan HTTPS URL ili uploadovana slika.";
    }

    if (isImageDataUrl(imageUrl) && imageUrl.length > maxStoredImageLength) {
      nextErrors.imageUrl = "Slika je prevelika za čuvanje. Izaberi manju sliku.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    const result = await onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      composition: values.composition.trim(),
      imageUrl: values.imageUrl.trim(),
      price: Number(values.price),
      optionGroups: values.optionGroups
        .map((group) => ({
          ...group,
          name: group.name.trim(),
          options: group.options
            .map((option) => ({
              ...option,
              name: option.name.trim(),
              priceDelta: Number(option.priceDelta),
            }))
            .filter((option) => option.name.length > 0),
        }))
        .filter((group) => group.name.length > 0),
    });

    setIsSubmitting(false);

    if (result.ok === false) {
      setFormError(result.message);
    }
  };

  const handleFileSelected = (file: File) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      imageUrl: undefined,
    }));
    setFormError("");

    void readImageFile(
      file,
      (imageUrl) => setField("imageUrl", imageUrl),
      (message) =>
        setErrors((currentErrors) => ({
          ...currentErrors,
          imageUrl: message,
        })),
    );
  };

  const addOptionGroup = () => {
    const group: MenuOptionGroup = {
      id: createLocalId("option-group"),
      name: "",
      options: [
        {
          id: createLocalId("option"),
          name: "",
          priceDelta: 0,
        },
      ],
    };

    setField("optionGroups", [...values.optionGroups, group]);
  };

  const removeOptionGroup = (groupId: string) => {
    setField(
      "optionGroups",
      values.optionGroups.filter((group) => group.id !== groupId),
    );
  };

  const updateOptionGroupName = (groupId: string, name: string) => {
    setField(
      "optionGroups",
      values.optionGroups.map((group) => (group.id === groupId ? { ...group, name } : group)),
    );
  };

  const addOption = (groupId: string) => {
    const option: MenuOption = {
      id: createLocalId("option"),
      name: "",
      priceDelta: 0,
    };

    setField(
      "optionGroups",
      values.optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: [...group.options, option],
            }
          : group,
      ),
    );
  };

  const removeOption = (groupId: string, optionId: string) => {
    setField(
      "optionGroups",
      values.optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.filter((option) => option.id !== optionId),
            }
          : group,
      ),
    );
  };

  const updateOption = <K extends keyof MenuOption>(
    groupId: string,
    optionId: string,
    field: K,
    value: MenuOption[K],
  ) => {
    setField(
      "optionGroups",
      values.optionGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId
                  ? {
                      ...option,
                      [field]: value,
                    }
                  : option,
              ),
            }
          : group,
      ),
    );
  };

  return (
    <AppModal
      open={open}
      title={mode === "create" ? "Dodaj novu stavku" : "Izmeni stavku"}
      subtitle={mode === "create" ? "Unesite informacije o novoj stavci menija" : "Pregled i izmena informacija o stavci menija"}
      onClose={onClose}
      footer={
        <ModalActions
          confirmLabel={isSubmitting ? "Čuvanje..." : mode === "create" ? "Dodaj stavku" : "Sačuvaj izmene"}
          onCancel={onClose}
          onConfirm={() => void submit()}
        />
      }
    >
      {formError ? <div className="field-error-msg visible">{formError}</div> : null}

      <ImageUploadField
        imageUrl={previewImage}
        alt={previewName}
        fallback={previewIcon}
        error={errors.imageUrl}
        onFileSelected={handleFileSelected}
      />

      <ModalTextField
        label="Naziv stavke"
        required
        value={values.name}
        error={errors.name}
        placeholder="npr. Espresso"
        onChange={(name) => setField("name", name)}
      />

      <ModalTextField
        label="Opis (opciono)"
        multiline
        rows={2}
        value={values.description}
        placeholder="Kratak opis stavke..."
        onChange={(description) => setField("description", description)}
      />

      <div className="modal-field">
        <label>
          Kategorija <span className="required-mark">*</span>
        </label>

        <GlassDropdown
          value={values.categoryId}
          options={categoryOptions}
          onChange={(categoryId) => setField("categoryId", categoryId)}
          className="modal-kat-dropdown"
          placeholder="Izaberi kategoriju"
        />

        {errors.categoryId ? <div className="field-error-msg visible">{errors.categoryId}</div> : null}
      </div>

      <ModalTextField
        label="Sastav proizvoda (opciono)"
        multiline
        rows={2}
        value={values.composition}
        placeholder="npr. Arabica kafa, voda..."
        onChange={(composition) => setField("composition", composition)}
      />

      <div className="modal-inner-divider">
        <div className="divider-elegant" />
      </div>

      <MenuItemOptionsEditor
        groups={values.optionGroups}
        onAddGroup={addOptionGroup}
        onRemoveGroup={removeOptionGroup}
        onUpdateGroupName={updateOptionGroupName}
        onAddOption={addOption}
        onRemoveOption={removeOption}
        onUpdateOption={updateOption}
      />

      <div className="modal-inner-divider">
        <div className="divider-elegant" />
      </div>

      <div className="modal-field">
        <label>
          Cena (RSD) <span className="required-mark">*</span>
        </label>

        <GlassNumberInput value={values.price} min={0} step={10} onChange={(price) => setField("price", price)} />
        {errors.price ? <div className="field-error-msg visible">{errors.price}</div> : null}
      </div>

      <PreviewDivider />

      <MenuItemPreviewCard
        imageUrl={previewImage}
        imageAlt={previewName}
        fallbackIcon={previewIcon}
        name={previewName}
        price={values.price}
        categoryName={selectedCategory?.name ?? "Kategorija"}
        description={previewDescription}
      />
    </AppModal>
  );
}
