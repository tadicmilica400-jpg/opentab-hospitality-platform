import { useEffect, useMemo, useRef, useState } from 'react';
import { getMobileMenuCatalog } from '../api/mobileMenu';
import FilterIcon from '../components/icons/FilterIcon';
import SearchIcon from '../components/icons/SearchIcon';
import CategoryPills from '../components/menu/CategoryPills';
import MenuItemCard from '../components/menu/MenuItemCard';
import { useModal } from '../context/ModalContext';
import type { Category, MenuItem } from '../types';

const allCategory: Category = { key: 'sve', label: 'Sve', emoji: '✦' };

export default function MenuScreen() {
  const { openItem } = useModal();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([allCategory]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('sve');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setError(null);

    getMobileMenuCatalog()
      .then((catalog) => {
        if (!mounted) return;
        setItems(catalog.items);
        setCategories([allCategory, ...catalog.categories]);
      })
      .catch((caughtError: unknown) => {
        if (!mounted) return;
        const message = caughtError instanceof Error ? caughtError.message : 'Meni trenutno nije dostupan.';
        setError(message);
        setItems([]);
        setCategories([allCategory]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const query = search.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (query) {
        const searchableText = `${item.name} ${item.desc} ${item.composition ?? ''}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      return activeCategory === 'sve' || item.cat === activeCategory;
    });
  }, [activeCategory, items, query]);

  const groupedItems = useMemo(() => {
    return categories
      .filter((category) => category.key !== 'sve')
      .map((category) => ({
        category,
        items: filteredItems.filter((item) => item.cat === category.key),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, filteredItems]);

  const handleCategorySelect = (key: string) => {
    setActiveCategory(key);

    if (key === 'sve') {
      const root = document.querySelector('.menu-screen');
      root?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.setTimeout(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  return (
    <div className="screen menu-screen">
      <div className="search-wrap">
        <span className="search-icon"><SearchIcon /></span>
        <input className="search-input" type="text" placeholder="Pretraži meni" value={search} onChange={(event) => setSearch(event.target.value)} />
        <span className="search-filter"><FilterIcon /></span>
      </div>

      <CategoryPills categories={categories} active={activeCategory} onSelect={handleCategorySelect} />

      {isLoading && <div className="empty-state compact"><div className="empty-title">Učitavam meni</div><p>Vučem stavke iz baze, jer više ne glumimo restoran sa mock podacima.</p></div>}

      {!isLoading && error && <div className="empty-state compact"><div className="empty-title">Meni nije učitan</div><p>{error}</p></div>}

      {!isLoading && !error && (
        <div className="menu-category-groups">
          {groupedItems.map(({ category, items: groupItems }) => (
            <section className="menu-category-section" key={category.key} ref={(node) => { sectionRefs.current[category.key] = node; }}>
              <div className="menu-category-title-row">
                <h2>{category.label}</h2>
                <span>{groupItems.length} stavki</span>
              </div>
              <div className="product-list">
                {groupItems.map((item) => <MenuItemCard key={item.id} item={item} onOpen={openItem} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {!isLoading && !error && groupedItems.length === 0 && <div className="empty-state compact"><div className="empty-title">Nema rezultata</div><p>Promenite pretragu ili kategoriju.</p></div>}
    </div>
  );
}
