"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";

const checkoutSchema = z.object({
  productSlugs: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .pipe(z.array(z.string().min(1)).min(1).max(10))
});

function formDataToObject(formData: FormData) {
  return {
    productSlugs: formData.getAll("productSlugs")
  };
}

function getLineTotal(price: Prisma.Decimal, quantity: number): Prisma.Decimal {
  return price.mul(quantity);
}

export async function createStoreCheckoutOrderAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "order:create:self");

  const parsed = checkoutSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/store/checkout?checkout=invalid");
  }

  let orderId: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          slug: {
            in: parsed.data.productSlugs
          },
          status: "active"
        },
        include: {
          inventory: true
        }
      });

      if (products.length !== parsed.data.productSlugs.length) {
        throw new Error("Some products are unavailable.");
      }

      const subtotal = products.reduce((total, product) => total.add(getLineTotal(product.price, 1)), new Prisma.Decimal(0));
      const order = await tx.order.create({
        data: {
          userId: session.userId,
          status: "payment_review",
          subtotal,
          discountTotal: new Prisma.Decimal(0),
          shippingTotal: new Prisma.Decimal(0),
          grandTotal: subtotal,
          items: {
            create: products.map((product) => ({
              productId: product.id,
              quantity: 1,
              unitPrice: product.price,
              lineTotal: getLineTotal(product.price, 1)
            }))
          },
          payments: {
            create: {
              method: "promptpay",
              amount: subtotal,
              status: "pending_review",
              qrPayload: "promptpay://clinical-ethereality/demo-checkout",
              verificationPayload: {
                source: "customer_checkout_foundation",
                note: "Slip upload storage is pending provider selection."
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

      for (const product of products) {
        if (product.inventory) {
          await tx.inventory.update({
            where: {
              productId: product.id
            },
            data: {
              reservedQuantity: {
                increment: 1
              }
            }
          });
        }
      }

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

      return order;
    });

    orderId = result.id;
  } catch {
    redirect("/store/checkout?checkout=failed");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/pharmacist/orders");
  revalidatePath("/store/orders");
  revalidatePath("/notifications");

  redirect(`/store/orders?created=${orderId}`);
}
