import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

type CartFingerprintItem = {
  slug: string;
  quantity: number;
};

export type ExistingCheckoutOrder = {
  orderId: string;
  cartFingerprint: string | null;
};

export function canReuseCheckoutOrder(
  existingOrder: ExistingCheckoutOrder,
  cartFingerprint: string
): boolean {
  return existingOrder.cartFingerprint === cartFingerprint;
}

export function createCartFingerprint(items: readonly CartFingerprintItem[]): string {
  const quantities = items.reduce((result, item) => {
    result.set(item.slug, (result.get(item.slug) ?? 0) + item.quantity);
    return result;
  }, new Map<string, number>());
  const normalizedItems = Array.from(quantities.entries())
    .sort(([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug))
    .map(([slug, quantity]) => ({ slug, quantity }));

  return createHash("sha256").update(JSON.stringify(normalizedItems)).digest("hex");
}

function getCartFingerprint(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const cartFingerprint = (value as Record<string, unknown>).cartFingerprint;
  return typeof cartFingerprint === "string" && cartFingerprint.length > 0 ? cartFingerprint : null;
}

export async function findExistingCheckoutOrder(
  tx: Prisma.TransactionClient,
  userId: string,
  checkoutRequestId: string
): Promise<ExistingCheckoutOrder | null> {
  const payment = await tx.payment.findFirst({
    where: {
      order: {
        userId
      },
      verificationPayload: {
        path: "$.checkoutRequestId",
        equals: checkoutRequestId
      }
    },
    select: {
      orderId: true,
      verificationPayload: true
    }
  });

  if (!payment?.orderId) {
    return null;
  }

  return {
    orderId: payment.orderId,
    cartFingerprint: getCartFingerprint(payment.verificationPayload)
  };
}
