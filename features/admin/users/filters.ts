import type { AdminStaffTab } from "@/features/admin/users/types";

export const ADMIN_STAFF_PAGE_SIZE = 20;

export function normalizeAdminStaffTab(value: string | null | undefined): AdminStaffTab {
  return value === "approved" || value === "inactive" ? value : "pending";
}

export function normalizeAdminStaffPage(value: string | null | undefined): number {
  const page = Number.parseInt(value ?? "1", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function normalizeAdminStaffQuery(value: string | null | undefined): string {
  return value?.trim().slice(0, 80) ?? "";
}
