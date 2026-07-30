"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { CART_COOKIE_NAME, parseCartCookie } from "@/features/cart/cookies";
import {
  canReuseCheckoutOrder,
  createCartFingerprint,
  findExistingCheckoutOrder
} from "@/features/products/checkout/idempotency";
import { createStorePromptPayPayload } from "@/features/products/checkout/payment";
import { checkoutSchema } from "@/features/products/checkout/schema";
import { canReserveInventory } from "@/features/products/checkout/safety";
import {
  assertStorePendingOrderCapacity,
  releaseExpiredStoreOrderReservations,
  StorePendingOrderLimitError
} from "@/features/orders/reservations";

type CheckoutFailureStatus =
  | "empty"
  | "failed"
  | "stale"
  | "prescription"
  | "stock"
  | "payment"
  | "limit"
  | "conflict";

class CheckoutActionError extends Error {
  constructor(readonly status: CheckoutFailureStatus, message: string) {
    super(message);
    this.name = "CheckoutActionError";
  }
}

function formDataToObject(formData: FormData) {
  return {
    checkoutRequestId: formData.get("checkoutRequestId")
  };
}

function getLineTotal(price: Prisma.Decimal, quantity: number): Prisma.Decimal {
  return price.mul(quantity);
}

function getQuantities(items: Array<{ slug: string; quantity: number }>): Map<string, number> {
  return items.reduce((quantities, item) => {
    quantities.set(item.slug, (quantities.get(item.slug) ?? 0) + item.quantity);

    return quantities;
  }, new Map<string, number>());
}

export async function createStoreCheckoutOrderAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "order:create:self");

  const parsed = checkoutSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/store/checkout?checkout=invalid");
  }

  const cookieStore = await cookies();
  const cartItems = parseCartCookie(cookieStore);
  const cartFingerprint = createCartFingerprint(cartItems);
  let orderId: string | null = null;

  try {
    await releaseExpiredStoreOrderReservations({
      userId: session.userId
    });

    const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await findExistingCheckoutOrder(
        tx,
        session.userId,
        parsed.data.checkoutRequestId
      );

      if (existingOrder) {
        if (!canReuseCheckoutOrder(existingOrder, cartFingerprint)) {
          throw new CheckoutActionError(
            "conflict",
            "This checkout request was already used with a different cart."
          );
        }

        return {
          id: existingOrder.orderId
        };
      }

      if (cartItems.length === 0) {
        throw new CheckoutActionError("empty", "Cart is empty.");
      }

      await assertStorePendingOrderCapacity(tx, session.userId);

      const quantities = getQuantities(cartItems);
      const uniqueSlugs = Array.from(quantities.keys());
      const products = await tx.product.findMany({
        where: {
          slug: {
            in: uniqueSlugs
          },
          status: "active"
        },
        include: {
          inventory: true
        }
      });

      if (products.length !== uniqueSlugs.length) {
        throw new CheckoutActionError("stale", "Some cart products are unavailable.");
      }

      if (products.some((product) => product.requiresPrescription)) {
        throw new CheckoutActionError(
          "prescription",
          "Prescription-required products must be ordered from a verified prescription."
        );
      }

      for (const product of products) {
        const requestedQuantity = quantities.get(product.slug) ?? 0;

        if (!canReserveInventory(product.inventory, requestedQuantity)) {
          throw new CheckoutActionError("stock", "Product stock is insufficient.");
        }
      }

      const subtotal = products.reduce(
        (total, product) =>
          total.add(getLineTotal(product.price, quantities.get(product.slug) ?? 1)),
        new Prisma.Decimal(0)
      );
      const qrPayload = createStorePromptPayPayload(Number(subtotal));

      if (!qrPayload) {
        throw new CheckoutActionError(
          "payment",
          "PromptPay is not configured or a payment QR payload could not be generated."
        );
      }

      for (const product of products) {
        const requestedQuantity = quantities.get(product.slug) ?? 0;

        const reservation = await tx.inventory.updateMany({
          where: {
            id: product.inventory!.id,
            quantity: product.inventory!.quantity,
            reservedQuantity: product.inventory!.reservedQuantity
          },
          data: {
            reservedQuantity: {
              increment: requestedQuantity
            }
          }
        });

        if (reservation.count !== 1) {
          throw new CheckoutActionError("stock", "Product stock changed during checkout.");
        }
      }

      const order = await tx.order.create({
        data: {
          userId: session.userId,
          status: "pending_payment",
          subtotal,
          discountTotal: new Prisma.Decimal(0),
          shippingTotal: new Prisma.Decimal(0),
          grandTotal: subtotal,
          items: {
            create: products.map((product) => ({
              productId: product.id,
              quantity: quantities.get(product.slug) ?? 1,
              unitPrice: product.price,
              lineTotal: getLineTotal(product.price, quantities.get(product.slug) ?? 1)
            }))
          },
          payments: {
            create: {
              method: "promptpay",
              amount: subtotal,
              status: "pending_slip",
              qrPayload,
              verificationPayload: {
                checkoutRequestId: parsed.data.checkoutRequestId,
                cartFingerprint,
                source: "customer_checkout_foundation",
                note: "Dynamic Thai QR PromptPay payload generated for this order amount."
              }
            }
          },
          shipments: {
            create: {
              status: "pending",
              eventsJson: {
                source: "customer_checkout_foundation",
                message: "Order created and waiting for payment review."
              }
            }
          }
        },
        select: {
          id: true
        }
      });

      await tx.notification.create({
        data: {
          userId: session.userId,
          type: "order",
          channel: "in_app",
          title: "คำสั่งซื้ออยู่ระหว่างตรวจสอบ",
          body: "ทีมงานได้รับคำสั่งซื้อและกำลังตรวจสอบการชำระเงิน",
          metadataJson: {
            orderId: order.id,
            href: "/store/orders"
          }
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "order.create_checkout",
        entityType: "order",
        entityId: order.id,
        metadata: {
          paymentMethod: "promptpay",
          paymentStatus: "pending_slip",
          orderStatus: "pending_payment",
          itemCount: products.reduce((total, product) => total + (quantities.get(product.slug) ?? 1), 0),
          checkoutRequestId: parsed.data.checkoutRequestId,
          cartFingerprint,
          hasPromptPayPayload: true
        }
      });

      return {
        id: order.id
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    orderId = result.id;
    cookieStore.delete(CART_COOKIE_NAME);
  } catch (error) {
    const status =
      error instanceof CheckoutActionError
        ? error.status
        : error instanceof StorePendingOrderLimitError
          ? "limit"
          : "failed";
    redirect(`/store/checkout?checkout=${status}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/pharmacist/orders");
  revalidatePath("/store/cart");
  revalidatePath("/store/orders");
  revalidatePath("/profile");
  revalidatePath("/profile/rewards");
  revalidatePath("/notifications");

  redirect(`/store/orders?created=${orderId}`);
}
