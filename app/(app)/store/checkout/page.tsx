import { StoreCheckout } from "@/features/products/StoreCheckout";
import { getCustomerCart } from "@/features/cart/queries";
import { getPromptPayInstruction } from "@/lib/payments/promptpay";

export default async function StoreCheckoutPage({
  searchParams
}: {
  searchParams: Promise<{
    checkout?: string;
  }>;
}) {
  const params = await searchParams;
  const cart = await getCustomerCart();
  const promptPayInstruction = await getPromptPayInstruction(cart.subtotalAmount > 0 ? cart.subtotalAmount : 1800);

  return <StoreCheckout checkoutStatus={params.checkout} cart={cart} promptPayInstruction={promptPayInstruction} />;
}
