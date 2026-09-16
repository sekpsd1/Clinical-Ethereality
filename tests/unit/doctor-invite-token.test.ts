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
  DoctorInviteError,
  doctorInviteLimits,
  exchangeDoctorInviteToken,
  getDoctorInviteCookieName,
  getDoctorInviteCookieOptions,
  inspectDoctorInviteTicket,
  issueDoctorInvitation
} from "@/features/staff-invite/doctor-invite";

const now = new Date("2026-09-16T12:00:00.000Z");
const actorId = "admin-user-1";
const idempotencyKey = "00000000-0000-4000-8000-000000000001";

function issueTransaction() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: actorId }]),
    user: {
      findUnique: vi.fn().mockResolvedValue({ role: "admin", status: "active" })
    },
    doctorInvitation: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: { id: string; expiresAt: Date } }) => ({
        id: data.id,
        expiresAt: data.expiresAt,
        createdAt: now
      }))
    },
    auditLog: { create: vi.fn() }
  };
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("JWT_SECRET", "doctor-invite-test-secret-that-is-longer-than-thirty-two-characters");
  vi.stubEnv("NODE_ENV", "test");
});

describe("doctor invitation token security", () => {
  it("rechecks that the issuing actor is an active Admin inside the transaction", async () => {
    const tx = issueTransaction();
    tx.user.findUnique.mockResolvedValueOnce({ role: "admin", status: "suspended" });

    await expect(
      issueDoctorInvitation(tx as never, {
        actorId,
        idempotencyKey,
        origin: "https://clinical.example",
        now
      })
    ).rejects.toMatchObject({ code: "ACTIVE_ADMIN_REQUIRED" } satisfies Partial<DoctorInviteError>);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.doctorInvitation.create).not.toHaveBeenCalled();
  });

  it("issues a deterministic fragment-only 24-hour invite while persisting hashes only", async () => {
    const tx = issueTransaction();
    const first = await issueDoctorInvitation(tx as never, {
      actorId,
      idempotencyKey,
      origin: "https://clinical.example/some/path",
      now
    });
    const created = tx.doctorInvitation.create.mock.calls[0]?.[0].data as unknown as {
      tokenHash: string;
      creationKeyHash: string;
    };

    expect(first.expiresAt.getTime() - now.getTime()).toBe(doctorInviteLimits.invitationTtlMs);
    expect(first.inviteUrl).toMatch(/^https:\/\/clinical\.example\/doctor-invite#v1\./);
    expect(new URL(first.inviteUrl).search).toBe("");
    expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(created.creationKeyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(created)).not.toContain(first.inviteUrl.split("#")[1]);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId,
        action: "doctor_invitation.issue",
        entityType: "doctor_invitation",
        metadata: {
          role: "doctor",
          status: "active",
          createdAt: now.toISOString(),
          expiresAt: first.expiresAt.toISOString()
        }
      })
    );
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(first.inviteUrl.split("#")[1]);

    tx.doctorInvitation.findUnique.mockResolvedValueOnce({
      id: first.invitationId,
      role: "doctor",
      tokenHash: created.tokenHash,
      createdById: actorId,
      expiresAt: first.expiresAt
    });
    const repeated = await issueDoctorInvitation(tx as never, {
      actorId,
      idempotencyKey,
      origin: "https://clinical.example",
      now: new Date(now.getTime() + 1_000)
    });

    expect(repeated).toMatchObject({ inviteUrl: first.inviteUrl, reused: true });
    expect(tx.doctorInvitation.create).toHaveBeenCalledTimes(1);
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("exchanges the raw bearer for a short-lived signed ticket and inspects only safe context", async () => {
    const tx = issueTransaction();
    const issued = await issueDoctorInvitation(tx as never, {
      actorId,
      idempotencyKey,
      origin: "https://clinical.example",
      now
    });
    const rawToken = issued.inviteUrl.split("#")[1];
    const created = tx.doctorInvitation.create.mock.calls[0]?.[0].data as unknown as {
      tokenHash: string;
    };

    mocks.prisma.doctorInvitation.findUnique
      .mockResolvedValueOnce({
        id: issued.invitationId,
        role: "doctor",
        tokenHash: created.tokenHash,
        expiresAt: issued.expiresAt,
        revokedAt: null
      })
      .mockResolvedValueOnce({
        id: issued.invitationId,
        role: "doctor",
        expiresAt: issued.expiresAt,
        claimedAt: null,
        claimedById: null,
        revokedAt: null,
        claimedBy: null
      });

    const exchanged = await exchangeDoctorInviteToken(rawToken, now);
    expect(exchanged.ticket).not.toContain(rawToken);
    expect(exchanged.expiresAt.getTime() - now.getTime()).toBe(doctorInviteLimits.cookieTicketTtlMs);
    await expect(inspectDoctorInviteTicket(exchanged.ticket, undefined, now)).resolves.toEqual({
      invitationId: issued.invitationId,
      state: "active",
      expiresAt: issued.expiresAt,
      claimedAt: null,
      canClaim: true
    });
  });

  it("does not exchange a raw link again after the invitation has been claimed", async () => {
    const tx = issueTransaction();
    const issued = await issueDoctorInvitation(tx as never, {
      actorId,
      idempotencyKey,
      origin: "https://clinical.example",
      now
    });
    const rawToken = issued.inviteUrl.split("#")[1];
    const created = tx.doctorInvitation.create.mock.calls[0]?.[0].data as unknown as {
      tokenHash: string;
    };
    mocks.prisma.doctorInvitation.findUnique.mockResolvedValueOnce({
      id: issued.invitationId,
      role: "doctor",
      tokenHash: created.tokenHash,
      expiresAt: issued.expiresAt,
      claimedAt: now,
      claimedById: "customer-1",
      revokedAt: null
    });

    await expect(exchangeDoctorInviteToken(rawToken, now)).rejects.toMatchObject({
      code: "INVITATION_USED"
    } satisfies Partial<DoctorInviteError>);
  });

  it("rejects a modified cookie ticket before looking up an invitation", async () => {
    const tx = issueTransaction();
    const issued = await issueDoctorInvitation(tx as never, {
      actorId,
      idempotencyKey,
      origin: "https://clinical.example",
      now
    });
    const rawToken = issued.inviteUrl.split("#")[1];
    const created = tx.doctorInvitation.create.mock.calls[0]?.[0].data as unknown as {
      tokenHash: string;
    };
    mocks.prisma.doctorInvitation.findUnique.mockResolvedValueOnce({
      id: issued.invitationId,
      role: "doctor",
      tokenHash: created.tokenHash,
      expiresAt: issued.expiresAt,
      revokedAt: null
    });
    const { ticket } = await exchangeDoctorInviteToken(rawToken, now);

    await expect(inspectDoctorInviteTicket(`${ticket.slice(0, -1)}x`, undefined, now)).rejects.toMatchObject({
      code: "INVALID_INVITATION"
    } satisfies Partial<DoctorInviteError>);
    expect(mocks.prisma.doctorInvitation.findUnique).toHaveBeenCalledTimes(1);
  });

  it("exposes a narrowly scoped HttpOnly cookie contract", () => {
    expect(getDoctorInviteCookieName()).toBe("ce_doctor_invite");
    expect(getDoctorInviteCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/doctor-invite",
      maxAge: 15 * 60
    });
  });

  it("fails closed when JWT_SECRET is unavailable", async () => {
    vi.stubEnv("JWT_SECRET", "");
    const tx = issueTransaction();
    await expect(
      issueDoctorInvitation(tx as never, {
        actorId,
        idempotencyKey,
        origin: "https://clinical.example",
        now
      })
    ).rejects.toMatchObject({ code: "INVITATION_STATE_INVALID" } satisfies Partial<DoctorInviteError>);
    expect(tx.doctorInvitation.create).not.toHaveBeenCalled();
  });
});
