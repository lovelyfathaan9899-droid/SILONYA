// Frontend source of truth for the 4-department taxonomy — mirrors
// packages/database/prisma/seed-catalog.ts's DEPARTMENTS/SUBCATEGORIES by
// hand. The two can't share a real import: apps/web importing from a Prisma
// seed script is the wrong layering, and the reverse (packages/database
// depending on apps/web) is a backwards dependency direction. Keep these
// two lists in sync whenever the taxonomy changes.
export interface DepartmentSubcategory {
  name: string;
  slug: string;
}

export interface Department {
  name: string;
  slug: string;
  subcategories: DepartmentSubcategory[];
}

export const departments: Department[] = [
  {
    name: "Women",
    slug: "women",
    subcategories: [
      { name: "Dresses", slug: "women-dresses" },
      { name: "Tops", slug: "women-tops" },
      { name: "Bottoms", slug: "women-bottoms" },
      { name: "Outerwear", slug: "women-outerwear" },
      { name: "Shoes", slug: "women-shoes" },
    ],
  },
  {
    name: "Men",
    slug: "men",
    subcategories: [
      { name: "Shirts", slug: "men-shirts" },
      { name: "T-Shirts", slug: "men-t-shirts" },
      { name: "Pants", slug: "men-pants" },
      { name: "Jackets", slug: "men-jackets" },
      { name: "Shoes", slug: "men-shoes" },
    ],
  },
  {
    name: "Kids",
    slug: "kids",
    subcategories: [
      { name: "Baby", slug: "kids-baby" },
      { name: "Boys", slug: "kids-boys" },
      { name: "Girls", slug: "kids-girls" },
    ],
  },
  {
    name: "Accessories",
    slug: "accessories",
    subcategories: [
      { name: "Bags", slug: "accessories-bags" },
      { name: "Wallets", slug: "accessories-wallets" },
      { name: "Belts", slug: "accessories-belts" },
      { name: "Caps", slug: "accessories-caps" },
      { name: "Sunglasses", slug: "accessories-sunglasses" },
      { name: "Watches", slug: "accessories-watches" },
      { name: "Jewellery", slug: "accessories-jewellery" },
    ],
  },
];
