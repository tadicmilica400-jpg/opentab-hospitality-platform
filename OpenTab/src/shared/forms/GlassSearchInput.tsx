type GlassSearchInputProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
  icon?: string;
};

export function GlassSearchInput({
  value,
  placeholder,
  onChange,
  className = "",
  icon = "◉",
}: GlassSearchInputProps) {
  return (
    <div className={`search-input-glass ${className}`.trim()}>
      <span className="search-icon">{icon}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}