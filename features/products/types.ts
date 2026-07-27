export type StoreScreen =
  | "health-marketplace"
  | "product-detail"
  | "store-checkout"
  | "payment-success-tracking";

export type StoreProductMedia = "gel" | "vitamin" | "kit";

export type StoreProductListItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  categoryLabel: string;
  price: string;
  description: string | null;
  imageAlt: string;
  imageUrl: string | null;
  media: StoreProductMedia;
  href: `/store/${string}`;
  cta: string;
  requiresPrescription: boolean;
  stockLabel: string;
  featured: boolean;
};

export type StoreMarketplaceData = {
  products: StoreProductListItem[];
  unavailable?: boolean;
};

export type StoreProductDetailItem = StoreProductListItem & {
  longDescription: string;
  usageInstructions: string | null;
  fdaNumber: string | null;
  warnings: string | null;
  storageInstructions: string | null;
  controlledOrRestricted: boolean;
  specialFulfillmentNotes: string | null;
};

export type StoreProductDetailData = {
  product: StoreProductDetailItem | null;
  unavailable?: boolean;
};
