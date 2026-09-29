type EmojiPickerProps = {
  value: string;
  onChange: (value: string) => void;
  emojis: string[];
  label?: string;
  hint?: string;
  placeholder?: string;
};

export function EmojiPicker({
  value,
  onChange,
  emojis,
  label = "Ikonica",
  hint = "Unesi emoji ili izaberi ispod",
  placeholder = "◎",
}: EmojiPickerProps) {
  return (
    <div className="emoji-picker">
      <div className="modal-field emoji-picker-field">
        <label>{label}</label>

        <div className="emoji-input-wrap">
          <input
            type="text"
            className="emoji-input"
            value={value}
            placeholder={placeholder}
            maxLength={4}
            onChange={(event) => onChange(event.target.value)}
          />
          <span>{hint}</span>
        </div>
      </div>

      <div className="emoji-keyboard">
        {emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            className={`emoji-option ${value === emoji ? "active" : ""}`}
            onClick={() => onChange(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}