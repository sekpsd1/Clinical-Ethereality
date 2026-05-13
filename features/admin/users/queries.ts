import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { isRole, type Role } from "@/lib/permissions/roles";
import type { AdminUserApprovalItem, AdminUserApprovalsData } from "@/features/admin/users/types";

type UserWithStaffProfiles = Awaited<ReturnType<typeof getUsersWithStaffProfiles>>[number];

async function getUsersWithStaffProfiles() {
  return prisma.user.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      doctorProfile: true,
      pharmacistProfile: true
    }
  });
}

function toRole(value: string): Role {
  return isRole(value) ? value : "customer";
}

function getRequestedRole(user: UserWithStaffProfiles): Role {
  if (user.doctorProfile) {
    return "doctor";
  }

  if (user.pharmacistProfile) {
    return "pharmacist";
  }

  return toRole(user.role);
}

function getStaffProfileText(user: UserWithStaffProfiles): string {
  if (user.doctorProfile) {
    return user.doctorProfile.licenseNumber
      ? `ใบอนุญาตแพทย์ ${user.doctorProfile.licenseNumber}`
      : "โปรไฟล์แพทย์รอข้อมูลใบอนุญาต";
  }

  if (user.pharmacistProfile) {
    return user.pharmacistProfile.licenseNumber
      ? `ใบอนุญาตเภสัชกร ${user.pharmacistProfile.licenseNumber}`
      : "โปรไฟล์เภสัชกรรอข้อมูลใบอนุญาต";
  }

  return "บัญชีลูกค้าที่เชื่อมต่อ LINE";
}

function formatSubmittedAt(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function mapUser(user: UserWithStaffProfiles): AdminUserApprovalItem {
  return {
    id: user.id,
    name: user.displayName ?? "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
    lineId: user.lineUserId,
    currentRole: toRole(user.role),
    requestedRole: getRequestedRole(user),
    status: user.status,
    staffStatus: user.doctorProfile?.status ?? user.pharmacistProfile?.status,
    profile: getStaffProfileText(user),
    submittedAt: formatSubmittedAt(user.createdAt)
  };
}

export async function getAdminUserApprovals(): Promise<AdminUserApprovalsData> {
  noStore();

  try {
    const users = await getUsersWithStaffProfiles();
    const approvalItems = users.map(mapUser);

    return {
      users: approvalItems,
      summary: {
        pendingReview: approvalItems.filter((user) => user.status === "pending_review" || user.staffStatus === "pending_review").length,
        approvedStaff: approvalItems.filter(
          (user) => user.staffStatus === "approved" || ["doctor", "pharmacist", "admin"].includes(user.currentRole)
        ).length,
        suspended: approvalItems.filter((user) => user.status === "suspended" || user.staffStatus === "suspended").length
      }
    };
  } catch {
    return {
      users: [],
      summary: {
        pendingReview: 0,
        approvedStaff: 0,
        suspended: 0
      },
      unavailable: true
    };
  }
}
