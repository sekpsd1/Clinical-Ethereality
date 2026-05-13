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
  price: string;
  description: string | null;
  imageAlt: string;
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
};

export type StoreProductDetailData = {
  product: StoreProductDetailItem | null;
  unavailable?: boolean;
};
