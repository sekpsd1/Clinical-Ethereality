import { StoreCheckout } from "@/features/products/StoreCheckout";
import { getCustomerCart } from "@/features/cart/queries";

export default async function StoreCheckoutPage({
  searchParams
}: {
  searchParams: Promise<{
    checkout?: string;
  }>;
}) {
  const params = await searchParams;
  const cart = await getCustomerCart();

  return <StoreCheckout checkoutStatus={params.checkout} cart={cart} />;
}
