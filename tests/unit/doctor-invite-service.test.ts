import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findFirst: vi.fn() },
    doctorInvitation: { findMany: vi.fn(), findUnique: vi.fn() }
  },
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  claimDoctorInvitation,
  DoctorInviteError,
  exchangeDoctorInviteToken,
  issueDoctorInvitation,
  listDoctorInvitations,
  revokeDoctorInvitation
} from "@/features/staff-invite/doctor-invite";

const now = new Date("2026-09-16T12:00:00.000Z");
const actorId = "admin-user-1";
const customerId = "customer-user-1";
const idempotencyKey = "00000000-0000-4000-8000-000000000001";

function baseTx() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        where.id === actorId
          ? { role: "admin", status: "active" }
          : {
              id: customerId,
              lineUserId: "U0123456789abcdef0123456789abcdef",
              role: "customer",
              status: "active",
              doctorProfile: null,
              pharmacistProfile: null
            }
      )
    },
    doctorInvitation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    doctor: {
      upsert: vi.fn().mockResolvedValue({ id: "doctor-profile-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    auditLog: { create: vi.fn() }
  };
}

async function issuedTicket() {
  const tx = baseTx();
  tx.doctorInvitation.findUnique.mockResolvedValueOnce(null);
  tx.doctorInvitation.create.mockImplementationOnce(
    async ({ data }: { data: { id: string; expiresAt: Date } }) => ({
      id: data.id,
      expiresAt: data.expiresAt,
      createdAt: now
    })
  );
  const issued = await issueDoctorInvitation(tx as never, {
    actorId,
    idempotencyKey,
    origin: "https://clinical.example",
    now
  });
  const created = tx.doctorInvitation.create.mock.calls[0]?.[0].data;
  mocks.prisma.doctorInvitation.findUnique.mockResolvedValueOnce({
    id: issued.invitationId,
    role: "doctor",
    tokenHash: created.tokenHash,
    expiresAt: issued.expiresAt,
    revokedAt: null
  });
  const exchanged = await exchangeDoctorInviteToken(issued.inviteUrl.split("#")[1], now);
  mocks.writeAuditLog.mockClear();
  return { invitationId: issued.invitationId, expiresAt: issued.expiresAt, ticket: exchanged.ticket };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("JWT_SECRET", "doctor-invite-test-secret-that-is-longer-than-thirty-two-characters");
});

describe("doctor invitation service", () => {
  it("claims once for an active LINE-linked customer and creates only a pending empty Doctor profile", async () => {
    const invite = await issuedTicket();
    const tx = baseTx();
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: invite.invitationId,
      role: "doctor",
      expiresAt: invite.expiresAt,
      claimedAt: null,
      claimedById: null,
      revokedAt: null
    });

    await expect(
      claimDoctorInvitation(tx as never, { userId: customerId, ticket: invite.ticket, now })
    ).resolves.toEqual({
      invitationId: invite.invitationId,
      status: "pending_review",
      unchanged: false
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.doctorInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: invite.invitationId,
        claimedAt: null,
        claimedById: null,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      data: { claimedAt: now, claimedById: customerId }
    });
    expect(tx.doctor.upsert).toHaveBeenCalledWith({
      where: { userId: customerId },
      create: { userId: customerId, status: "pending_review" },
      update: { status: "pending_review", approvedAt: null }
    });
    expect(tx.user).not.toHaveProperty("update");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: customerId,
        action: "doctor_invitation.claim",
        metadata: { role: "doctor", status: "pending_review", claimedAt: now.toISOString() }
      })
    );
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(invite.ticket);
  });

  it("returns the same claimant's pending state without duplicate writes or audit", async () => {
    const invite = await issuedTicket();
    const tx = baseTx();
    tx.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === actorId
        ? { role: "admin", status: "active" }
        : {
            id: customerId,
            lineUserId: "U0123456789abcdef0123456789abcdef",
            role: "customer",
            status: "active",
            doctorProfile: { status: "pending_review" },
            pharmacistProfile: null
          }
    );
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: invite.invitationId,
      role: "doctor",
      expiresAt: invite.expiresAt,
      claimedAt: now,
      claimedById: customerId,
      revokedAt: null
    });

    await expect(
      claimDoctorInvitation(tx as never, { userId: customerId, ticket: invite.ticket, now })
    ).resolves.toMatchObject({ status: "pending_review", unchanged: true });
    expect(tx.doctorInvitation.updateMany).not.toHaveBeenCalled();
    expect(tx.doctor.upsert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("returns only a generic used error to another claimant", async () => {
    const invite = await issuedTicket();
    const tx = baseTx();
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: invite.invitationId,
      role: "doctor",
      expiresAt: invite.expiresAt,
      claimedAt: now,
      claimedById: "different-customer",
      revokedAt: null
    });

    await expect(
      claimDoctorInvitation(tx as never, { userId: customerId, ticket: invite.ticket, now })
    ).rejects.toMatchObject({ code: "INVITATION_USED" } satisfies Partial<DoctorInviteError>);
    expect(tx.doctor.upsert).not.toHaveBeenCalled();
  });

  it("fails closed when the one-time claim compare-and-swap loses a race", async () => {
    const invite = await issuedTicket();
    const tx = baseTx();
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: invite.invitationId,
      role: "doctor",
      expiresAt: invite.expiresAt,
      claimedAt: null,
      claimedById: null,
      revokedAt: null
    });
    tx.doctorInvitation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      claimDoctorInvitation(tx as never, { userId: customerId, ticket: invite.ticket, now })
    ).rejects.toMatchObject({ code: "INVITATION_USED" } satisfies Partial<DoctorInviteError>);
    expect(tx.doctor.upsert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    [{ role: "doctor", status: "active", lineUserId: "Ureal", doctorProfile: null, pharmacistProfile: null }, "CLAIMANT_NOT_ELIGIBLE"],
    [{ role: "customer", status: "suspended", lineUserId: "Ureal", doctorProfile: null, pharmacistProfile: null }, "CLAIMANT_NOT_ELIGIBLE"],
    [{ role: "customer", status: "active", lineUserId: "Ureal", doctorProfile: null, pharmacistProfile: { status: "pending_review" } }, "CONFLICTING_STAFF_PROFILE"]
  ])("rejects an ineligible or conflicting claimant", async (candidate, code) => {
    const invite = await issuedTicket();
    const tx = baseTx();
    tx.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === actorId ? { role: "admin", status: "active" } : { id: customerId, ...candidate }
    );
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: invite.invitationId,
      role: "doctor",
      expiresAt: invite.expiresAt,
      claimedAt: null,
      claimedById: null,
      revokedAt: null
    });

    await expect(
      claimDoctorInvitation(tx as never, { userId: customerId, ticket: invite.ticket, now })
    ).rejects.toMatchObject({ code });
    expect(tx.doctorInvitation.updateMany).not.toHaveBeenCalled();
  });

  it("lets any active Admin revoke a claimed pending invitation and rejects the pending Doctor only", async () => {
    const tx = baseTx();
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: "invite-1",
      role: "doctor",
      claimedById: customerId,
      revokedAt: null,
      claimedBy: { doctorProfile: { status: "pending_review" } }
    });
    tx.doctor.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      revokeDoctorInvitation(tx as never, { actorId, invitationId: "invite-1", now })
    ).resolves.toEqual({
      invitationId: "invite-1",
      unchanged: false,
      pendingDoctorRejected: true
    });
    expect(tx.doctor.updateMany).toHaveBeenCalledWith({
      where: { userId: customerId, status: "pending_review" },
      data: { status: "rejected" }
    });
    expect(tx.user).not.toHaveProperty("update");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId,
        action: "doctor_invitation.revoke",
        metadata: { role: "doctor", status: "revoked", revokedAt: now.toISOString() }
      })
    );
  });

  it("makes repeated revocation idempotent", async () => {
    const tx = baseTx();
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: "invite-1",
      role: "doctor",
      claimedById: customerId,
      revokedAt: now,
      claimedBy: { doctorProfile: { status: "rejected" } }
    });

    await expect(
      revokeDoctorInvitation(tx as never, { actorId, invitationId: "invite-1", now })
    ).resolves.toMatchObject({ unchanged: true });
    expect(tx.doctorInvitation.updateMany).not.toHaveBeenCalled();
    expect(tx.doctor.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("does not treat invitation revocation as an approved-Doctor demotion", async () => {
    const tx = baseTx();
    tx.doctorInvitation.findUnique.mockResolvedValue({
      id: "invite-1",
      role: "doctor",
      claimedById: customerId,
      revokedAt: null,
      claimedBy: { doctorProfile: { status: "approved" } }
    });

    await expect(
      revokeDoctorInvitation(tx as never, { actorId, invitationId: "invite-1", now })
    ).rejects.toMatchObject({ code: "INVITATION_USED" } satisfies Partial<DoctorInviteError>);
    expect(tx.doctorInvitation.updateMany).not.toHaveBeenCalled();
    expect(tx.doctor.updateMany).not.toHaveBeenCalled();
  });

  it("lists token-free invitation metadata only for an active Admin", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({ id: actorId });
    mocks.prisma.doctorInvitation.findMany.mockResolvedValue([
      {
        id: "invite-1",
        createdAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
        claimedAt: null,
        revokedAt: null,
        claimedById: null,
        createdBy: { displayName: "Admin" },
        claimedBy: null
      }
    ]);

    const result = await listDoctorInvitations(actorId, now);
    expect(result).toEqual([
      expect.objectContaining({ id: "invite-1", state: "active", createdByName: "Admin" })
    ]);
    expect(JSON.stringify(result)).not.toMatch(/tokenHash|creationKeyHash|inviteUrl/);

    mocks.prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(listDoctorInvitations("inactive-admin", now)).rejects.toMatchObject({
      code: "ACTIVE_ADMIN_REQUIRED"
    } satisfies Partial<DoctorInviteError>);
  });
});
