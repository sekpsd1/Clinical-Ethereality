import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";
import CommunityNotFound from "@/app/(app)/community/not-found";
import { AppointmentDetail } from "@/features/consultations/AppointmentDetail";
import { CustomerOrderDetail } from "@/features/orders/CustomerOrderDetail";

describe("deleted resource fallbacks", () => {
  it("renders a neutral deleted-or-unavailable message for unknown routes", () => {
    const html = renderToStaticMarkup(createElement(NotFound));

    expect(html).toContain("ข้อมูลนี้ถูกลบหรือไม่มีอยู่แล้ว");
    expect(html).toContain("กลับหน้าหลัก");
    expect(html).not.toContain("บัญชีถูกลบ");
  });

  it("uses the same safe message for stale community, appointment, and order links", () => {
    const pages = [
      renderToStaticMarkup(createElement(CommunityNotFound)),
      renderToStaticMarkup(createElement(AppointmentDetail, { data: { appointment: null } })),
      renderToStaticMarkup(createElement(CustomerOrderDetail, { order: null }))
    ];

    for (const html of pages) {
      expect(html).toContain("ข้อมูลนี้ถูกลบหรือไม่มีอยู่แล้ว");
    }
  });
});
