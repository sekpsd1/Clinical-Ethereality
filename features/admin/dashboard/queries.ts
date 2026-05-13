import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminDashboardData } from "@/features/admin/dashboard/types";

type DashboardUser = Awaited<ReturnType<typeof getDashboardUsers>>[number];
type DashboardInventoryItem = Awaited<ReturnType<typeof getLowStockInventoryItems>>[number];

async function getDashboardUsers() {
  return prisma.user.findMany({
    select: {
      role: true,
      status: true,
      doctorProfile: {
        select: {
          status: true
        }
      },
      pharmacistProfile: {
        select: {
          status: true
        }
      }
    }
  });
}

function isPendingReview(user: DashboardUser): boolean {
  return user.status === "pending_review" || user.doctorProfile?.status === "pending_review" || user.pharmacistProfile?.status === "pending_review";
}

function isApprovedStaff(user: DashboardUser): boolean {
  return user.doctorProfile?.status === "approved" || user.pharmacistProfile?.status === "approved" || ["doctor", "pharmacist", "admin"].includes(user.role);
}

function isSuspended(user: DashboardUser): boolean {
  return user.status === "suspended" || user.doctorProfile?.status === "suspended" || user.pharmacistProfile?.status === "suspended";
}

function getLowStockInventoryItems() {
  return prisma.inventory.findMany({
    select: {
      quantity: true,
      reservedQuantity: true,
      lowStockThreshold: true,
      product: {
        select: {
          status: true
        }
      }
    }
  });
}

function isLowStock(item: DashboardInventoryItem): boolean {
  return item.product.status === "active" && item.quantity - item.reservedQuantity <= item.lowStockThreshold;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  noStore();

  try {
    const [
      users,
      pendingConsultations,
      paymentsPendingReview,
      prescriptionsPendingVerification,
      ordersAwaitingPreparation,
      inventoryItems,
      hiddenArticles,
      hiddenComments
    ] = await Promise.all([
      getDashboardUsers(),
      prisma.consultation.count({
        where: {
          status: {
            in: ["requested", "pending_payment", "scheduled"]
          }
        }
      }),
      prisma.payment.count({
        where: {
          status: "pending_review"
        }
      }),
      prisma.prescription.count({
        where: {
          status: "pending_verification"
        }
      }),
      prisma.order.count({
        where: {
          status: {
            in: ["paid", "preparing"]
          }
        }
      }),
      getLowStockInventoryItems(),
      prisma.article.count({
        where: {
          status: "hidden"
        }
      }),
      prisma.comment.count({
        where: {
          status: "hidden"
        }
      })
    ]);

    return {
      userApprovals: {
        pendingReview: users.filter(isPendingReview).length,
        approvedStaff: users.filter(isApprovedStaff).length,
        suspended: users.filter(isSuspended).length
      },
      operations: {
        pendingConsultations,
        paymentsPendingReview,
        prescriptionsPendingVerification,
        ordersAwaitingPreparation,
        lowStockProducts: inventoryItems.filter(isLowStock).length,
        moderationQueue: hiddenArticles + hiddenComments
      }
    };
  } catch {
    return {
      unavailable: true,
      userApprovals: {
        pendingReview: 0,
        approvedStaff: 0,
        suspended: 0
      },
      operations: {
        pendingConsultations: 0,
        paymentsPendingReview: 0,
        prescriptionsPendingVerification: 0,
        ordersAwaitingPreparation: 0,
        lowStockProducts: 0,
        moderationQueue: 0
      }
    };
  }
}
