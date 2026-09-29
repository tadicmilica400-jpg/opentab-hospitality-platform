// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { useEffect, useMemo, useState } from "react";
import type {
  MenuCategory,
  MenuItem,
  MenuItemFormValues,
  MenuItemStatus,
  MenuOptionGroup,
} from "../../../../entities/menu/menu.types";
import type { ActionResult } from "../../../../shared/types/action.types";
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  getMenuCategories,
  getMenuItems,
  updateMenuCategory,
  updateMenuItem,
  type ApiMenuCategory,
  type ApiMenuItem,
  type MenuItemMutationPayload,
} from "../api/menuApi";

export type MenuStatusFilter = "all" | MenuItemStatus;

type CategoryMutationValues = {
  name: string;
  emoji: string;
  itemIds: string[];
};

type MenuData = {
  categories: MenuCategory[];
  items: MenuItem[];
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeMenuItemValues(values: MenuItemFormValues): MenuItemFormValues {
  return {
    name: normalizeText(values.name),
    description: values.description.trim(),
    composition: values.composition.trim(),
    price: Number(values.price),
    categoryId: values.categoryId,
    imageUrl: values.imageUrl.trim(),
    optionGroups: values.optionGroups
      .map((group) => ({
        ...group,
        name: normalizeText(group.name),
        options: group.options
          .map((option) => ({
            ...option,
            name: normalizeText(option.name),
            priceDelta: Number(option.priceDelta),
          }))
          .filter((option) => option.name.length > 0),
      }))
      .filter((group) => group.name.length > 0),
  };
}

function toBoolean(value: boolean | number) {
  return value === true || value === 1;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Došlo je do greške pri komunikaciji sa bazom.";
}

function mapApiCategory(category: ApiMenuCategory): MenuCategory {
  const now = new Date().toISOString();

  return {
    id: String(category.id),
    name: category.name,
    emoji: category.emoji,
    active: toBoolean(category.active),
    createdAt: now,
    updatedAt: now,
  };
}

function mapApiOptionGroups(item: ApiMenuItem): MenuOptionGroup[] {
  return item.option_groups.map((group) => ({
    id: String(group.id),
    name: group.name,
    options: group.options.map((option) => ({
      id: String(option.id),
      name: option.name,
      priceDelta: Number(option.extra_price),
    })),
  }));
}

function mapApiItem(item: ApiMenuItem): MenuItem {
  const now = new Date().toISOString();
  const isActive = toBoolean(item.active) && toBoolean(item.available);

  return {
    id: String(item.id),
    name: item.name,
    description: item.description ?? "",
    composition: item.composition ?? "",
    price: Number(item.price),
    categoryId: String(item.category),
    status: isActive ? "active" : "inactive",
    imageUrl: item.image ?? "",
    optionGroups: mapApiOptionGroups(item),
    createdAt: now,
    updatedAt: now,
  };
}

function toMenuItemPayload(values: MenuItemFormValues, status: MenuItemStatus = "active"): MenuItemMutationPayload {
  const normalizedValues = normalizeMenuItemValues(values);
  const isActive = status === "active";

  return {
    category: normalizedValues.categoryId,
    name: normalizedValues.name,
    description: normalizedValues.description,
    composition: normalizedValues.composition,
    price: normalizedValues.price,
    image: normalizedValues.imageUrl,
    estimated_preparation_minutes: null,
    active: isActive,
    available: isActive,
    option_groups: normalizedValues.optionGroups.map((group) => ({
      name: group.name,
      options: group.options.map((option) => ({
        name: option.name,
        extra_price: option.priceDelta,
      })),
    })),
  };
}

function validateMenuItemValues(values: MenuItemFormValues): string | null {
  const normalizedValues = normalizeMenuItemValues(values);

  if (!normalizedValues.name) {
    return "Naziv stavke je obavezan.";
  }

  if (!normalizedValues.categoryId) {
    return "Kategorija je obavezna.";
  }

  if (!Number.isFinite(normalizedValues.price) || normalizedValues.price <= 0) {
    return "Cena mora biti veća od 0.";
  }

  const hasInvalidOptionPrice = normalizedValues.optionGroups.some((group) =>
    group.options.some((option) => !Number.isFinite(option.priceDelta) || option.priceDelta < 0),
  );

  if (hasInvalidOptionPrice) {
    return "Doplata ne sme biti negativna.";
  }

  return null;
}

async function fetchMenuData(): Promise<MenuData> {
  const [apiCategories, apiItems] = await Promise.all([getMenuCategories(), getMenuItems()]);

  return {
    categories: apiCategories.map(mapApiCategory),
    items: apiItems.map(mapApiItem),
  };
}

export function useMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState<MenuStatusFilter>("all");

  const applyMenuData = (data: MenuData) => {
    setCategories(data.categories);
    setItems(data.items);
  };

  const refreshMenu = async () => {
    applyMenuData(await fetchMenuData());
  };

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchMenuData();

        if (!cancelled) {
          applyMenuData(data);
        }
      } catch {
        if (!cancelled) {
          setError("Nije moguće učitati meni iz baze.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items
      .filter((item) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          item.name.toLowerCase().includes(normalizedSearch) ||
          item.description.toLowerCase().includes(normalizedSearch);

        const matchesCategory = categoryId === "all" || item.categoryId === categoryId;
        const matchesStatus = status === "all" || item.status === status;

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((firstItem, secondItem) => {
        if (firstItem.status !== secondItem.status) {
          return firstItem.status === "active" ? -1 : 1;
        }

        return firstItem.name.localeCompare(secondItem.name, "sr-Latn", {
          sensitivity: "base",
        });
      });
  }, [items, search, categoryId, status]);

  const counters = useMemo(() => {
    const active = items.filter((item) => item.status === "active").length;

    return {
      all: items.length,
      active,
      inactive: items.length - active,
    };
  }, [items]);

  const getCategoryById = (id: string) => categories.find((category) => category.id === id);

  const createItem = async (values: MenuItemFormValues): Promise<ActionResult> => {
    const validationError = validateMenuItemValues(values);

    if (validationError) {
      return {
        ok: false,
        message: validationError,
      };
    }

    try {
      const apiItem = await createMenuItem(toMenuItemPayload(values));
      const item = mapApiItem(apiItem);

      setItems((currentItems) => [item, ...currentItems]);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    }
  };

  const updateItem = async (itemId: string, values: MenuItemFormValues): Promise<ActionResult> => {
    const validationError = validateMenuItemValues(values);

    if (validationError) {
      return {
        ok: false,
        message: validationError,
      };
    }

    const existingItem = items.find((item) => item.id === itemId);

    try {
      const apiItem = await updateMenuItem(
        itemId,
        toMenuItemPayload(values, existingItem?.status ?? "active"),
      );
      const item = mapApiItem(apiItem);

      setItems((currentItems) =>
        currentItems.map((currentItem) => (currentItem.id === itemId ? item : currentItem)),
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    }
  };

  const toggleStatus = async (itemId: string): Promise<ActionResult> => {
    const item = items.find((currentItem) => currentItem.id === itemId);

    if (!item) {
      return {
        ok: false,
        message: "Stavka nije pronađena.",
      };
    }

    const nextStatus: MenuItemStatus = item.status === "active" ? "inactive" : "active";
    const isActive = nextStatus === "active";

    try {
      const apiItem = await updateMenuItem(itemId, {
        active: isActive,
        available: isActive,
      });
      const updatedItem = mapApiItem(apiItem);

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === itemId ? updatedItem : currentItem,
        ),
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    }
  };

  const deleteItem = async (itemId: string): Promise<ActionResult> => {
    try {
      await deleteMenuItem(itemId);
      setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    }
  };

  const createCategory = async (values: CategoryMutationValues): Promise<ActionResult> => {
    const normalizedName = normalizeText(values.name);

    if (normalizedName.length === 0) {
      return {
        ok: false,
        message: "Naziv kategorije je obavezan.",
      };
    }

    const exists = categories.some(
      (category) => category.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (exists) {
      return {
        ok: false,
        message: "Kategorija sa ovim nazivom već postoji.",
      };
    }

    try {
      await createMenuCategory({
        name: normalizedName,
        emoji: values.emoji || "☷",
        item_ids: values.itemIds,
      });

      await refreshMenu();

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    }
  };

  const updateCategory = async (
    categoryIdToUpdate: string,
    values: CategoryMutationValues,
  ): Promise<ActionResult> => {
    const normalizedName = normalizeText(values.name);

    if (normalizedName.length === 0) {
      return {
        ok: false,
        message: "Naziv kategorije je obavezan.",
      };
    }

    const exists = categories.some(
      (category) =>
        category.id !== categoryIdToUpdate &&
        category.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (exists) {
      return {
        ok: false,
        message: "Kategorija sa ovim nazivom već postoji.",
      };
    }

    const categoryExists = categories.some((category) => category.id === categoryIdToUpdate);

    if (!categoryExists) {
      return {
        ok: false,
        message: "Kategorija nije pronađena.",
      };
    }

    const fallbackCategoryId =
      categories.find((category) => category.active && category.id !== categoryIdToUpdate)?.id ??
      categoryIdToUpdate;

    try {
      await updateMenuCategory(categoryIdToUpdate, {
        name: normalizedName,
        emoji: values.emoji || "☷",
        item_ids: values.itemIds,
        fallback_category_id: fallbackCategoryId,
      });

      await refreshMenu();

      if (categoryId === categoryIdToUpdate && fallbackCategoryId !== categoryIdToUpdate) {
        setCategoryId(fallbackCategoryId);
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    }
  };

  const deleteCategory = async (categoryIdToDelete: string): Promise<ActionResult> => {
    const category = categories.find((currentCategory) => currentCategory.id === categoryIdToDelete);

    if (!category) {
      return {
        ok: false,
        message: "Kategorija nije pronađena.",
      };
    }

    const fallbackCategory = categories.find(
      (currentCategory) => currentCategory.active && currentCategory.id !== categoryIdToDelete,
    );

    if (!fallbackCategory) {
      return {
        ok: false,
        message: "Ne možete obrisati jedinu kategoriju.",
      };
    }

    try {
      await deleteMenuCategory(categoryIdToDelete, fallbackCategory.id);
      await refreshMenu();

      if (categoryId === categoryIdToDelete) {
        setCategoryId(fallbackCategory.id);
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error),
      };
    }
  };

  return {
    items,
    categories: activeCategories,
    filteredItems,
    counters,
    isLoading,
    error,
    search,
    categoryId,
    status,
    setSearch,
    setCategoryId,
    setStatus,
    getCategoryById,
    createItem,
    updateItem,
    toggleStatus,
    deleteItem,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
