type PreviewDividerProps = {
  label?: string;
  className?: string;
};

export function PreviewDivider({ label = "Pregled", className = "" }: PreviewDividerProps) {
  return (
    <div className={`preview-divider ${className}`.trim()}>
      <div className="preview-divider-line" />
      <span className="preview-divider-label">{label}</span>
      <div className="preview-divider-line right" />
    </div>
  );
}
