import type { Category } from '../../types';

interface CategoryPillsProps {
  categories: Category[];
  active: string;
  onSelect: (key: string) => void;
}

const icons: Record<string, string> = {
  sve: '✦',
  kafa: '☕',
  sokovi: '🥤',
  hrana: '🍽️',
  deserti: '🍰',
  kokteli: '🍸',
};

export default function CategoryPills({ categories, active, onSelect }: CategoryPillsProps) {
  return (
    <div className="categories" aria-label="Kategorije menija">
      {categories.map((category) => (
        <button key={category.key} type="button" className={`category-pill${active === category.key ? ' active' : ''}`} onClick={() => onSelect(category.key)}>
          <span className="cat-icon" aria-hidden="true">{category.emoji ?? category.icon ?? icons[category.key] ?? '•'}</span>
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}
