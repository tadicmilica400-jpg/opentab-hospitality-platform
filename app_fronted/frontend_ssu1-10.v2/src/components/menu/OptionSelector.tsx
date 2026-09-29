import type { MenuOption } from '../../types';

interface OptionSelectorProps {
  options: MenuOption[];
  selected: MenuOption[];
  onChange: (selected: MenuOption[]) => void;
}

function getGroupName(option: MenuOption): string {
  return option.group?.trim() || 'Ostalo';
}

function isSingleChoiceGroup(groupOptions: MenuOption[]): boolean {
  const maxChoices = groupOptions[0]?.maxChoices;
  return maxChoices === 1;
}

function getGroupLimitText(groupOptions: MenuOption[]): string {
  const required = Boolean(groupOptions[0]?.required);
  const minChoices = groupOptions[0]?.minChoices ?? 0;
  const maxChoices = groupOptions[0]?.maxChoices ?? null;

  if (maxChoices === 1) {
    return required || minChoices > 0 ? 'Obavezno · izaberite jednu opciju' : 'Izaberite najviše jednu opciju';
  }

  if (maxChoices && maxChoices > 1) {
    return required || minChoices > 0 ? `Obavezno · do ${maxChoices} opcije` : `Možete izabrati do ${maxChoices}`;
  }

  return required || minChoices > 0 ? 'Obavezno' : 'Možete izabrati više';
}

export default function OptionSelector({ options, selected, onChange }: OptionSelectorProps) {
  if (options.length === 0) return <div className="muted-line">Nema dostupnih opcija.</div>;

  const groups = options.reduce<Record<string, MenuOption[]>>((acc, option) => {
    const group = getGroupName(option);
    acc[group] = acc[group] ? [...acc[group], option] : [option];
    return acc;
  }, {});

  const isSelected = (option: MenuOption) => selected.some((selectedOption) => selectedOption.id === option.id);

  const selectOption = (option: MenuOption, groupOptions: MenuOption[]) => {
    const group = getGroupName(option);
    const singleChoice = isSingleChoiceGroup(groupOptions);
    const alreadySelected = isSelected(option);
    const required = Boolean(groupOptions[0]?.required) || (groupOptions[0]?.minChoices ?? 0) > 0;
    const maxChoices = groupOptions[0]?.maxChoices ?? null;
    const selectedInGroup = selected.filter((selectedOption) => getGroupName(selectedOption) === group);

    if (singleChoice) {
      if (alreadySelected && !required) {
        onChange(selected.filter((selectedOption) => selectedOption.id !== option.id));
        return;
      }

      onChange([...selected.filter((selectedOption) => getGroupName(selectedOption) !== group), option]);
      return;
    }

    if (alreadySelected) {
      onChange(selected.filter((selectedOption) => selectedOption.id !== option.id));
      return;
    }

    if (maxChoices && maxChoices > 0 && selectedInGroup.length >= maxChoices) {
      return;
    }

    onChange([...selected, option]);
  };

  return (
    <div className="option-groups">
      {Object.entries(groups).map(([group, groupOptions]) => {
        const singleChoice = isSingleChoiceGroup(groupOptions);
        return (
          <section className="option-group" key={group}>
            <div className="option-group-title">
              <span>{group}</span>
              <small>{getGroupLimitText(groupOptions)}</small>
            </div>
            <div className={singleChoice ? 'option-radio-list' : 'option-checkbox-grid'}>
              {groupOptions.map((option) => {
                const selectedOption = isSelected(option);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`option-choice${selectedOption ? ' selected' : ''}${singleChoice ? ' radio' : ' checkbox'}`}
                    onClick={() => selectOption(option, groupOptions)}
                  >
                    <span className="option-control" aria-hidden="true"><span /></span>
                    <span className="option-text">
                      <strong>{option.label}</strong>
                      <small>{option.priceDelta ? `+${option.priceDelta} RSD` : 'Uključeno'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
