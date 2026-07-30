import type { Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import {
  ADMIN_STAFF_PAGE_SIZE,
  normalizeAdminStaffPage,
  normalizeAdminStaffQuery,
  normalizeAdminStaffTab
} from "@/features/admin/users/filters";
import type {
  AdminStaffTab,
  AdminUserApprovalItem,
  AdminUserApprovalsData
} from "@/features/admin/users/types";
import { prisma } from "@/lib/db/prisma";
import { isRole, type Role } from "@/lib/permissions/roles";
import { staffFileEntityTypes } from "@/features/staff-files/types";

const staffScopeWhere: Prisma.UserWhereInput = {
  OR: [
    {
      role: {
        in: ["doctor", "pharmacist", "admin"]
      }
    },
    {
      doctorProfile: {
        isNot: null
      }
    },
    {
      pharmacistProfile: {
        isNot: null
      }
    },
    {
      role: "customer",
      status: "pending_review"
    }
  ]
};

const inactiveStaffWhere: Prisma.UserWhereInput = {
  OR: [
    {
      status: {
        in: ["suspended", "archived"]
      }
    },
    {
      doctorProfile: {
        is: {
          status: {
            in: ["rejected", "suspended", "archived"]
          }
        }
      }
    },
    {
      pharmacistProfile: {
        is: {
          status: {
            in: ["rejected", "suspended", "archived"]
          }
        }
      }
    }
  ]
};

const pendingStaffRawWhere: Prisma.UserWhereInput = {
  OR: [
    {
      status: "pending_review"
    },
    {
      doctorProfile: {
        is: {
          status: "pending_review"
        }
      }
    },
    {
      pharmacistProfile: {
        is: {
          status: "pending_review"
        }
      }
    }
  ]
};

const pendingStaffWhere: Prisma.UserWhereInput = {
  AND: [
    {
      NOT: inactiveStaffWhere
    },
    pendingStaffRawWhere
  ]
};

const approvedStaffWhere: Prisma.UserWhereInput = {
  AND: [
    {
      NOT: inactiveStaffWhere
    },
    {
      NOT: pendingStaffRawWhere
    }
  ]
};

function getStatusWhere(status: AdminStaffTab): Prisma.UserWhereInput {
  if (status === "approved") {
    return approvedStaffWhere;
  }

  if (status === "inactive") {
    return inactiveStaffWhere;
  }

  return pendingStaffWhere;
}

function getSearchWhere(query: string): Prisma.UserWhereInput {
  if (!query) {
    return {};
  }

  return {
    OR: [
      {
        displayName: {
          contains: query
        }
      },
      {
        lineUserId: {
          contains: query
        }
      }
    ]
  };
}

function getStaffWhere(status: AdminStaffTab, query = ""): Prisma.UserWhereInput {
  return {
    AND: [staffScopeWhere, getStatusWhere(status), getSearchWhere(query)]
  };
}

async function getUsersWithStaffProfiles(where: Prisma.UserWhereInput, page: number) {
  return prisma.user.findMany({
    where,
    orderBy: {
      updatedAt: "desc"
    },
    skip: (page - 1) * ADMIN_STAFF_PAGE_SIZE,
    take: ADMIN_STAFF_PAGE_SIZE,
    include: {
      doctorProfile: true,
      pharmacistProfile: true,
      fileAttachments: {
        where: {
          status: "attached",
          entityType: {
            in: [staffFileEntityTypes.profilePhoto, staffFileEntityTypes.licenseProof]
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          entityType: true,
          storageUrl: true,
          fileName: true
        }
      }
    }
  });
}

type UserWithStaffProfiles = Awaited<ReturnType<typeof getUsersWithStaffProfiles>>[number];

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

  if (user.status === "pending_review" && user.role === "customer") {
    return "admin";
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

  if (user.status === "pending_review" && user.role === "customer") {
    return "คำขอสิทธิ์ผู้ดูแลระบบจากลิงก์เชิญ รอผู้ดูแลระบบเดิมตรวจสอบ";
  }

  return "บัญชีบุคลากรที่เชื่อมต่อ LINE";
}

function formatSubmittedAt(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function mapUser(user: UserWithStaffProfiles): AdminUserApprovalItem {
  const profilePhoto = user.fileAttachments.find(
    (attachment) => attachment.entityType === staffFileEntityTypes.profilePhoto
  );
  const licenseProof = user.fileAttachments.find(
    (attachment) => attachment.entityType === staffFileEntityTypes.licenseProof
  );

  return {
    id: user.id,
    name: user.displayName ?? "ผู้ใช้ LINE ยังไม่ระบุชื่อ",
    lineId: user.lineUserId,
    currentRole: toRole(user.role),
    requestedRole: getRequestedRole(user),
    status: user.status,
    staffStatus: user.doctorProfile?.status ?? user.pharmacistProfile?.status,
    profile: getStaffProfileText(user),
    profilePhotoUrl: profilePhoto?.storageUrl ?? null,
    profilePhotoName: profilePhoto?.fileName ?? null,
    licenseProofUrl: licenseProof?.storageUrl ?? null,
    licenseProofName: licenseProof?.fileName ?? null,
    submittedAt: formatSubmittedAt(user.createdAt)
  };
}

export async function getAdminUserApprovals(
  input: {
    page?: number;
    query?: string;
    status?: AdminStaffTab;
  } = {}
): Promise<AdminUserApprovalsData> {
  noStore();

  const requestedPage = normalizeAdminStaffPage(String(input.page ?? 1));
  const query = normalizeAdminStaffQuery(input.query);
  const status = normalizeAdminStaffTab(input.status);

  try {
    const selectedWhere = getStaffWhere(status, query);
    const [total, pendingReview, approvedStaff, suspended] = await Promise.all([
      prisma.user.count({
        where: selectedWhere
      }),
      prisma.user.count({
        where: getStaffWhere("pending")
      }),
      prisma.user.count({
        where: getStaffWhere("approved")
      }),
      prisma.user.count({
        where: getStaffWhere("inactive")
      })
    ]);
    const totalPages = Math.max(1, Math.ceil(total / ADMIN_STAFF_PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const users = await getUsersWithStaffProfiles(selectedWhere, page);

    return {
      users: users.map(mapUser),
      summary: {
        pendingReview,
        approvedStaff,
        suspended
      },
      filters: {
        status,
        query
      },
      pagination: {
        page,
        pageSize: ADMIN_STAFF_PAGE_SIZE,
        total,
        totalPages
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
      filters: {
        status,
        query
      },
      pagination: {
        page: 1,
        pageSize: ADMIN_STAFF_PAGE_SIZE,
        total: 0,
        totalPages: 1
      },
      unavailable: true
    };
  }
}
