// Autor: Milica Tadić ([student ID omitted]) - SSU11-15
import type { MenuCategory, MenuItem } from "../../../entities/menu/menu.types";

const now = "2026-04-15T10:00:00.000Z";

export const waiterMenuCategories: MenuCategory[] = [
  { id: "coffee", name: "Kafa", emoji: "☕", active: true, createdAt: now, updatedAt: now },
  { id: "juices", name: "Sokovi", emoji: "🍋", active: true, createdAt: now, updatedAt: now },
  { id: "food", name: "Hrana", emoji: "🥞", active: true, createdAt: now, updatedAt: now },
  { id: "desserts", name: "Deserti", emoji: "🍰", active: true, createdAt: now, updatedAt: now },
  { id: "cold-drinks", name: "Hladna pića", emoji: "🥤", active: true, createdAt: now, updatedAt: now },
];

export const waiterMenuItems: MenuItem[] = [
  {
    id: "espresso",
    name: "Espresso",
    price: 180,
    categoryId: "coffee",
    status: "active",
    description: "Kratak i intenzivan espresso od pažljivo odabrane arabica kafe.",
    composition: "Arabica kafa, voda",
    imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80",
    optionGroups: [
      {
        id: "espresso-milk",
        name: "Vrsta mleka",
        options: [
          { id: "regular-milk", name: "Obično mleko", priceDelta: 0 },
          { id: "almond-milk", name: "Bademovo mleko", priceDelta: 80 },
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "lemonade",
    name: "Domaća limunada",
    price: 260,
    categoryId: "juices",
    status: "active",
    description: "Osvežavajuća limunada sa limunom, mentom i laganom notom šećera.",
    composition: "Limun, menta, šećer, voda",
    imageUrl: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800&q=80",
    optionGroups: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "pancakes-nutella",
    name: "Palačinke sa nutelom",
    price: 390,
    categoryId: "food",
    status: "active",
    description: "Meke palačinke punjene nutelom, posute šećerom u prahu.",
    composition: "Brašno, jaja, mleko, nutela",
    imageUrl: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800&q=80",
    optionGroups: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "coca-cola",
    name: "Coca Cola",
    price: 180,
    categoryId: "cold-drinks",
    status: "inactive",
    description: "Originalno gazirano piće. 0.33l limenka.",
    composition: "",
    imageUrl: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=800&q=80",
    optionGroups: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "ny-cheesecake",
    name: "NY Cheesecake",
    price: 420,
    categoryId: "desserts",
    status: "active",
    description: "Kremasti cheesecake sa prelivom od šumskog voća.",
    composition: "Krem sir, šećer, keks, šumsko voće",
    imageUrl: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800&q=80",
    optionGroups: [],
    createdAt: now,
    updatedAt: now,
  },
];
