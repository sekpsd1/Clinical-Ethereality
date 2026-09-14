import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  consultationFindUnique: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction }
}));

import { POST } from "@/app/api/doctor/consultations/[consultationId]/patient-identity/route";

const fullName = "ข้อมูลทดสอบ ผู้ป่วย";
const nationalId = "1101700203450";
const dateOfBirth = new Date("1990-01-02T00:00:00.000Z");

function request(origin = "https://app.example.test") {
  return new NextRequest(
    "https://app.example.test/api/doctor/consultations/consultation-1/patient-identity",
    { method: "POST", headers: { origin } }
  );
}

function session(role: "doctor" | "admin" | "customer", userId = `${role}-1`) {
  return {
    userId,
    lineUserId: `line-${userId}`,
    role,
    expiresAt: "2030-01-01T00:00:00.000Z"
  };
}

function consultation(overrides: Record<string, unknown> = {}) {
  return {
    id: "consultation-1",
    status: "scheduled",
    patientId: "patient-1",
    doctor: {
      status: "approved",
      user: { id: "doctor-1", status: "active" }
    },
    patient: {
      role: "customer",
      status: "active",
      fullName,
      nationalId,
      dateOfBirth,
      phone: "0812345678",
      normalizedPhone: "+66812345678",
      phoneVerifiedAt: new Date("2029-01-01T00:00:00.000Z")
    },
    ...overrides
  };
}

async function callRoute() {
  return POST(request(), {
    params: Promise.resolve({ consultationId: "consultation-1" })
  });
}

describe("doctor patient identity route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
    mocks.getCurrentSession.mockResolvedValue(session("doctor"));
    mocks.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "patient-1"
        ? consultation().patient
        : { id: "doctor-1", role: "doctor", status: "active" }
    );
    mocks.consultationFindUnique.mockResolvedValue(consultation());
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(
      async (operation: (tx: object) => Promise<unknown>) =>
        operation({
          user: { findUnique: mocks.userFindUnique },
          consultation: { findUnique: mocks.consultationFindUnique },
          auditLog: { create: mocks.auditCreate }
        })
    );
  });

  it("returns only the assigned doctor's three requested identity fields with private headers", async () => {
    const response = await callRoute();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      identity: {
        fullName,
        nationalId,
        dateOfBirth: "1990-01-02"
      }
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");

    const audit = mocks.auditCreate.mock.calls[0]?.[0]?.data;
    expect(audit).toMatchObject({
      actorId: "doctor-1",
      action: "consultation.patient_identity_view",
      entityType: "consultation",
      entityId: "consultation-1",
      metadataJson: {
        actorRole: "doctor",
        accessContext: "assigned_doctor"
      }
    });
    expect(JSON.stringify(audit)).not.toContain(fullName);
    expect(JSON.stringify(audit)).not.toContain(nationalId);
    expect(JSON.stringify(audit)).not.toContain("1990-01-02");
  });

  it("allows active Admin support under the existing assigned-consultation permission", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("admin"));
    mocks.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "patient-1"
        ? consultation().patient
        : { id: "admin-1", role: "admin", status: "active" }
    );

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(mocks.auditCreate.mock.calls[0]?.[0]?.data.metadataJson).toEqual({
      actorRole: "admin",
      accessContext: "admin_support"
    });
  });

  it("denies another doctor without writing an audit", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("doctor", "doctor-2"));
    mocks.userFindUnique.mockResolvedValue({ id: "doctor-2", role: "doctor", status: "active" });

    const response = await callRoute();

    expect(response.status).toBe(403);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("denies a customer before reading the consultation", async () => {
    mocks.getCurrentSession.mockResolvedValue(session("customer"));

    const response = await callRoute();

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies an unauthenticated request", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("denies an inactive actor even when an access token still exists", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "doctor-1", role: "doctor", status: "inactive" });

    const response = await callRoute();

    expect(response.status).toBe(403);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("limits access to scheduled and live consultations", async () => {
    mocks.consultationFindUnique.mockResolvedValue(consultation({ status: "completed" }));

    const response = await callRoute();

    expect(response.status).toBe(409);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("reports incomplete identity generically and never returns a partial record", async () => {
    mocks.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "patient-1"
        ? { ...consultation().patient, nationalId: null }
        : { id: "doctor-1", role: "doctor", status: "active" }
    );

    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      message: "ข้อมูลยืนยันตัวตนยังไม่พร้อม กรุณาให้ลูกค้ายืนยันตัวตนก่อน"
    });
    expect(JSON.stringify(body)).not.toContain(fullName);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects cross-origin POST before session or data access", async () => {
    const response = await POST(request("https://attacker.example"), {
      params: Promise.resolve({ consultationId: "consultation-1" })
    });

    expect(response.status).toBe(403);
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
