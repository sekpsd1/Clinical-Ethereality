import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class DoctorInviteError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }

  return {
    DoctorInviteError,
    claimDoctorInvitation: vi.fn(),
    exchangeDoctorInviteToken: vi.fn(),
    getCurrentSession: vi.fn(),
    hasPendingDoctorInvitation: vi.fn(),
    inspectDoctorInviteTicket: vi.fn(),
    transaction: vi.fn(),
    userFindUnique: vi.fn()
  };
});

vi.mock("@/lib/auth/line-oauth", () => ({
  getPublicAppOrigin: (fallbackOrigin: string) => fallbackOrigin
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.getCurrentSession }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    user: { findUnique: mocks.userFindUnique }
  }
}));
vi.mock("@/features/staff-invite/pending-doctor", () => ({
  hasPendingDoctorInvitation: mocks.hasPendingDoctorInvitation
}));
vi.mock("@/features/staff-invite/doctor-invite", () => ({
  DoctorInviteError: mocks.DoctorInviteError,
  claimDoctorInvitation: mocks.claimDoctorInvitation,
  doctorInviteLimits: { rawTokenMaxLength: 191 },
  exchangeDoctorInviteToken: mocks.exchangeDoctorInviteToken,
  getDoctorInviteCookieName: () => "ce_doctor_invite",
  getDoctorInviteCookieOptions: (maxAge = 900) => ({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/doctor-invite",
    maxAge
  }),
  inspectDoctorInviteTicket: mocks.inspectDoctorInviteTicket
}));

import { POST as exchange } from "@/app/doctor-invite/api/exchange/route";
import { POST as claim } from "@/app/doctor-invite/api/claim/route";
import { GET as context } from "@/app/doctor-invite/api/context/route";

const rawToken = `v1.${"1".repeat(36)}.${"a".repeat(43)}`;

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://app.example${path}`, init);
}

describe("Doctor invitation HTTP boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPendingDoctorInvitation.mockResolvedValue(false);
    mocks.transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({}));
  });

  it("exchanges a same-origin fragment token for a scoped HttpOnly cookie", async () => {
    mocks.exchangeDoctorInviteToken.mockResolvedValue({
      ticket: "signed-ticket-value",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const response = await exchange(
      request("/doctor-invite/api/exchange", {
        method: "POST",
        headers: { origin: "https://app.example", "content-type": "application/json" },
        body: JSON.stringify({ token: rawToken })
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.exchangeDoctorInviteToken).toHaveBeenCalledWith(rawToken);
    expect(response.cookies.get("ce_doctor_invite")?.value).toBe("signed-ticket-value");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).not.toContain(rawToken);
  });

  it("rejects cross-origin token exchange before reading the token", async () => {
    const response = await exchange(
      request("/doctor-invite/api/exchange", {
        method: "POST",
        headers: { origin: "https://attacker.example", "content-type": "application/json" },
        body: JSON.stringify({ token: rawToken })
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.exchangeDoctorInviteToken).not.toHaveBeenCalled();
  });

  it("requires a real active customer session before claim", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const response = await claim(
      request("/doctor-invite/api/claim", {
        method: "POST",
        headers: { origin: "https://app.example", cookie: "ce_doctor_invite=signed-ticket-value" }
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("claims explicitly in a serializable transaction and clears the ticket", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.claimDoctorInvitation.mockResolvedValue({ status: "pending_review" });

    const response = await claim(
      request("/doctor-invite/api/claim", {
        method: "POST",
        headers: { origin: "https://app.example", cookie: "ce_doctor_invite=signed-ticket-value" }
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.claimDoctorInvitation).toHaveBeenCalledWith(
      expect.anything(),
      { userId: "customer-1", ticket: "signed-ticket-value" }
    );
    expect(response.cookies.get("ce_doctor_invite")?.value).toBe("");
  });

  it("keeps the raw token out of the login URL while retaining the short-lived ticket", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    mocks.inspectDoctorInviteTicket.mockResolvedValue({
      state: "active",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const response = await context(
      request("/doctor-invite/api/context", {
        headers: { cookie: "ce_doctor_invite=signed-ticket-value" }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ state: "login_required" });
    expect(mocks.inspectDoctorInviteTicket).toHaveBeenCalledWith("signed-ticket-value", undefined);
  });

  it("uses a valid new invitation even when the customer has an older revoked doctor invitation", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.userFindUnique.mockResolvedValue({
      role: "customer",
      status: "active",
      doctorProfile: { status: "rejected" },
      claimedDoctorInvitations: [{ revokedAt: new Date("2026-09-19T06:43:00.000Z") }]
    });
    mocks.inspectDoctorInviteTicket.mockResolvedValue({
      state: "active",
      expiresAt: new Date("2026-10-10T06:43:00.000Z")
    });

    const response = await context(
      request("/doctor-invite/api/context", {
        headers: { cookie: "ce_doctor_invite=fresh-signed-ticket" }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: "ready",
      expiresAt: "2026-10-10T06:43:00.000Z"
    });
    expect(mocks.inspectDoctorInviteTicket).toHaveBeenCalledWith("fresh-signed-ticket", "customer-1");
    expect(mocks.claimDoctorInvitation).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("still reports revoked history when there is no current invitation ticket", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.userFindUnique.mockResolvedValue({
      role: "customer",
      status: "active",
      doctorProfile: { status: "rejected" },
      claimedDoctorInvitations: [{ revokedAt: new Date("2026-09-19T06:43:00.000Z") }]
    });

    const response = await context(request("/doctor-invite/api/context"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, state: "revoked" });
    expect(mocks.inspectDoctorInviteTicket).not.toHaveBeenCalled();
  });

  it.each(["revoked", "expired", "used"] as const)(
    "rejects a current invitation ticket in the %s state",
    async (state) => {
      mocks.getCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
      mocks.userFindUnique.mockResolvedValue({
        role: "customer",
        status: "active",
        doctorProfile: { status: "rejected" },
        claimedDoctorInvitations: [{ revokedAt: new Date("2026-09-19T06:43:00.000Z") }]
      });
      mocks.inspectDoctorInviteTicket.mockResolvedValue({
        state,
        expiresAt: new Date("2026-10-10T06:43:00.000Z")
      });

      const response = await context(
        request("/doctor-invite/api/context", {
          headers: { cookie: "ce_doctor_invite=current-signed-ticket" }
        })
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ ok: false, state: "unavailable" });
      expect(response.cookies.get("ce_doctor_invite")?.value).toBe("");
      expect(mocks.claimDoctorInvitation).not.toHaveBeenCalled();
    }
  );

  it("does not allow a non-customer account to use an active invitation", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.userFindUnique.mockResolvedValue({
      role: "admin",
      status: "active",
      doctorProfile: null,
      claimedDoctorInvitations: []
    });
    mocks.inspectDoctorInviteTicket.mockResolvedValue({
      state: "active",
      expiresAt: new Date("2026-10-10T06:43:00.000Z")
    });

    const response = await context(
      request("/doctor-invite/api/context", {
        headers: { cookie: "ce_doctor_invite=current-signed-ticket" }
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, state: "wrong_account" });
    expect(mocks.claimDoctorInvitation).not.toHaveBeenCalled();
  });
});
