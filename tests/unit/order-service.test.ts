import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  applyOrderFulfillmentTransition,
  assertOrderFulfillmentTransition,
  assertPrescriptionReadyForDispensing,
  getOrderFulfillmentTransition,
  shouldMarkPrescriptionDispensed
} from "@/features/orders/service";

describe("order fulfillment service", () => {
  it.each([
    ["mark_preparing", "paid", "preparing"],
    ["mark_shipped", "preparing", "shipped"],
    ["mark_delivered", "shipped", "delivered"]
  ] as const)("maps %s from %s to %s", (action, from, to) => {
    expect(getOrderFulfillmentTransition(action)).toMatchObject({
      from,
      to
    });
    expect(assertOrderFulfillmentTransition(from, action)).toMatchObject({
      from,
      to
    });
  });

  it("rejects invalid fulfillment jumps", () => {
    expect(() => assertOrderFulfillmentTransition("pending_payment", "mark_shipped")).toThrow(
      "Order must be preparing before it can move to shipped."
    );
  });

  it.each(["pending_verification", "verified"] as const)("marks an order-ready %s prescription as dispensed", (status) => {
    expect(shouldMarkPrescriptionDispensed(status)).toBe(true);
    expect(() => assertPrescriptionReadyForDispensing(status)).not.toThrow();
  });

  it("accepts an already dispensed prescription without writing it again", () => {
    expect(shouldMarkPrescriptionDispensed("dispensed")).toBe(false);
    expect(() => assertPrescriptionReadyForDispensing("dispensed")).not.toThrow();
  });

  it.each(["draft", "rejected", "archived"] as const)("blocks shipping a linked %s prescription", (status) => {
    expect(() => assertPrescriptionReadyForDispensing(status)).toThrow(
      "Linked prescription is not ready for dispensing."
    );
  });

  it("records the admin shipment and closes its linked prescription", async () => {
    const orderUpdateMany = vi.fn().mockResolvedValue({
      count: 1
    });
    const prescriptionUpdateMany = vi.fn().mockResolvedValue({
      count: 1
    });
    const shipmentUpdate = vi.fn().mockResolvedValue({
      id: "shipment-1"
    });
    const auditCreate = vi.fn().mockResolvedValue({
      id: "audit-1"
    });
    const tx = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          status: "preparing",
          items: [
            {
              prescriptionId: "prescription-1"
            }
          ],
          shipments: [
            {
              id: "shipment-1"
            }
          ]
        }),
        updateMany: orderUpdateMany
      },
      prescription: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "prescription-1",
            status: "verified"
          }
        ]),
        updateMany: prescriptionUpdateMany
      },
      shipmentTracking: {
        update: shipmentUpdate
      },
      auditLog: {
        create: auditCreate
      }
    } as unknown as Prisma.TransactionClient;

    await applyOrderFulfillmentTransition(tx, {
      orderId: "order-1",
      action: "mark_shipped",
      actorId: "admin-1",
      auditMetadata: {
        actorRole: "admin",
        surface: "admin"
      }
    });

    expect(orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        status: "preparing"
      },
      data: {
        status: "shipped"
      }
    });
    expect(prescriptionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "prescription-1",
        status: "verified"
      },
      data: {
        status: "dispensed"
      }
    });
    expect(shipmentUpdate).toHaveBeenCalledWith({
      where: {
        id: "shipment-1"
      },
      data: {
        status: "shipped",
        updatedById: "admin-1"
      }
    });
    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-1",
        action: "prescription.dispensed",
        entityType: "prescription",
        entityId: "prescription-1"
      })
    });
  });
});
