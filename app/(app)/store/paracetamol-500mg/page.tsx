import { ProductDetail } from "@/features/products/ProductDetail";
import { getStoreProductDetail } from "@/features/products/queries";

export default async function ProductDetailPage() {
  const data = await getStoreProductDetail("paracetamol-500mg");

  return <ProductDetail data={data} />;
}
