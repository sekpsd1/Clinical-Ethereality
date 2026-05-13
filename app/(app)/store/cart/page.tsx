import { CustomerCart } from "@/features/cart/CustomerCart";
import { getCustomerCart } from "@/features/cart/queries";

export default async function StoreCartPage({
  searchParams
}: {
  searchParams: Promise<{
    cart?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getCustomerCart();

  return <CustomerCart data={data} cartStatus={params.cart} />;
}
