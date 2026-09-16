import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileNotificationSummary } from "@/features/profile/ProfileNotificationSummary";
import type { CustomerNotificationsData } from "@/features/notifications/types";

const notificationData: CustomerNotificationsData = {
  unreadCount: 2,
  notifications: [
    { id: "notification-1", title: "อัปเดตคำสั่งซื้อ", body: "กำลังเตรียมจัดส่ง", time: "5 นาทีที่แล้ว", kind: "order", unread: true, href: "/store/orders" },
    { id: "notification-2", title: "คำแนะนำจากแพทย์", body: "มีข้อมูลใหม่", time: "1 ชั่วโมงที่แล้ว", kind: "consultation", unread: false, href: "/consult" },
    { id: "notification-3", title: "อัปเดตชุมชน", body: "มีความคิดเห็นใหม่", time: "เมื่อวาน", kind: "community", unread: true, href: "/community" },
    { id: "notification-4", title: "ไม่ควรแสดง", body: "เกินขีดจำกัด", time: "2 วันที่แล้ว", kind: "system", unread: false, href: "/notifications" }
  ]
};

describe("profile notification summary", () => {
  it("shows the unread count and no more than three recent in-app notification previews", () => {
    const html = renderToStaticMarkup(createElement(ProfileNotificationSummary, { data: notificationData }));

    expect(html).toContain('aria-label="มีการแจ้งเตือนที่ยังไม่อ่าน 2 รายการ"');
    expect(html).toContain("อัปเดตคำสั่งซื้อ");
    expect(html).toContain("คำแนะนำจากแพทย์");
    expect(html).toContain("อัปเดตชุมชน");
    expect(html).not.toContain("ไม่ควรแสดง");
    expect(html).toContain("ยังไม่อ่าน");
    expect(html).toContain("อ่านแล้ว");
    expect(html).toContain('href="/notifications"');
    expect(html).not.toContain("<form");
  });

  it("keeps read notifications visible without an unread badge", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileNotificationSummary, {
        data: { ...notificationData, unreadCount: 0, notifications: notificationData.notifications.slice(0, 2).map((item) => ({ ...item, unread: false })) }
      })
    );

    expect(html).toContain("อัปเดตคำสั่งซื้อ");
    expect(html).toContain("อ่านแล้ว");
    expect(html).not.toContain('aria-label="มีการแจ้งเตือนที่ยังไม่อ่าน');
  });

  it("renders compact empty and unavailable fallbacks", () => {
    const emptyHtml = renderToStaticMarkup(createElement(ProfileNotificationSummary, { data: { notifications: [], unreadCount: 0 } }));
    const unavailableHtml = renderToStaticMarkup(createElement(ProfileNotificationSummary, { data: { notifications: [], unreadCount: 0, unavailable: true } }));

    expect(emptyHtml).toContain("ยังไม่มีการแจ้งเตือนใหม่");
    expect(unavailableHtml).toContain("ยังไม่สามารถโหลดการแจ้งเตือนได้ในขณะนี้");
    expect(unavailableHtml).toContain('role="status"');
  });
});
