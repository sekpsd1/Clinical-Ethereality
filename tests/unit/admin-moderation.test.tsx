import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminModerationData, AdminModerationQueueItem } from "@/features/admin/moderation/types";

vi.mock("@/features/admin/moderation/actions", () => ({
  updateModerationItemAction: vi.fn()
}));

import { AdminModeration, ModerationDetailPanel } from "@/features/admin/AdminModeration";
import {
  defaultAdminModerationFilters,
  filterAdminModerationItems,
  isTestModerationItem,
  sortAdminModerationItems
} from "@/features/admin/moderation/filters";

function createItem(overrides: Partial<AdminModerationQueueItem> = {}): AdminModerationQueueItem {
  return {
    id: "article-1",
    reportId: "report-1",
    type: "article",
    title: "คำแนะนำสุขภาพในชุมชน",
    body: "เนื้อหาที่ผู้ดูแลควรตรวจสอบ",
    authorName: "สมาชิก ABCD",
    status: "published",
    createdAt: "13 ส.ค. 2569 10:00",
    reporterName: "สมาชิก EFGH",
    reportReasonCode: "privacy",
    reportReason: "เปิดเผยข้อมูลส่วนตัวหรือข้อมูลสุขภาพ",
    reportDetails: "มีข้อมูลส่วนตัวในข้อความ",
    reportedAt: "13 ส.ค. 2569 10:05",
    ...overrides
  };
}

describe("admin moderation filters", () => {
  const pending = createItem();
  const hidden = createItem({
    id: "comment-1",
    reportId: null,
    type: "comment",
    status: "hidden",
    reportReasonCode: null,
    reportReason: null,
    reportDetails: null,
    reporterName: null,
    reportedAt: null
  });
  const archived = createItem({ id: "article-archived", reportId: null, status: "archived" });
  const uat = createItem({ id: "article-uat", title: "[UAT] moderation fixture" });

  it("hides Test/UAT and archived records by default", () => {
    expect(isTestModerationItem(uat)).toBe(true);
    expect(filterAdminModerationItems([pending, hidden, archived, uat], defaultAdminModerationFilters)).toEqual([
      pending,
      hidden
    ]);
  });

  it("combines type, report reason, status, and search filters", () => {
    expect(
      filterAdminModerationItems([pending, hidden], {
        ...defaultAdminModerationFilters,
        query: "  ข้อมูลส่วนตัว ",
        type: "article",
        reason: "privacy",
        status: "pending"
      })
    ).toEqual([pending]);
  });

  it("sorts pending reports ahead of non-report records without mutating input", () => {
    const input = [hidden, pending];
    expect(sortAdminModerationItems(input)).toEqual([pending, hidden]);
    expect(input).toEqual([hidden, pending]);
  });
});

describe("AdminModeration UX", () => {
  it("renders explicit controls, pending count, filters, and bulk selection preparation", () => {
    const data: AdminModerationData = {
      items: [
        createItem(),
        createItem({ id: "archived", reportId: null, status: "archived", title: "Archived moderation record" })
      ],
      summary: { pendingReports: 7, hiddenArticles: 2, hiddenComments: 3 }
    };
    const html = renderToStaticMarkup(<AdminModeration data={data} />);

    expect(html).toContain("รอตรวจทั้งหมด");
    expect(html).toContain("ค้นหาหัวข้อ เนื้อหา หรือชื่อผู้ใช้");
    expect(html).toContain("ทุกเหตุผลรายงาน");
    expect(html).toContain("รวม Test/UAT");
    expect(html).toContain("รวมรายการเก็บถาวร");
    expect(html).toContain("เตรียมไว้สำหรับ Bulk action");
    expect(html).toMatch(/>\s*ดู<\/button>/);
    expect(html).toMatch(/>\s*ซ่อน<\/button>/);
    expect(html).toMatch(/>\s*เก็บถาวร<\/button>/);
    expect(html).not.toContain("Archived moderation record");
  });

  it("renders full report context and recoverable-archive guidance in the detail side panel", () => {
    const html = renderToStaticMarkup(<ModerationDetailPanel item={createItem()} onClose={() => undefined} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain("รายละเอียดการตรวจสอบ");
    expect(html).toContain("เนื้อหาทั้งหมด");
    expect(html).toContain("มีข้อมูลส่วนตัวในข้อความ");
    expect(html).toContain("ไม่ใช่การลบถาวร");
    expect(html).toContain("สามารถคืนค่าได้");
  });
});
