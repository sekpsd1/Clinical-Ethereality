import { ProductDetail } from "@/features/products/ProductDetail";
import { getStoreProductDetail } from "@/features/products/queries";

export default async function StoreProductDetailPage({
  params
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  const data = await getStoreProductDetail(slug);

  return <ProductDetail data={data} />;
}
