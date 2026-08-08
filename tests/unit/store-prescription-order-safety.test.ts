import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  assertStorePendingOrderCapacity: vi.fn(),
  assertPermission: vi.fn(),
  createStorePromptPayPayload: vi.fn(),
  isStorePromptPayReady: vi.fn(),
  getOrderShippingAddressSnapshot: vi.fn(),
  normalizeHostedAttachmentInput: vi.fn(),
  prismaTransaction: vi.fn(),
  releaseExpiredStoreOrderReservations: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  }),
  requireCurrentSession: vi.fn(),
  revalidatePath: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: actionMocks.redirect
}));

vi.mock("next/cache", () => ({
  revalidatePath: actionMocks.revalidatePath
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: actionMocks.requireCurrentSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: actionMocks.prismaTransaction
  }
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: actionMocks.assertPermission
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: actionMocks.writeAuditLog
}));

vi.mock("@/lib/storage/attachments", () => ({
  buildAttachmentMetadata: vi.fn((_attachment, metadata) => metadata),
  normalizeHostedAttachmentInput: actionMocks.normalizeHostedAttachmentInput
}));

vi.mock("@/features/products/checkout/payment", () => ({
  createStorePromptPayPayload: actionMocks.createStorePromptPayPayload,
  isStorePromptPayReady: actionMocks.isStorePromptPayReady
}));

vi.mock("@/features/profile/shipping-addresses/service", () => ({
  getOrderShippingAddressSnapshot: actionMocks.getOrderShippingAddressSnapshot,
  ShippingAddressNotFoundError: class ShippingAddressNotFoundError extends Error {}
}));

vi.mock("@/features/orders/reservations", () => ({
  assertStorePendingOrderCapacity: actionMocks.assertStorePendingOrderCapacity,
  releaseExpiredStoreOrderReservations: actionMocks.releaseExpiredStoreOrderReservations,
  StorePendingOrderLimitError: class StorePendingOrderLimitError extends Error {}
}));

import {
  createExternalPrescriptionOrderAction,
  createPrescriptionOrderAction
} from "@/features/products/prescriptions/actions";
import { StorePendingOrderLimitError } from "@/features/orders/reservations";

type TransactionMock = ReturnType<typeof createTransactionMock>;

function createTransactionMock(options: {
  linkedOrderId?: string;
  lockedPrescription?: boolean;
  reservationCount?: number;
} = {}) {
  const inventory = {
    id: "inventory-1",
    productId: "product-1",
    quantity: 5,
    reservedQuantity: 1,
    lowStockThreshold: 1,
    updatedById: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
  const product = {
    id: "product-1",
    slug: "rx-product",
    name: "Prescription Product",
    category: "medicine",
    shortDescription: null,
    description: null,
    usageInstructions: null,
    fdaNumber: null,
    warnings: null,
    storageInstructions: null,
    controlledOrRestricted: false,
    specialFulfillmentNotes: null,
    price: new Prisma.Decimal(1200),
    imageUrl: null,
    requiresPrescription: true,
    status: "active" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    inventory
  };

  return {
    $queryRaw: vi.fn().mockResolvedValue(options.lockedPrescription === false ? [] : [{ id: "prescription-1" }]),
    prescription: {
      findFirst: vi.fn().mockResolvedValue({
        id: "prescription-1",
        patientId: "customer-1",
        status: "verified",
        itemsJson: [
          {
            productId: "product-1",
            medicationName: "Prescription Product",
            dosage: "500 mg",
            quantity: "2",
            instructions: "Take as directed"
          }
        ],
        orderItems: options.linkedOrderId ? [{ orderId: options.linkedOrderId }] : []
      })
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(product),
      findMany: vi.fn().mockResolvedValue([product])
    },
    inventory: {
      updateMany: vi.fn().mockResolvedValue({
        count: options.reservationCount ?? 1
      })
    },
    order: {
      create: vi.fn().mockResolvedValue({
        id: "order-1"
      })
    },
    fileAttachment: {
      create: vi.fn().mockResolvedValue({
        id: "attachment-1"
      })
    },
    notification: {
      create: vi.fn().mockResolvedValue({
        id: "notification-1"
      })
    }
  };
}

function internalOrderFormData(): FormData {
  const formData = new FormData();
  formData.set("prescriptionId", "prescription-1");
  formData.set("productId", "tampered-product-id");
  formData.set("shippingAddressId", "address-1");
  return formData;
}

function externalOrderFormData(): FormData {
  const formData = new FormData();
  formData.set("productSlug", "rx-product");
  formData.set("shippingAddressId", "address-1");
  formData.set("attachmentUrl", "https://storage.example/prescriptions/rx-1.pdf");
  formData.set("fileName", "rx-1.pdf");
  formData.set("mimeType", "application/pdf");
  formData.set("byteSize", "1200");
  return formData;
}

function useTransaction(tx: TransactionMock) {
  actionMocks.prismaTransaction.mockImplementation(
    async (operation: (transaction: TransactionMock) => Promise<unknown>) => operation(tx)
  );
}

describe("store prescription order safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.requireCurrentSession.mockResolvedValue({
      userId: "customer-1",
      role: "customer",
      permissions: ["order:create:self", "prescription:read:self"]
    });
    actionMocks.isStorePromptPayReady.mockReturnValue(true);
    actionMocks.createStorePromptPayPayload.mockReturnValue("000201-valid-promptpay-payload");
    actionMocks.getOrderShippingAddressSnapshot.mockResolvedValue({ sourceAddressId: "address-1", label: "บ้าน", recipientName: "Customer", phone: "0812345678", addressLine1: "1 Main Road", addressLine2: null, subdistrict: "คลองเตย", district: "คลองเตย", province: "กรุงเทพมหานคร", postalCode: "10110" });
    actionMocks.normalizeHostedAttachmentInput.mockReturnValue({
      storageUrl: "https://storage.example/prescriptions/rx-1.pdf",
      storageKey: "prescriptions/rx-1.pdf",
      fileName: "rx-1.pdf",
      mimeType: "application/pdf",
      byteSize: 1200,
      storageProvider: "s3",
      storageConfigured: true
    });
  });

  it("locks one internal prescription, derives the doctor-selected quantity, reserves stock with CAS, and uses a serializable transaction", async () => {
    const tx = createTransactionMock();
    useTransaction(tx);

    await expect(createPrescriptionOrderAction(internalOrderFormData())).rejects.toThrow(
      "REDIRECT:/store/orders?created=order-1"
    );

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(actionMocks.releaseExpiredStoreOrderReservations).toHaveBeenCalledWith({
      userId: "customer-1"
    });
    expect(actionMocks.assertStorePendingOrderCapacity).toHaveBeenCalledWith(
      tx,
      "customer-1"
    );
    const lockQuery = tx.$queryRaw.mock.calls[0][0] as {
      strings: string[];
      values: unknown[];
    };
    expect(lockQuery.strings.join(" ")).toContain("FOR UPDATE");
    expect(lockQuery.values).toEqual(["prescription-1", "customer-1"]);
    expect(actionMocks.getOrderShippingAddressSnapshot).toHaveBeenCalledWith(tx, "customer-1", "address-1");
    expect(tx.product.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["product-1"]
        },
        status: "active",
        requiresPrescription: true
      },
      include: {
        inventory: true
      }
    });
    expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ shippingAddress: { create: expect.objectContaining({ sourceAddressId: "address-1", postalCode: "10110" }) } }) }));
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: "inventory-1",
        quantity: 5,
        reservedQuantity: 1
      },
      data: {
        reservedQuantity: {
          increment: 2
        }
      }
    });
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                productId: "product-1",
                prescriptionId: "prescription-1",
                quantity: 2
              })
            ]
          }
        })
      })
    );
    expect(tx.inventory.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.create.mock.invocationCallOrder[0]
    );
    expect(actionMocks.prismaTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  });

  it("blocks a duplicate internal prescription order before payment, stock, or order mutations", async () => {
    const tx = createTransactionMock({
      linkedOrderId: "existing-order"
    });
    useTransaction(tx);

    await expect(createPrescriptionOrderAction(internalOrderFormData())).rejects.toThrow(
      "REDIRECT:/store/prescriptions/prescription-1?order=failed"
    );

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(actionMocks.createStorePromptPayPayload).not.toHaveBeenCalled();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("blocks before reserving stock or creating an order when PromptPay cannot create a payload", async () => {
    const tx = createTransactionMock();
    useTransaction(tx);
    actionMocks.createStorePromptPayPayload.mockReturnValue(null);

    await expect(createPrescriptionOrderAction(internalOrderFormData())).rejects.toThrow(
      "REDIRECT:/store/prescriptions/prescription-1?order=failed"
    );

    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("uses CAS stock reservation and serializable isolation for external prescription orders", async () => {
    const tx = createTransactionMock();
    useTransaction(tx);

    await expect(createExternalPrescriptionOrderAction(externalOrderFormData())).rejects.toThrow(
      "REDIRECT:/store/orders?created=order-1"
    );

    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: "inventory-1",
        quantity: 5,
        reservedQuantity: 1
      },
      data: {
        reservedQuantity: {
          increment: 1
        }
      }
    });
    expect(actionMocks.createStorePromptPayPayload.mock.invocationCallOrder[0]).toBeLessThan(
      tx.inventory.updateMany.mock.invocationCallOrder[0]
    );
    expect(tx.inventory.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.create.mock.invocationCallOrder[0]
    );
    expect(actionMocks.prismaTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  });

  it("blocks both prescription order actions before opening a transaction when PromptPay is not ready", async () => {
    actionMocks.isStorePromptPayReady.mockReturnValue(false);

    await expect(createPrescriptionOrderAction(internalOrderFormData())).rejects.toThrow(
      "REDIRECT:/store/prescriptions/prescription-1?order=failed"
    );
    await expect(createExternalPrescriptionOrderAction(externalOrderFormData())).rejects.toThrow(
      "REDIRECT:/store/rx-product?prescription=failed"
    );

    expect(actionMocks.prismaTransaction).not.toHaveBeenCalled();
  });

  it("returns a clear limit status before reserving stock when the customer has three pending orders", async () => {
    const tx = createTransactionMock();
    useTransaction(tx);
    actionMocks.assertStorePendingOrderCapacity.mockRejectedValueOnce(
      new StorePendingOrderLimitError()
    );

    await expect(createPrescriptionOrderAction(internalOrderFormData())).rejects.toThrow(
      "REDIRECT:/store/prescriptions/prescription-1?order=limit"
    );

    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
