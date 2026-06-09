import type { PrescriptionStatus } from "@prisma/client";

const orderReadyStatuses = new Set<PrescriptionStatus>(["pending_verification", "verified"]);

export function isPrescriptionOrderReady(status: PrescriptionStatus): boolean {
  return orderReadyStatuses.has(status);
}

export function getPrescriptionOrderStatusLabel(status: PrescriptionStatus): string {
  if (status === "pending_verification") {
    return "แพทย์ออกใบสั่งยาแล้ว";
  }

  if (status === "verified") {
    return "พร้อมสั่งซื้อ";
  }

  if (status === "dispensed") {
    return "จ่ายยาแล้ว";
  }

  if (status === "rejected") {
    return "ต้องให้แพทย์แก้ไข";
  }

  if (status === "archived") {
    return "เก็บถาวร";
  }

  return "ยังไม่พร้อมสั่งซื้อ";
}
