import { useRef } from "react";

type ImageUploadFieldProps = {
  imageUrl: string;
  alt: string;
  fallback: string;
  accept?: string;
  error?: string;
  buttonLabel?: string;
  onFileSelected: (file: File) => void;
};

export function ImageUploadField({
  imageUrl,
  alt,
  fallback,
  accept = "image/jpeg,image/png,image/webp",
  error,
  buttonLabel = "Upload",
  onFileSelected,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="avatar-upload-area">
      <div className="avatar-preview">
        {imageUrl ? <img src={imageUrl} alt={alt} /> : <span>{fallback}</span>}
      </div>

      <button type="button" className="btn-upload" onClick={() => fileInputRef.current?.click()}>
        {buttonLabel}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onFileSelected(file);
          }

          event.currentTarget.value = "";
        }}
      />

      {error ? <div className="field-error-msg visible">{error}</div> : null}
    </div>
  );
}
