import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  consultationFindFirst: vi.fn(),
  messageCount: vi.fn(),
  messageFindMany: vi.fn(),
  writeAuditLog: vi.fn(),
  noStore: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: mocks.noStore }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

import {
  consultationChatHistoryPageSize,
  getConsultationChatHistory
} from "@/features/consultations/chat/history-queries";

const customerSession: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

const doctorSession: PublicSession = {
  userId: "doctor-user-1",
  lineUserId: "line-doctor-1",
  role: "doctor",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

const consultation = {
  id: "consultation-1",
  patient: { displayName: "ผู้รับบริการหนึ่ง" },
  doctor: { user: { displayName: "พญ. แพทย์หนึ่ง" } }
};

function message(index: number) {
  return {
    id: `message-${String(index).padStart(3, "0")}`,
    body: `sensitive body ${index}`,
    senderId: index % 2 === 0 ? customerSession.userId : doctorSession.userId,
    createdAt: new Date(`2030-01-01T00:${String(index % 60).padStart(2, "0")}:00.000Z`),
    sender: {
      displayName: index % 2 === 0 ? "ผู้รับบริการหนึ่ง" : "พญ. แพทย์หนึ่ง",
      lineUserId: `line-sender-${index}`,
      role: index % 2 === 0 ? "customer" : "doctor"
    }
  } as const;
}

describe("consultation chat history authorization and pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: object) => unknown) =>
      callback({
        consultation: { findFirst: mocks.consultationFindFirst },
        consultationMessage: {
          count: mocks.messageCount,
          findMany: mocks.messageFindMany
        }
      })
    );
    mocks.consultationFindFirst.mockResolvedValue(consultation);
    mocks.messageCount.mockResolvedValue(1);
    mocks.messageFindMany.mockResolvedValue([message(1)]);
  });

  it("allows only the active owning customer on a completed consultation", async () => {
    const result = await getConsultationChatHistory(customerSession, "consultation-1", "customer");

    expect(result).toMatchObject({
      consultationId: "consultation-1",
      viewerRole: "customer",
      counterpartName: "พญ. แพทย์หนึ่ง"
    });
    expect(mocks.consultationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-1",
          status: "completed",
          patient: {
            id: "customer-1",
            role: "customer",
            status: "active"
          }
        }
      })
    );
  });

  it("allows only the active approved doctor assigned to the completed consultation", async () => {
    const result = await getConsultationChatHistory(doctorSession, "consultation-1", "doctor");

    expect(result).toMatchObject({
      consultationId: "consultation-1",
      viewerRole: "doctor",
      counterpartName: "ผู้รับบริการหนึ่ง"
    });
    expect(mocks.consultationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-1",
          status: "completed",
          doctor: {
            userId: "doctor-user-1",
            status: "approved",
            user: {
              role: "doctor",
              status: "active"
            }
          }
        }
      })
    );
  });

  it.each([
    [{ ...customerSession, role: "admin" as const }, "customer" as const],
    [{ ...doctorSession, role: "admin" as const }, "doctor" as const],
    [customerSession, "doctor" as const],
    [doctorSession, "customer" as const],
    [{ ...customerSession, userId: "dev:customer" }, "customer" as const]
  ])("denies role mismatch, admin, and development sessions before reading messages", async (session, role) => {
    await expect(
      getConsultationChatHistory(session, "consultation-1", role)
    ).resolves.toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.messageFindMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("fails closed for inactive, unassigned, other-customer, and guessed consultation URLs", async () => {
    mocks.consultationFindFirst.mockResolvedValue(null);

    await expect(
      getConsultationChatHistory(customerSession, "guessed-consultation", "customer")
    ).resolves.toBeNull();
    await expect(
      getConsultationChatHistory(doctorSession, "other-doctor-consultation", "doctor")
    ).resolves.toBeNull();

    expect(mocks.messageFindMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    expect(mocks.consultationFindFirst.mock.calls[0][0].where.patient.status).toBe("active");
    expect(mocks.consultationFindFirst.mock.calls[1][0].where.doctor.user.status).toBe("active");
  });

  it("pages deterministically without skips, duplicates, or cross-consultation reads", async () => {
    const allMessages = Array.from({ length: 51 }, (_, index) => message(index + 1));
    mocks.messageCount.mockResolvedValue(allMessages.length);
    mocks.messageFindMany.mockImplementation(async ({ skip, take }: { skip: number; take: number }) =>
      allMessages.slice(skip, skip + take)
    );

    const firstPage = await getConsultationChatHistory(customerSession, "consultation-1", "customer", 1);
    const secondPage = await getConsultationChatHistory(customerSession, "consultation-1", "customer", 2);
    const firstIds = firstPage?.messages.map(({ id }) => id) ?? [];
    const secondIds = secondPage?.messages.map(({ id }) => id) ?? [];

    expect(consultationChatHistoryPageSize).toBe(50);
    expect(firstIds).toHaveLength(50);
    expect(secondIds).toEqual(["message-051"]);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(51);
    expect(mocks.messageFindMany.mock.calls[0][0]).toMatchObject({
      where: { consultationId: "consultation-1", status: "visible" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: 0,
      take: 50
    });
    expect(mocks.messageFindMany.mock.calls[1][0]).toMatchObject({
      where: { consultationId: "consultation-1", status: "visible" },
      skip: 50,
      take: 50
    });
  });

  it("audits only the consultation, displayed message identifiers, and actor without content", async () => {
    await getConsultationChatHistory(customerSession, "consultation-1", "customer");

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorId: "customer-1",
        action: "consultation_message.history_view",
        entityType: "consultation",
        entityId: "consultation-1",
        metadata: {
          consultationId: "consultation-1",
          messageIds: ["message-001"]
        }
      }
    );
    const auditPayload = JSON.stringify(mocks.writeAuditLog.mock.calls[0][1]);
    expect(auditPayload).not.toContain("sensitive body");
    expect(auditPayload).not.toContain("พญ. แพทย์หนึ่ง");
  });
});
