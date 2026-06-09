import { ProductDetail } from "@/features/products/ProductDetail";
import { getStoreProductDetail } from "@/features/products/queries";

export default async function ProductDetailPage({
  searchParams
}: {
  searchParams: Promise<{
    prescription?: string;
  }>;
}) {
  const query = await searchParams;
  const data = await getStoreProductDetail("paracetamol-500mg");

  return <ProductDetail data={data} externalPrescriptionStatus={query.prescription} />;
}
