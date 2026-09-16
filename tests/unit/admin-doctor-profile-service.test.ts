import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import { manageAdminDoctorProfile } from "@/features/admin/users/doctor-profile-service";
import { manageDoctorProfileSchema } from "@/features/admin/users/schema";

const completeData = {
  userId: "doctor-user-1",
  intent: "approve" as const,
  fullName: "แพทย์ ทดสอบระบบ",
  specialty: "เวชศาสตร์ครอบครัว",
  licenseNumber: "MED-1001",
  bio: "ให้คำปรึกษาออนไลน์"
};

function createTransaction(input?: {
  actor?: { role: "admin" | "customer" | "doctor" | "pharmacist"; status: "active" | "suspended" } | null;
  target?: {
    id: string;
    lineUserId: string;
    fullName: string | null;
    role: "customer" | "doctor" | "pharmacist" | "admin";
    status: "active" | "suspended" | "archived" | "pending_review";
    doctorProfile: {
      id: string;
      specialty: string | null;
      licenseNumber: string | null;
      bio: string | null;
      status: "pending_review" | "approved" | "rejected" | "suspended" | "archived";
      approvedAt: Date | null;
    } | null;
  } | null;
  licenseOwner?: { userId: string } | null;
  files?: Array<{ entityType: string }>;
}) {
  const actor = input?.actor === undefined ? { role: "admin" as const, status: "active" as const } : input.actor;
  const target =
    input?.target === undefined
      ? {
          id: "doctor-user-1",
          lineUserId: "line-real-1",
          fullName: null,
          role: "customer" as const,
          status: "active" as const,
          doctorProfile: null
        }
      : input.target;
  const userFindUnique = vi.fn().mockResolvedValueOnce(actor).mockResolvedValueOnce(target);
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: userFindUnique,
      update: vi.fn().mockResolvedValue({})
    },
    doctor: {
      findUnique: vi.fn().mockResolvedValue(input?.licenseOwner ?? null),
      upsert: vi.fn().mockResolvedValue({})
    },
    fileAttachment: {
      findMany: vi.fn().mockResolvedValue(
        input?.files ?? [
          { entityType: "staff_profile_photo" },
          { entityType: "staff_license_proof" }
        ]
      )
    },
    notification: {
      create: vi.fn().mockResolvedValue({})
    },
    auditLog: {}
  };

  return tx as unknown as Prisma.TransactionClient & {
    user: { findUnique: typeof userFindUnique; update: ReturnType<typeof vi.fn> };
    doctor: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    fileAttachment: { findMany: ReturnType<typeof vi.fn> };
    notification: { create: ReturnType<typeof vi.fn> };
  };
}

describe("admin-managed doctor profile validation", () => {
  it.each(["fullName", "specialty", "licenseNumber"])("requires %s", (field) => {
    const result = manageDoctorProfileSchema.safeParse({ ...completeData, [field]: "" });
    expect(result.success).toBe(false);
  });
});

describe("manageAdminDoctorProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    null,
    { role: "customer" as const, status: "active" as const },
    { role: "doctor" as const, status: "active" as const },
    { role: "pharmacist" as const, status: "active" as const },
    { role: "admin" as const, status: "suspended" as const }
  ])("denies an actor that is not an active Admin", async (actor) => {
    const tx = createTransaction({ actor });

    await expect(
      manageAdminDoctorProfile(tx, { actorId: "actor-1", data: completeData })
    ).rejects.toMatchObject({ code: "ACTIVE_ADMIN_REQUIRED" });
    expect(tx.doctor.upsert).not.toHaveBeenCalled();
  });

  it("rejects an inactive target account", async () => {
    const tx = createTransaction({
      target: {
        id: "doctor-user-1",
        lineUserId: "line-real-1",
        fullName: null,
        role: "customer",
        status: "suspended",
        doctorProfile: null
      }
    });

    await expect(
      manageAdminDoctorProfile(tx, { actorId: "admin-1", data: completeData })
    ).rejects.toMatchObject({ code: "TARGET_NOT_ELIGIBLE" });
  });

  it("rejects a license number already owned by another doctor", async () => {
    const tx = createTransaction({ licenseOwner: { userId: "other-doctor" } });

    await expect(
      manageAdminDoctorProfile(tx, { actorId: "admin-1", data: completeData })
    ).rejects.toMatchObject({ code: "LICENSE_ALREADY_USED" });
  });

  it("requires both private staff files before approval", async () => {
    const tx = createTransaction({ files: [{ entityType: "staff_profile_photo" }] });

    await expect(
      manageAdminDoctorProfile(tx, { actorId: "admin-1", data: completeData })
    ).rejects.toMatchObject({ code: "FILES_REQUIRED" });
    expect(tx.doctor.upsert).not.toHaveBeenCalled();
  });

  it("saves and approves atomically with minimized audit metadata", async () => {
    const tx = createTransaction();
    const result = await manageAdminDoctorProfile(tx, {
      actorId: "admin-1",
      data: completeData
    });

    expect(result).toEqual({ approved: true, unchanged: false });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "doctor-user-1" },
      data: { fullName: completeData.fullName }
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "doctor-user-1" },
      data: { role: "doctor", status: "active" }
    });
    expect(tx.doctor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "doctor-user-1" },
        create: expect.objectContaining({ status: "approved" }),
        update: expect.objectContaining({ status: "approved" })
      })
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: "admin-1",
        action: "doctor_profile.approve",
        metadata: {
          changedFields: ["fullName", "specialty", "licenseNumber", "bio"],
          status: "approved"
        }
      })
    );
    const auditPayload = mocks.writeAuditLog.mock.calls[0][1];
    expect(JSON.stringify(auditPayload.metadata)).not.toContain(completeData.licenseNumber);
    expect(JSON.stringify(auditPayload.metadata)).not.toContain(completeData.fullName);
  });

  it("edits an existing doctor in place without replacing the profile or workflow records", async () => {
    const approvedAt = new Date("2026-09-01T00:00:00.000Z");
    const tx = createTransaction({
      target: {
        id: "doctor-user-1",
        lineUserId: "line-real-1",
        fullName: "ชื่อเดิม",
        role: "doctor",
        status: "active",
        doctorProfile: {
          id: "doctor-profile-1",
          specialty: "สาขาเดิม",
          licenseNumber: "MED-1001",
          bio: null,
          status: "approved",
          approvedAt
        }
      }
    });

    await manageAdminDoctorProfile(tx, {
      actorId: "admin-1",
      data: { ...completeData, intent: "save" }
    });

    expect(tx.doctor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "doctor-user-1" },
        update: expect.objectContaining({ status: "approved" })
      })
    );
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("is idempotent when an approved profile is submitted unchanged", async () => {
    const tx = createTransaction({
      target: {
        id: "doctor-user-1",
        lineUserId: "line-real-1",
        fullName: completeData.fullName,
        role: "doctor",
        status: "active",
        doctorProfile: {
          id: "doctor-profile-1",
          specialty: completeData.specialty,
          licenseNumber: completeData.licenseNumber,
          bio: completeData.bio,
          status: "approved",
          approvedAt: new Date("2026-09-01T00:00:00.000Z")
        }
      }
    });

    await expect(
      manageAdminDoctorProfile(tx, { actorId: "admin-1", data: completeData })
    ).resolves.toEqual({ approved: true, unchanged: true });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.doctor.upsert).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
