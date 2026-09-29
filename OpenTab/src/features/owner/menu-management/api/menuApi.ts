// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import { apiDelete, apiGet, apiPatch, apiPost } from "../../../../shared/api/client";

export type ApiMenuCategory = {
  id: string | number;
  venue: string;
  name: string;
  emoji: string;
  description: string | null;
  display_order: number;
  active: boolean | number;
};

export type ApiMenuOption = {
  id: string | number;
  name: string;
  extra_price: string | number;
};

export type ApiMenuOptionGroup = {
  id: string | number;
  name: string;
  options: ApiMenuOption[];
};

export type ApiMenuItem = {
  id: string | number;
  category: string | number;
  name: string;
  description: string | null;
  composition: string | null;
  price: string | number;
  image: string | null;
  estimated_preparation_minutes: number | null;
  active: boolean | number;
  available: boolean | number;
  option_groups: ApiMenuOptionGroup[];
};

export type MenuCategoryMutationPayload = {
  name: string;
  emoji: string;
  description?: string;
  display_order?: number;
  active?: boolean;
  item_ids?: string[];
  fallback_category_id?: string;
};

export type MenuItemMutationPayload = {
  category: string;
  name: string;
  description: string;
  composition: string;
  price: number;
  image: string;
  estimated_preparation_minutes: number | null;
  active: boolean;
  available: boolean;
  option_groups: Array<{
    name: string;
    options: Array<{
      name: string;
      extra_price: number;
    }>;
  }>;
};

export function getMenuCategories() {
  return apiGet<ApiMenuCategory[]>("/menu-categories/");
}

export function getMenuItems() {
  return apiGet<ApiMenuItem[]>("/menu-items/");
}

export function createMenuCategory(payload: MenuCategoryMutationPayload) {
  return apiPost<ApiMenuCategory>("/menu-categories/", payload);
}

export function updateMenuCategory(categoryId: string, payload: MenuCategoryMutationPayload) {
  return apiPatch<ApiMenuCategory>(`/menu-categories/${categoryId}/`, payload);
}

export function deleteMenuCategory(categoryId: string, fallbackCategoryId: string) {
  return apiDelete<{ ok: true }>(`/menu-categories/${categoryId}/`, {
    fallback_category_id: fallbackCategoryId,
  });
}

export function createMenuItem(payload: MenuItemMutationPayload) {
  return apiPost<ApiMenuItem>("/menu-items/", payload);
}

export function updateMenuItem(itemId: string, payload: Partial<MenuItemMutationPayload>) {
  return apiPatch<ApiMenuItem>(`/menu-items/${itemId}/`, payload);
}

export function deleteMenuItem(itemId: string) {
  return apiDelete<{ ok: true }>(`/menu-items/${itemId}/`);
}
