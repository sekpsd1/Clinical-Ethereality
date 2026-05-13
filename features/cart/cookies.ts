export const CART_COOKIE_NAME = "ce_cart";

export type CartCookieItem = {
  slug: string;
  quantity: number;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function parseCartCookie(cookieStore: CookieReader): CartCookieItem[] {
  const rawValue = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Partial<CartCookieItem>;
        const quantity = Number(candidate.quantity);

        if (!candidate.slug || typeof candidate.slug !== "string" || !Number.isInteger(quantity) || quantity < 1) {
          return null;
        }

        return {
          slug: candidate.slug,
          quantity: Math.min(quantity, 10)
        };
      })
      .filter((item): item is CartCookieItem => Boolean(item))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function serializeCartCookie(items: CartCookieItem[]): string {
  return encodeURIComponent(JSON.stringify(items.slice(0, 10)));
}
