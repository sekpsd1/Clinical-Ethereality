import { z } from "zod";
import { productCategories, type ProductCategory } from "@/features/products/categories";

export type StoreMarketplaceSearchParams = {
  category?: string | string[];
  q?: string | string[];
};

export type StoreMarketplaceFilters = {
  category: ProductCategory | "";
  query: string;
};

const productCategoryValues = productCategories.map((category) => category.value) as [
  ProductCategory,
  ...ProductCategory[]
];

const categorySchema = z.enum(productCategoryValues).or(z.literal(""));
const querySchema = z.string().trim().max(100);

function firstSearchParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseStoreMarketplaceFilters(params: StoreMarketplaceSearchParams): StoreMarketplaceFilters {
  const normalizedQuery = firstSearchParam(params.q).trim().replace(/\s+/g, " ").slice(0, 100);
  const parsedQuery = querySchema.safeParse(normalizedQuery);
  const parsedCategory = categorySchema.safeParse(firstSearchParam(params.category));

  return {
    category: parsedCategory.success ? parsedCategory.data : "",
    query: parsedQuery.success ? parsedQuery.data : ""
  };
}

export function buildStoreMarketplaceHref(filters: Partial<StoreMarketplaceFilters>): string {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("q", filters.query);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  return params.size > 0 ? `/store?${params.toString()}` : "/store";
}
