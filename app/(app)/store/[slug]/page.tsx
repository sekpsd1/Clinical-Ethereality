import { ProductDetail } from "@/features/products/ProductDetail";
import { getStoreProductDetail } from "@/features/products/queries";
import { getStorageReadiness } from "@/lib/storage/provider";
import { requireCurrentSession } from "@/lib/auth/session";
import { getCustomerShippingAddresses } from "@/features/profile/shipping-addresses/queries";

export default async function StoreProductDetailPage({
  params,
  searchParams
}: {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    prescription?: string;
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await requireCurrentSession();
  const [data, addresses] = await Promise.all([getStoreProductDetail(slug), getCustomerShippingAddresses(session)]);
  const storageReadiness = getStorageReadiness();

  return <ProductDetail data={data} externalPrescriptionStatus={query.prescription} storageReadiness={storageReadiness} addresses={addresses} />;
}
