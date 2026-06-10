import { ProductDetail } from "@/features/products/ProductDetail";
import { getStoreProductDetail } from "@/features/products/queries";
import { getStorageReadiness } from "@/lib/storage/provider";

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
  const data = await getStoreProductDetail(slug);
  const storageReadiness = getStorageReadiness();

  return <ProductDetail data={data} externalPrescriptionStatus={query.prescription} storageReadiness={storageReadiness} />;
}
