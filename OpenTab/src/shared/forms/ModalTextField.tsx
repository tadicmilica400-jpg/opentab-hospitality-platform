import type { ChangeEventHandler, HTMLInputTypeAttribute, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type BaseProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
  controlClassName?: string;
};

type InputProps = BaseProps & {
  multiline?: false;
  type?: HTMLInputTypeAttribute;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
};

type TextareaProps = BaseProps & {
  multiline: true;
  rows?: number;
  autoComplete?: TextareaHTMLAttributes<HTMLTextAreaElement>["autoComplete"];
};

type ModalTextFieldProps = InputProps | TextareaProps;

function FieldShell({
  label,
  required,
  error,
  hint,
  className,
  children,
}: Pick<BaseProps, "label" | "required" | "error" | "hint" | "className"> & {
  children: React.ReactNode;
}) {
  return (
    <div className={`modal-field ${className ?? ""}`.trim()}>
      <label>
        {label} {required ? <span className="required-mark">*</span> : null}
      </label>

      {children}

      {error ? <div className="field-error-msg visible">{error}</div> : null}
      {hint ? <p className="table-form-hint">{hint}</p> : null}
    </div>
  );
}

export function ModalTextField(props: ModalTextFieldProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (event) => {
    props.onChange(event.target.value);
  };

  const controlClass = `${props.multiline ? "modal-textarea" : "modal-input"} ${props.error ? "error" : ""} ${props.controlClassName ?? ""}`.trim();

  if (props.multiline) {
    return (
      <FieldShell label={props.label} required={props.required} error={props.error} hint={props.hint} className={props.className}>
        <textarea
          className={controlClass}
          value={props.value}
          placeholder={props.placeholder}
          rows={props.rows}
          autoComplete={props.autoComplete}
          onChange={handleChange}
        />
      </FieldShell>
    );
  }

  const inputProps = props as InputProps;

  return (
    <FieldShell label={inputProps.label} required={inputProps.required} error={inputProps.error} hint={inputProps.hint} className={inputProps.className}>
      <input
        type={inputProps.type ?? "text"}
        inputMode={inputProps.inputMode}
        className={controlClass}
        value={inputProps.value}
        placeholder={inputProps.placeholder}
        autoComplete={inputProps.autoComplete}
        onChange={handleChange}
      />
    </FieldShell>
  );
}
