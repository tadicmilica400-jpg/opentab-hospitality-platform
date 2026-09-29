// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
export type MenuItemStatus = "active" | "inactive";

export type MenuCategory = {
  id: string;
  name: string;
  emoji: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MenuOption = {
  id: string;
  name: string;
  priceDelta: number;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  options: MenuOption[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  composition: string;
  price: number;
  categoryId: string;
  status: MenuItemStatus;
  imageUrl: string;
  optionGroups: MenuOptionGroup[];
  createdAt: string;
  updatedAt: string;
};

export type MenuItemFormValues = {
  name: string;
  description: string;
  composition: string;
  price: number;
  categoryId: string;
  imageUrl: string;
  optionGroups: MenuOptionGroup[];
};

export type MenuItemFormErrors = Partial<Record<keyof MenuItemFormValues, string>>;