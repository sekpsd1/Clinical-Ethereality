import { HealthMarketplace } from "@/features/products/HealthMarketplace";
import { getStoreMarketplace } from "@/features/products/queries";
import {
  parseStoreMarketplaceFilters,
  type StoreMarketplaceSearchParams
} from "@/features/products/search";

export default async function StorePage({
  searchParams
}: {
  searchParams: Promise<StoreMarketplaceSearchParams>;
}) {
  const filters = parseStoreMarketplaceFilters(await searchParams);
  const data = await getStoreMarketplace(filters);

  return <HealthMarketplace data={data} />;
}
