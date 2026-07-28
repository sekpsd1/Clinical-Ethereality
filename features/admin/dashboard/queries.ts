import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminDashboardData } from "@/features/admin/dashboard/types";

type DashboardUser = Awaited<ReturnType<typeof getDashboardUsers>>[number];
type DashboardInventoryItem = Awaited<ReturnType<typeof getLowStockInventoryItems>>[number];
type DashboardAuditLog = Awaited<ReturnType<typeof getRecentAuditLogs>>[number];

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

function getRecentAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 6,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: {
        select: {
          displayName: true,
          lineUserId: true
        }
      }
    }
  });
}

const activityLabels: Record<string, string> = {
  "staff_invite.request": "ส่งคำขอสิทธิ์บุคลากร",
  "staff_file.upload": "อัปโหลดเอกสารบุคลากร",
  "user.approve_staff_role": "อนุมัติสิทธิ์บุคลากร",
  "user.update_status": "เปลี่ยนสถานะผู้ใช้",
  "user.update_role": "เปลี่ยนสิทธิ์ผู้ใช้",
  "payment.manual_review": "ตรวจสอบการชำระเงิน",
  "payment.provider_verify_slip": "ตรวจสอบสลิปผ่านผู้ให้บริการ",
  "prescription.doctor_issued": "แพทย์ออกใบสั่งยา",
  "prescription.review": "ตรวจสอบใบสั่งยา",
  "inventory.update": "อัปเดตสต็อก",
  "product.create": "สร้างสินค้า",
  "product.update": "อัปเดตสินค้า",
  "doctor_availability.create": "เพิ่มเวลาว่างแพทย์",
  "doctor_availability.update": "แก้ไขเวลาว่างแพทย์",
  "doctor_availability.toggle": "เปลี่ยนสถานะเวลาว่างแพทย์",
  "order.create_checkout": "สร้างคำสั่งซื้อจากตะกร้า",
  "order.create_from_prescription": "สร้างคำสั่งซื้อจากใบสั่งยา",
  "order.create_from_external_prescription": "สร้างคำสั่งซื้อจากใบสั่งยาภายนอก",
  "order.mark_preparing": "เริ่มจัดเตรียมคำสั่งซื้อ",
  "order.mark_shipped": "บันทึกการจัดส่งคำสั่งซื้อ",
  "order.mark_delivered": "บันทึกการส่งมอบคำสั่งซื้อ",
  "consultation.book_slot": "จองเวลาปรึกษาแพทย์",
  "consultation.slot_lock_expired": "คืนช่วงเวลาจองที่หมดอายุ",
  "consultation.payment_verified": "ยืนยันการชำระค่าปรึกษา",
  "consultation.payment_rejected": "ปฏิเสธการชำระค่าปรึกษา",
  "consult_assessment.complete": "ทำแบบประเมินก่อนพบแพทย์เสร็จสิ้น",
  "consult_assessment.reset_for_customer": "เปิดให้ลูกค้าทำแบบประเมินใหม่",
  "consultation_message.create": "ส่งข้อความในการปรึกษา",
  "moderation.restore": "คืนค่าเนื้อหาชุมชน",
  "moderation.hide": "ซ่อนเนื้อหาชุมชน",
  "moderation.archive": "เก็บเนื้อหาชุมชนถาวร",
  "profile.contact.update": "อัปเดตข้อมูลติดต่อ",
  "consent.accept": "ยอมรับเอกสารและความยินยอม",
  "reward.redeem_wellness_credit": "แลกแต้มสะสม"
};

function getActivityHref(entityType: string): string {
  if (entityType === "user" || entityType === "file_attachment") {
    return "/admin/users";
  }

  if (entityType === "payment") {
    return "/admin/payments";
  }

  if (entityType === "order" || entityType === "shipment") {
    return "/admin/orders";
  }

  if (entityType === "inventory") {
    return "/admin/inventory";
  }

  if (entityType === "product") {
    return "/admin/products";
  }

  if (entityType === "article" || entityType === "comment") {
    return "/admin/moderation";
  }

  if (entityType === "doctor_availability") {
    return "/admin/schedules";
  }

  if (entityType === "notification") {
    return "/admin/notifications";
  }

  if (entityType === "prescription") {
    return "/pharmacist/prescriptions";
  }

  if (entityType === "consult_assessment") {
    return "/admin/customers";
  }

  if (entityType === "consultation" || entityType === "consultation_message") {
    return "/doctor/consultations";
  }

  return "/admin/audit";
}

function formatActivity(log: DashboardAuditLog): AdminDashboardData["recentActivities"][number] {
  const actor = log.actor?.displayName ?? log.actor?.lineUserId ?? "ระบบ";
  const entity = log.entityId ? `${log.entityType} / ${log.entityId}` : log.entityType;

  return {
    id: log.id,
    title: activityLabels[log.action] ?? log.action,
    detail: `${entity} · ${actor}`,
    createdAt: new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(log.createdAt),
    href: getActivityHref(log.entityType)
  };
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
      hiddenComments,
      recentAuditLogs
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
      }),
      getRecentAuditLogs()
    ]);

    return {
      recentActivities: recentAuditLogs.map(formatActivity),
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
      recentActivities: [],
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
