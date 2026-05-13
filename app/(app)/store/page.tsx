import { HealthMarketplace } from "@/features/products/HealthMarketplace";
import { getStoreMarketplace } from "@/features/products/queries";

export default async function StorePage() {
  const data = await getStoreMarketplace();

  return <HealthMarketplace data={data} />;
}
