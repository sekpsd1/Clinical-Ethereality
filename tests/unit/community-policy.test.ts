import { describe, expect, it } from "vitest";
import {
  formatCommunityRelativeTime,
  getCommunityReportReasonLabel,
  getPublicCommunityAuthor
} from "@/features/community/policy";

describe("community privacy policy helpers", () => {
  it("replaces customer display names with a stable member alias", () => {
    expect(
      getPublicCommunityAuthor({
        id: "customer-sensitive-1234",
        displayName: "ชื่อจริงของลูกค้า",
        role: "customer"
      })
    ).toBe("สมาชิก 1234");
  });

  it("keeps approved staff display names for verified content", () => {
    expect(
      getPublicCommunityAuthor({
        id: "doctor-1",
        displayName: "พญ. ทดสอบ",
        role: "doctor"
      })
    ).toBe("พญ. ทดสอบ");
  });

  it("maps moderation reasons and relative time without exposing identifiers", () => {
    expect(getCommunityReportReasonLabel("privacy")).toBe("เปิดเผยข้อมูลส่วนตัวหรือข้อมูลสุขภาพ");
    expect(
      formatCommunityRelativeTime(
        new Date("2026-07-30T10:00:00.000Z"),
        new Date("2026-07-30T10:30:00.000Z")
      )
    ).toContain("30");
  });
});
