"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { buildPromptPayPayload } from "@/lib/payments/promptpay";
import { getAppEnv } from "@/lib/env/schema";
import { buildAttachmentMetadata, normalizeHostedAttachmentInput } from "@/lib/storage/attachments";
import { awardRewardPoints, calculateOrderRewardPoints, getRewardExpiryDate } from "@/features/rewards/rules";
import {
  createExternalPrescriptionOrderSchema,
  createPrescriptionOrderSchema
} from "@/features/products/prescriptions/schema";
import { isPrescriptionOrderReady } from "@/features/products/prescriptions/readiness";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function getThaiQrPayload(amount: Prisma.Decimal): string | null {
  const promptPayId = getAppEnv().THAI_QR_PROMPTPAY_ID;

  if (!promptPayId) {
    return null;
  }

  return buildPromptPayPayload(promptPayId, Number(amount));
}

export async function createPrescriptionOrderAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "order:create:self");
  assertPermission(session, "prescription:read:self");

  const parsed = createPrescriptionOrderSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/consult/prescriptions?order=invalid");
  }

  let orderId: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.findFirst({
        where: {
          id: parsed.data.prescriptionId,
          patientId: session.userId
        },
        select: {
          id: true,
          patientId: true,
          status: true,
          orderItems: {
            select: {
              orderId: true
            },
            take: 1
          }
        }
      });

      if (!prescription || !isPrescriptionOrderReady(prescription.status)) {
        throw new Error("Prescription is not ready for order creation.");
      }

      if (prescription.orderItems.length > 0) {
        throw new Error("Prescription already has a linked order.");
      }

      const product = await tx.product.findFirst({
        where: {
          id: parsed.data.productId,
          status: "active",
          requiresPrescription: true
        },
        include: {
          inventory: true
        }
      });

      if (!product) {
        throw new Error("Prescription product was not found.");
      }

      const availableQuantity = Math.max((product.inventory?.quantity ?? 0) - (product.inventory?.reservedQuantity ?? 0), 0);

      if (availableQuantity <= 0) {
        throw new Error("Prescription product is out of stock.");
      }

      const quantity = 1;
      const subtotal = product.price.mul(quantity);
      const qrPayload = getThaiQrPayload(subtotal);
      const order = await tx.order.create({
        data: {
          userId: session.userId,
          status: "pending_payment",
          subtotal,
          discountTotal: new Prisma.Decimal(0),
          shippingTotal: new Prisma.Decimal(0),
          grandTotal: subtotal,
          items: {
            create: {
              productId: product.id,
              prescriptionId: prescription.id,
              quantity,
              unitPrice: product.price,
              lineTotal: subtotal
            }
          },
          payments: {
            create: {
              method: "promptpay",
              amount: subtotal,
              status: "pending_slip",
              qrPayload,
              verificationPayload: {
                source: "prescription_order",
                prescriptionId: prescription.id,
                prescriptionStatus: prescription.status,
                note: qrPayload
                  ? "Dynamic Thai QR PromptPay payload generated for this prescription order."
                  : "Set THAI_QR_PROMPTPAY_ID to generate dynamic Thai QR PromptPay payloads."
              }
            }
          },
          shipments: {
            create: {
              status: "pending",
              eventsJson: {
                source: "prescription_order",
                prescriptionId: prescription.id,
                prescriptionStatus: prescription.status,
                message: "Prescription order created from doctor-issued prescription without extra document review."
              }
            }
          }
        },
        select: {
          id: true
        }
      });

      if (product.inventory) {
        await tx.inventory.update({
          where: {
            productId: product.id
          },
          data: {
            reservedQuantity: {
              increment: quantity
            }
          }
        });
      }

      await tx.notification.create({
        data: {
          userId: session.userId,
          type: "order",
          channel: "in_app",
          title: "สร้างคำสั่งซื้อยาตามใบสั่งแพทย์แล้ว",
          body: "กรุณาชำระเงินและส่งสลิปเพื่อให้ห้องยาจัดเตรียมสินค้า",
          metadataJson: {
            orderId: order.id,
            prescriptionId: prescription.id,
            href: "/store/orders"
          }
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "order.create_from_prescription",
        entityType: "order",
        entityId: order.id,
        metadata: {
          prescriptionId: prescription.id,
          prescriptionStatus: prescription.status,
          productId: product.id,
          paymentStatus: "pending_slip",
          orderStatus: "pending_payment",
          hasPromptPayPayload: Boolean(qrPayload)
        }
      });

      const rewardPoints = calculateOrderRewardPoints(subtotal);
      const didAwardReward = await awardRewardPoints(tx, {
        userId: session.userId,
        sourceType: "order",
        sourceId: order.id,
        points: rewardPoints,
        expiresAt: getRewardExpiryDate()
      });

      if (didAwardReward) {
        await tx.notification.create({
          data: {
            userId: session.userId,
            type: "reward",
            channel: "in_app",
            title: "ได้รับแต้มสะสม",
            body: `คุณได้รับ ${rewardPoints} แต้มจากคำสั่งซื้อยาตามใบสั่งแพทย์`,
            metadataJson: {
              orderId: order.id,
              href: "/profile/rewards"
            }
          }
        });
      }

      return order;
    });

    orderId = result.id;
  } catch {
    redirect(`/store/prescriptions/${parsed.data.prescriptionId}?order=failed`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/pharmacist/orders");
  revalidatePath("/consult/prescriptions");
  revalidatePath(`/store/prescriptions/${parsed.data.prescriptionId}`);
  revalidatePath("/store/orders");
  revalidatePath("/profile");
  revalidatePath("/profile/rewards");
  revalidatePath("/notifications");

  redirect(`/store/orders?created=${orderId}`);
}

export async function createExternalPrescriptionOrderAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "order:create:self");

  const parsed = createExternalPrescriptionOrderSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/store?prescription=invalid");
  }

  let normalizedAttachment: ReturnType<typeof normalizeHostedAttachmentInput>;

  try {
    normalizedAttachment = normalizeHostedAttachmentInput({
      storageUrl: parsed.data.attachmentUrl,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      byteSize: parsed.data.byteSize
    });
  } catch {
    redirect(`/store/${parsed.data.productSlug}?prescription=invalid`);
  }

  let orderId: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          slug: parsed.data.productSlug,
          status: "active",
          requiresPrescription: true
        },
        include: {
          inventory: true
        }
      });

      if (!product) {
        throw new Error("Prescription-required product was not found.");
      }

      const availableQuantity = Math.max((product.inventory?.quantity ?? 0) - (product.inventory?.reservedQuantity ?? 0), 0);

      if (availableQuantity <= 0) {
        throw new Error("Prescription-required product is out of stock.");
      }

      const quantity = 1;
      const subtotal = product.price.mul(quantity);
      const qrPayload = getThaiQrPayload(subtotal);
      const order = await tx.order.create({
        data: {
          userId: session.userId,
          status: "pending_payment",
          subtotal,
          discountTotal: new Prisma.Decimal(0),
          shippingTotal: new Prisma.Decimal(0),
          grandTotal: subtotal,
          items: {
            create: {
              productId: product.id,
              quantity,
              unitPrice: product.price,
              lineTotal: subtotal
            }
          },
          payments: {
            create: {
              method: "promptpay",
              amount: subtotal,
              status: "pending_slip",
              qrPayload,
              verificationPayload: {
                source: "external_prescription_order",
                note: qrPayload
                  ? "Dynamic Thai QR PromptPay payload generated for this external prescription order."
                  : "Set THAI_QR_PROMPTPAY_ID to generate dynamic Thai QR PromptPay payloads."
              }
            }
          },
          shipments: {
            create: {
              status: "pending",
              eventsJson: {
                source: "external_prescription_order",
                message: "Order created from externally attached prescription metadata without extra document review."
              }
            }
          }
        },
        select: {
          id: true
        }
      });

      const attachment = await tx.fileAttachment.create({
        data: {
          ownerId: session.userId,
          purpose: "external_prescription",
          entityType: "order",
          entityId: order.id,
          storageUrl: normalizedAttachment.storageUrl,
          storageKey: normalizedAttachment.storageKey,
          fileName: normalizedAttachment.fileName,
          mimeType: normalizedAttachment.mimeType,
          byteSize: normalizedAttachment.byteSize,
          metadataJson: buildAttachmentMetadata(normalizedAttachment, {
            productId: product.id,
            productSlug: product.slug,
            source: "external_prescription_order"
          })
        },
        select: {
          id: true
        }
      });

      if (product.inventory) {
        await tx.inventory.update({
          where: {
            productId: product.id
          },
          data: {
            reservedQuantity: {
              increment: quantity
            }
          }
        });
      }

      await tx.notification.create({
        data: {
          userId: session.userId,
          type: "order",
          channel: "in_app",
          title: "สร้างคำสั่งซื้อพร้อมใบสั่งยาแล้ว",
          body: "ระบบบันทึกข้อมูลแนบใบสั่งยาและสร้างคำสั่งซื้อแล้ว กรุณาชำระเงินเพื่อให้คลินิกจัดเตรียมสินค้า",
          metadataJson: {
            orderId: order.id,
            attachmentId: attachment.id,
            href: "/store/orders"
          }
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "order.create_from_external_prescription",
        entityType: "order",
        entityId: order.id,
        metadata: {
          productId: product.id,
          attachmentId: attachment.id,
          paymentStatus: "pending_slip",
          orderStatus: "pending_payment",
          hasPromptPayPayload: Boolean(qrPayload),
          noAdditionalDocumentReview: true
        }
      });

      const rewardPoints = calculateOrderRewardPoints(subtotal);
      const didAwardReward = await awardRewardPoints(tx, {
        userId: session.userId,
        sourceType: "order",
        sourceId: order.id,
        points: rewardPoints,
        expiresAt: getRewardExpiryDate()
      });

      if (didAwardReward) {
        await tx.notification.create({
          data: {
            userId: session.userId,
            type: "reward",
            channel: "in_app",
            title: "ได้รับแต้มสะสม",
            body: `คุณได้รับ ${rewardPoints} แต้มจากคำสั่งซื้อพร้อมใบสั่งยา`,
            metadataJson: {
              orderId: order.id,
              href: "/profile/rewards"
            }
          }
        });
      }

      return order;
    });

    orderId = result.id;
  } catch {
    redirect(`/store/${parsed.data.productSlug}?prescription=failed`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/pharmacist/orders");
  revalidatePath(`/store/${parsed.data.productSlug}`);
  revalidatePath("/store/orders");
  revalidatePath("/profile");
  revalidatePath("/profile/rewards");
  revalidatePath("/notifications");

  redirect(`/store/orders?created=${orderId}`);
}
