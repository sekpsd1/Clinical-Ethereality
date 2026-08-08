import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  noStore: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_noStore: mocks.noStore,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    prescription: {
      findFirst: mocks.findFirst,
    },
    product: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: mocks.assertPermission,
}));

import { getPrescriptionOrderData } from "@/features/products/prescriptions/queries";

const session = {
  displayName: "Customer",
  expiresAt: "2026-08-08T00:00:00.000Z",
  lineUserId: "line-customer",
  role: "customer",
  userId: "customer-1",
} as const;

function prescriptionWithOrders(
  orders: Array<{ id: string; status: string }>,
) {
  return {
    doctor: {
      user: {
        displayName: "Doctor",
      },
    },
    id: "prescription-1",
    itemsJson: [
      {
        dosage: "500 mg",
        instructions: "Take as directed",
        medicationName: "Doctor-selected product",
        productId: "product-1",
        quantity: "2",
      },
    ],
    notes: null,
    orderItems: orders.map((order) => ({
      order,
      product: { id: "product-1" },
    })),
    pharmacist: null,
    patientId: "customer-1",
    status: "verified",
    verifiedAt: null,
  };
}

describe("getPrescriptionOrderData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "product-1",
        inventory: {
          quantity: 10,
          reservedQuantity: 0,
        },
        name: "Doctor-selected product",
        price: 125,
        shortDescription: null,
        slug: "doctor-selected-product",
      },
    ]);
  });

  it.each(["cancelled", "refunded"])(
    "allows a new order when the only linked order is %s",
    async (status) => {
      mocks.findFirst.mockResolvedValue(
        prescriptionWithOrders([{ id: "old-order", status }]),
      );

      const data = await getPrescriptionOrderData(
        session,
        "prescription-1",
      );

      expect(data.prescription?.linkedOrderCode).toBeNull();
      expect(data.prescription?.products).toHaveLength(1);
    },
  );

  it.each([
    "pending_payment",
    "payment_review",
    "paid",
    "preparing",
    "shipped",
    "delivered",
  ])("keeps the retry action hidden for an active order in %s", async (status) => {
    mocks.findFirst.mockResolvedValue(
      prescriptionWithOrders([{ id: "active123456", status }]),
    );

    const data = await getPrescriptionOrderData(session, "prescription-1");

    expect(data.prescription?.linkedOrderCode).toBe("CE-123456");
  });

  it("prefers an active order when an older cancelled order also exists", async () => {
    mocks.findFirst.mockResolvedValue(
      prescriptionWithOrders([
        { id: "cancelled-order", status: "cancelled" },
        { id: "active123456", status: "pending_payment" },
      ]),
    );

    const data = await getPrescriptionOrderData(session, "prescription-1");

    expect(data.prescription?.linkedOrderCode).toBe("CE-123456");
  });

  it("retains the existing customer ownership and permission checks", async () => {
    mocks.findFirst.mockResolvedValue(
      prescriptionWithOrders([{ id: "old-order", status: "cancelled" }]),
    );

    await getPrescriptionOrderData(session, "prescription-1");

    expect(mocks.assertPermission).toHaveBeenCalledWith(
      session,
      "prescription:read:self",
    );
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "prescription-1",
          patientId: "customer-1",
        },
      }),
    );
  });
});
