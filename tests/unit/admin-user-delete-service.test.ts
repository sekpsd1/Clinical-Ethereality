import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  deleteUserPermanently,
  UserDeletionError
} from "@/features/admin/users/delete-service";

function emptyModel() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 })
  };
}

function createTransaction() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "user-1" }]),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "user-1",
        doctorProfile: null,
        pharmacistProfile: null
      }),
      delete: vi.fn().mockResolvedValue({ id: "user-1" })
    },
    consultAssessment: emptyModel(),
    consultation: emptyModel(),
    prescription: emptyModel(),
    order: emptyModel(),
    payment: emptyModel(),
    article: emptyModel(),
    comment: emptyModel(),
    like: emptyModel(),
    savedArticle: emptyModel(),
    communityReport: emptyModel(),
    fileAttachment: emptyModel(),
    consentRecord: emptyModel(),
    telemedicineConsent: emptyModel(),
    authSession: emptyModel(),
    consultationMessage: emptyModel(),
    shippingAddress: emptyModel(),
    notification: emptyModel(),
    rewardPoint: emptyModel(),
    consultationSlotLock: emptyModel(),
    inventory: emptyModel(),
    shipmentTracking: emptyModel(),
    auditLog: emptyModel(),
    phoneVerificationChallenge: emptyModel(),
    consultationRecordingWebhookEvent: emptyModel(),
    consultationRecording: emptyModel(),
    consultationAttendanceEvent: emptyModel(),
    consultationAttendanceCredential: emptyModel(),
    orderItem: emptyModel(),
    orderShippingAddress: emptyModel(),
    doctorAvailability: emptyModel(),
    doctorAvailabilityDateOverride: emptyModel()
  };
}

describe("Admin permanent user deletion service", () => {
  it("deletes a customer and related records without creating a replacement audit", async () => {
    const tx = createTransaction();
    tx.order.findMany.mockResolvedValueOnce([
      {
        id: "order-pending",
        status: "pending_payment",
        items: [{ id: "item-1", productId: "product-1", quantity: 3 }]
      },
      {
        id: "order-paid",
        status: "paid",
        items: [{ id: "item-2", productId: "product-2", quantity: 2 }]
      }
    ]);
    tx.payment.findMany.mockResolvedValueOnce([{ id: "payment-1" }]);
    tx.authSession.findMany.mockResolvedValueOnce([{ id: "session-1" }]);
    tx.phoneVerificationChallenge.findMany.mockResolvedValueOnce([{ id: "challenge-1" }]);
    tx.inventory.findMany.mockResolvedValueOnce([
      { productId: "product-1", quantity: 10, reservedQuantity: 2 },
      { productId: "product-2", quantity: 7, reservedQuantity: 0 }
    ]);

    const result = await deleteUserPermanently(tx as unknown as Prisma.TransactionClient, {
      actorId: "admin-1",
      userId: "user-1"
    });

    expect(result.removedUserId).toBe("user-1");
    expect(tx.inventory.update).toHaveBeenCalledWith({
      where: { productId: "product-1" },
      data: { quantity: 10, reservedQuantity: 0 }
    });
    expect(tx.inventory.update).toHaveBeenCalledWith({
      where: { productId: "product-2" },
      data: { quantity: 9, reservedQuantity: 0 }
    });
    expect(tx.payment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["payment-1"] } }
    });
    expect(tx.order.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-pending", "order-paid"] } }
    });
    expect(tx.auditLog.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["session-1"] } } });
    expect(tx.phoneVerificationChallenge.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["challenge-1"] } }
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("includes a doctor's consultations, prescriptions, schedules, and slot locks", async () => {
    const tx = createTransaction();
    tx.user.findUnique.mockResolvedValueOnce({
      id: "doctor-user-1",
      doctorProfile: { id: "doctor-1" },
      pharmacistProfile: null
    });
    tx.consultation.findMany.mockResolvedValueOnce([
      { id: "consultation-1", slotLockId: "slot-1" }
    ]);
    tx.prescription.findMany.mockResolvedValueOnce([{ id: "prescription-1" }]);
    tx.doctorAvailability.findMany.mockResolvedValueOnce([{ id: "schedule-1" }]);
    tx.doctorAvailabilityDateOverride.findMany.mockResolvedValueOnce([{ id: "override-1" }]);
    tx.consultationSlotLock.findMany.mockResolvedValueOnce([{ id: "slot-1" }]);
    tx.notification.findMany.mockResolvedValueOnce([
      {
        id: "doctor-notification",
        userId: "doctor-user-1",
        metadataJson: null
      },
      {
        id: "patient-notification",
        userId: "patient-1",
        metadataJson: {
          consultationId: "consultation-1",
          href: "/consult/appointments/consultation-1"
        }
      },
      {
        id: "unrelated-notification",
        userId: "patient-2",
        metadataJson: {
          consultationId: "consultation-2",
          href: "/consult/appointments/consultation-2"
        }
      }
    ]);

    await deleteUserPermanently(tx as unknown as Prisma.TransactionClient, {
      actorId: "admin-1",
      userId: "doctor-user-1"
    });

    expect(tx.consultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ patientId: "doctor-user-1" }, { doctorId: "doctor-1" }] }
      })
    );
    expect(tx.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { patientId: "doctor-user-1" },
            { doctorId: "doctor-1" },
            { consultationId: { in: ["consultation-1"] } }
          ]
        }
      })
    );
    expect(tx.consultationSlotLock.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { patientId: "doctor-user-1" },
          { doctorId: "doctor-1" },
          { id: "slot-1" }
        ]
      },
      select: { id: true }
    });
    expect(tx.consultationSlotLock.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["slot-1"] } }
    });
    expect(tx.notification.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "doctor-user-1" },
          { type: { in: ["consultation", "payment", "prescription"] } }
        ]
      },
      select: {
        id: true,
        userId: true,
        metadataJson: true
      }
    });
    expect(tx.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["doctor-notification", "patient-notification"] } }
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "doctor-user-1" } });
  });

  it("removes notifications that link to an article deleted with its author", async () => {
    const tx = createTransaction();
    tx.article.findMany.mockResolvedValueOnce([{ id: "article-1", slug: "deleted-post" }]);
    tx.notification.findMany.mockResolvedValueOnce([
      {
        id: "linked-by-id",
        userId: "admin-2",
        metadataJson: { articleId: "article-1", href: "/admin/moderation" }
      },
      {
        id: "linked-by-route",
        userId: "customer-2",
        metadataJson: { href: "/community/deleted-post" }
      },
      {
        id: "other-post",
        userId: "customer-3",
        metadataJson: { href: "/community/kept-post" }
      }
    ]);

    await deleteUserPermanently(tx as unknown as Prisma.TransactionClient, {
      actorId: "admin-1",
      userId: "user-1"
    });

    expect(tx.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["linked-by-id", "linked-by-route"] } }
    });
  });

  it("rejects deleting the currently signed-in Admin before database access", async () => {
    const tx = createTransaction();

    await expect(
      deleteUserPermanently(tx as unknown as Prisma.TransactionClient, {
        actorId: "admin-1",
        userId: "admin-1"
      })
    ).rejects.toEqual(new UserDeletionError("SELF_DELETE"));

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});
