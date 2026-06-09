import { ProductDetail } from "@/features/products/ProductDetail";
import { getStoreProductDetail } from "@/features/products/queries";

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

  return <ProductDetail data={data} externalPrescriptionStatus={query.prescription} />;
}
