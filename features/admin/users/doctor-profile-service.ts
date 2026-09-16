import { Prisma, type StaffProfileStatus, type UserRole } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { staffFileEntityTypes } from "@/features/staff-files/types";
import type { ManageDoctorProfileData } from "@/features/admin/users/schema";

export type DoctorProfileManagementErrorCode =
  | "ACTIVE_ADMIN_REQUIRED"
  | "TARGET_NOT_FOUND"
  | "TARGET_NOT_ELIGIBLE"
  | "SELF_MANAGEMENT_FORBIDDEN"
  | "LICENSE_ALREADY_USED"
  | "FILES_REQUIRED";

export class DoctorProfileManagementError extends Error {
  constructor(public readonly code: DoctorProfileManagementErrorCode) {
    super(code);
    this.name = "DoctorProfileManagementError";
  }
}

type DoctorProfileTransaction = Prisma.TransactionClient;

function optionalBio(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getChangedFields(
  target: {
    fullName: string | null;
    role: UserRole;
    doctorProfile: {
      specialty: string | null;
      licenseNumber: string | null;
      bio: string | null;
      status: StaffProfileStatus;
    } | null;
  },
  data: ManageDoctorProfileData,
  bio: string | null
): string[] {
  return [
    ...(target.fullName !== data.fullName ? ["fullName"] : []),
    ...(target.doctorProfile?.specialty !== data.specialty ? ["specialty"] : []),
    ...(target.doctorProfile?.licenseNumber !== data.licenseNumber ? ["licenseNumber"] : []),
    ...(target.doctorProfile?.bio !== bio ? ["bio"] : [])
  ];
}

export async function manageAdminDoctorProfile(
  tx: DoctorProfileTransaction,
  input: {
    actorId: string;
    data: ManageDoctorProfileData;
  }
): Promise<{ approved: boolean; unchanged: boolean }> {
  const { actorId, data } = input;

  if (actorId === data.userId) {
    throw new DoctorProfileManagementError("SELF_MANAGEMENT_FORBIDDEN");
  }

  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` IN (${actorId}, ${data.userId}) ORDER BY \`id\` FOR UPDATE`
  );

  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { role: true, status: true }
  });

  if (!actor || actor.role !== "admin" || actor.status !== "active") {
    throw new DoctorProfileManagementError("ACTIVE_ADMIN_REQUIRED");
  }

  const target = await tx.user.findUnique({
    where: { id: data.userId },
    select: {
      id: true,
      lineUserId: true,
      fullName: true,
      role: true,
      status: true,
      doctorProfile: {
        select: {
          id: true,
          specialty: true,
          licenseNumber: true,
          bio: true,
          status: true,
          approvedAt: true
        }
      }
    }
  });

  if (!target) {
    throw new DoctorProfileManagementError("TARGET_NOT_FOUND");
  }

  if (
    target.status !== "active" ||
    !target.lineUserId ||
    (target.role !== "customer" && target.role !== "doctor") ||
    (target.role === "customer" && target.doctorProfile?.status !== "pending_review")
  ) {
    throw new DoctorProfileManagementError("TARGET_NOT_ELIGIBLE");
  }

  const licenseOwner = await tx.doctor.findUnique({
    where: { licenseNumber: data.licenseNumber },
    select: { userId: true }
  });

  if (licenseOwner && licenseOwner.userId !== data.userId) {
    throw new DoctorProfileManagementError("LICENSE_ALREADY_USED");
  }

  if (data.intent === "approve") {
    const requiredFiles = await tx.fileAttachment.findMany({
      where: {
        ownerId: data.userId,
        entityId: data.userId,
        entityType: {
          in: [staffFileEntityTypes.profilePhoto, staffFileEntityTypes.licenseProof]
        },
        status: "attached"
      },
      select: { entityType: true }
    });
    const kinds = new Set(requiredFiles.map((file) => file.entityType));

    if (
      !kinds.has(staffFileEntityTypes.profilePhoto) ||
      !kinds.has(staffFileEntityTypes.licenseProof)
    ) {
      throw new DoctorProfileManagementError("FILES_REQUIRED");
    }
  }

  const bio = optionalBio(data.bio);
  const changedFields = getChangedFields(target, data, bio);
  const alreadyApproved =
    target.role === "doctor" && target.doctorProfile?.status === "approved";
  const approvalChanged = data.intent === "approve" && !alreadyApproved;
  let doctorProfileId = target.doctorProfile?.id;

  if (changedFields.includes("fullName")) {
    await tx.user.update({
      where: { id: data.userId },
      data: { fullName: data.fullName }
    });
  }

  const nextProfileStatus: StaffProfileStatus =
    data.intent === "approve"
      ? "approved"
      : target.doctorProfile?.status === "approved" && target.role === "doctor"
        ? "approved"
        : "pending_review";

  if (changedFields.length > 0 || !target.doctorProfile || target.doctorProfile.status !== nextProfileStatus) {
    const managedProfile = await tx.doctor.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        specialty: data.specialty,
        licenseNumber: data.licenseNumber,
        bio,
        status: nextProfileStatus,
        approvedAt: data.intent === "approve" ? new Date() : null
      },
      update: {
        specialty: data.specialty,
        licenseNumber: data.licenseNumber,
        bio,
        status: nextProfileStatus,
        ...(data.intent === "approve" && !target.doctorProfile?.approvedAt
          ? { approvedAt: new Date() }
          : {})
      },
      select: { id: true }
    });
    doctorProfileId = managedProfile.id;
  }

  if (approvalChanged) {
    await tx.user.update({
      where: { id: data.userId },
      data: { role: "doctor", status: "active" }
    });

    await tx.notification.create({
      data: {
        userId: data.userId,
        type: "system",
        channel: "in_app",
        title: "เปิดสิทธิ์แพทย์แล้ว",
        body: "ผู้ดูแลระบบยืนยันข้อมูลแพทย์แล้ว กรุณาออกจากระบบและเข้าใหม่เพื่อใช้งานด้วยสิทธิ์แพทย์"
      }
    });
  }

  if (changedFields.length > 0 || approvalChanged) {
    await writeAuditLog(tx, {
      actorId,
      action: data.intent === "approve" ? "doctor_profile.approve" : "doctor_profile.update",
      entityType: "doctor",
      entityId: doctorProfileId ?? data.userId,
      metadata: {
        changedFields,
        status: data.intent === "approve" ? "approved" : nextProfileStatus
      }
    });
  }

  return {
    approved: data.intent === "approve",
    unchanged: changedFields.length === 0 && !approvalChanged
  };
}
