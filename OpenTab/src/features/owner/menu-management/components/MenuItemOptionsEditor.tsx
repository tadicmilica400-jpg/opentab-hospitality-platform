// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { MenuOption, MenuOptionGroup } from "../../../../entities/menu/menu.types";

type MenuItemOptionsEditorProps = {
  groups: MenuOptionGroup[];
  onAddGroup: () => void;
  onRemoveGroup: (groupId: string) => void;
  onUpdateGroupName: (groupId: string, name: string) => void;
  onAddOption: (groupId: string) => void;
  onRemoveOption: (groupId: string, optionId: string) => void;
  onUpdateOption: <K extends keyof MenuOption>(groupId: string, optionId: string, field: K, value: MenuOption[K]) => void;
};

type OptionPriceInputProps = {
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
};

function normalizeNumber(value: string, fallback: number) {
  const normalizedValue = value.replace(",", ".").trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function OptionPriceInput({ value, min = 0, step = 10, onChange }: OptionPriceInputProps) {
  const decrease = () => onChange(Math.max(min, Number(value || 0) - step));
  const increase = () => onChange(Number(value || 0) + step);

  return (
    <div className="option-price-number-input">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(Math.max(min, normalizeNumber(event.target.value, value)))}
      />

      <div className="option-number-controls">
        <button type="button" className="option-num-btn" onClick={increase}>
          ˄
        </button>

        <button type="button" className="option-num-btn" onClick={decrease}>
          ˅
        </button>
      </div>
    </div>
  );
}

export function MenuItemOptionsEditor({
  groups,
  onAddGroup,
  onRemoveGroup,
  onUpdateGroupName,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
}: MenuItemOptionsEditorProps) {
  return (
    <div className="options-section">
      <div className="options-title">⚙️ Opcije i doplate</div>

      <div className="options-container">
        {groups.map((group) => (
          <div className="option-group-card" key={group.id}>
            <div className="option-group-header">
              <input
                type="text"
                className="option-group-name-input"
                value={group.name}
                placeholder="Naziv grupe, npr. Veličina"
                onChange={(event) => onUpdateGroupName(group.id, event.target.value)}
              />

              <button type="button" className="option-remove-btn" onClick={() => onRemoveGroup(group.id)}>
                ×
              </button>
            </div>

            <div className="option-items-list">
              {group.options.map((option) => (
                <div className="option-item" key={option.id}>
                  <input
                    type="text"
                    className="option-name-input"
                    value={option.name}
                    placeholder="Naziv opcije"
                    onChange={(event) => onUpdateOption(group.id, option.id, "name", event.target.value)}
                  />

                  <div className="option-price-group">
                    <OptionPriceInput
                      value={option.priceDelta}
                      min={0}
                      step={10}
                      onChange={(value) => onUpdateOption(group.id, option.id, "priceDelta", value)}
                    />
                    <span>RSD</span>
                  </div>

                  <button type="button" className="option-item-delete" onClick={() => onRemoveOption(group.id, option.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="add-option-btn" onClick={() => onAddOption(group.id)}>
              + Dodaj opciju
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="add-group-btn" onClick={onAddGroup}>
        + Dodaj grupu opcija
      </button>
    </div>
  );
}
