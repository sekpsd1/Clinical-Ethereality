import { describe, expect, it } from "vitest";
import {
  ADMIN_STAFF_PAGE_SIZE,
  normalizeAdminStaffPage,
  normalizeAdminStaffQuery,
  normalizeAdminStaffTab
} from "@/features/admin/users/filters";

describe("admin staff filters", () => {
  it("uses pending as the default tab", () => {
    expect(normalizeAdminStaffTab(undefined)).toBe("pending");
    expect(normalizeAdminStaffTab("unknown")).toBe("pending");
    expect(normalizeAdminStaffTab("approved")).toBe("approved");
    expect(normalizeAdminStaffTab("inactive")).toBe("inactive");
  });

  it("normalizes invalid pages to the first page", () => {
    expect(normalizeAdminStaffPage(undefined)).toBe(1);
    expect(normalizeAdminStaffPage("0")).toBe(1);
    expect(normalizeAdminStaffPage("invalid")).toBe(1);
    expect(normalizeAdminStaffPage("3")).toBe(3);
  });

  it("trims and limits search text", () => {
    expect(normalizeAdminStaffQuery("  Somchai  ")).toBe("Somchai");
    expect(normalizeAdminStaffQuery("x".repeat(100))).toHaveLength(80);
  });

  it("uses twenty records per page", () => {
    expect(ADMIN_STAFF_PAGE_SIZE).toBe(20);
  });
});
