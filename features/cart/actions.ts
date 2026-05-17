"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CART_COOKIE_NAME, parseCartCookie, serializeCartCookie } from "@/features/cart/cookies";
import { cartMutationSchema } from "@/features/cart/schema";

function formDataToObject(formData: FormData) {
  return {
    slug: formData.get("slug"),
    quantity: formData.get("quantity") ?? 1
  };
}

async function writeCart(items: Array<{ slug: string; quantity: number }>) {
  const cookieStore = await cookies();

  cookieStore.set(CART_COOKIE_NAME, serializeCartCookie(items.filter((item) => item.quantity > 0)), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function revalidateCartPaths() {
  revalidatePath("/store");
  revalidatePath("/store/cart");
  revalidatePath("/store/checkout");
}

export async function addToCartAction(formData: FormData): Promise<void> {
  const parsed = cartMutationSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/store/cart?cart=invalid");
  }

  const cookieStore = await cookies();
  const cartItems = parseCartCookie(cookieStore);
  const current = cartItems.find((item) => item.slug === parsed.data.slug);

  if (current) {
    current.quantity = Math.min(current.quantity + parsed.data.quantity, 10);
  } else {
    cartItems.push({
      slug: parsed.data.slug,
      quantity: parsed.data.quantity
    });
  }

  await writeCart(cartItems);
  revalidateCartPaths();
  redirect("/store/cart?cart=added");
}

export async function updateCartItemAction(formData: FormData): Promise<void> {
  const parsed = cartMutationSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/store/cart?cart=invalid");
  }

  const cookieStore = await cookies();
  const cartItems = parseCartCookie(cookieStore)
    .map((item) => (item.slug === parsed.data.slug ? { ...item, quantity: parsed.data.quantity } : item))
    .filter((item) => item.quantity > 0);

  await writeCart(cartItems);
  revalidateCartPaths();
  redirect("/store/cart?cart=updated");
}

export async function clearCartAction(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(CART_COOKIE_NAME);
  revalidateCartPaths();
  redirect("/store/cart?cart=cleared");
}
