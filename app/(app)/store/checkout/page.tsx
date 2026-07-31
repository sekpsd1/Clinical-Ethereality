import { randomUUID } from "node:crypto";
import { StoreCheckout } from "@/features/products/StoreCheckout";
import { getCustomerCart } from "@/features/cart/queries";
import { isStorePromptPayReady } from "@/features/products/checkout/payment";
import { requireCurrentSession } from "@/lib/auth/session";
import { getCustomerShippingAddresses } from "@/features/profile/shipping-addresses/queries";

export default async function StoreCheckoutPage({
  searchParams
}: {
  searchParams: Promise<{
    checkout?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await requireCurrentSession();
  const [cart, addresses] = await Promise.all([getCustomerCart(), getCustomerShippingAddresses(session)]);
  const checkoutRequestId = randomUUID();
  const paymentAvailable = isStorePromptPayReady();

  return (
    <StoreCheckout
      checkoutStatus={params.checkout}
      checkoutRequestId={checkoutRequestId}
      cart={cart}
      paymentAvailable={paymentAvailable}
      addresses={addresses}
    />
  );
}
