import { randomUUID } from "node:crypto";
import { StoreCheckout } from "@/features/products/StoreCheckout";
import { getCustomerCart } from "@/features/cart/queries";
import { isStorePromptPayReady } from "@/features/products/checkout/payment";

export default async function StoreCheckoutPage({
  searchParams
}: {
  searchParams: Promise<{
    checkout?: string;
  }>;
}) {
  const params = await searchParams;
  const cart = await getCustomerCart();
  const checkoutRequestId = randomUUID();
  const paymentAvailable = isStorePromptPayReady();

  return (
    <StoreCheckout
      checkoutStatus={params.checkout}
      checkoutRequestId={checkoutRequestId}
      cart={cart}
      paymentAvailable={paymentAvailable}
    />
  );
}
