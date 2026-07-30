import type { UserRole } from "@prisma/client";

export const communityCategories = [
  "โรคทั่วไป",
  "วิตามิน & อาหารเสริม",
  "การดูแลผิว",
  "ปรึกษาหมอ"
] as const;

export const communityReportReasons = [
  {
    value: "privacy",
    label: "เปิดเผยข้อมูลส่วนตัวหรือข้อมูลสุขภาพ"
  },
  {
    value: "medical_misinformation",
    label: "ข้อมูลสุขภาพที่อาจทำให้เข้าใจผิด"
  },
  {
    value: "harassment",
    label: "คุกคามหรือไม่เคารพผู้อื่น"
  },
  {
    value: "spam",
    label: "สแปมหรือโฆษณาไม่เหมาะสม"
  },
  {
    value: "other",
    label: "เหตุผลอื่น"
  }
] as const;

export type CommunityReportReason = (typeof communityReportReasons)[number]["value"];

export function getCommunityReportReasonLabel(reason: string): string {
  return communityReportReasons.find((item) => item.value === reason)?.label ?? "เหตุผลอื่น";
}

export function getPublicCommunityAuthor(input: {
  id: string;
  displayName: string | null;
  role: UserRole;
}): string {
  if (input.role === "doctor" || input.role === "pharmacist" || input.role === "admin") {
    return input.displayName?.trim() || "ทีม Clinical Ethereality";
  }

  return `สมาชิก ${input.id.slice(-4).toUpperCase()}`;
}

export function formatCommunityRelativeTime(date: Date, now = new Date()): string {
  const deltaSeconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat("th-TH", {
    numeric: "auto"
  });

  if (deltaSeconds < 60) {
    return formatter.format(-deltaSeconds, "second");
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return formatter.format(-deltaMinutes, "minute");
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return formatter.format(-deltaHours, "hour");
  }

  return formatter.format(-Math.round(deltaHours / 24), "day");
}
