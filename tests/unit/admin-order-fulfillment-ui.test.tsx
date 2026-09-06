import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/orders/actions", () => ({
  updateOrderFulfillmentAction: vi.fn()
}));

import { AdminOrderActionButtons } from "@/features/admin/AdminOrderActionButtons";
import { updateOrderFulfillmentSchema } from "@/features/admin/orders/schema";

describe("admin order fulfillment controls", () => {
  it.each([
    ["paid", "เริ่มจัดเตรียม"],
    ["shipped", "ยืนยันส่งถึง"]
  ] as const)("shows the explicit %s action label", (status, label) => {
    const html = renderToStaticMarkup(
      <AdminOrderActionButtons order={{ id: "order-1", orderCode: "CE-000001", status }} />
    );

    expect(html).toContain(label);
  });

  it("shows shipment fields and requires a tracking number before shipping", () => {
    const html = renderToStaticMarkup(
      <AdminOrderActionButtons order={{ id: "order-1", orderCode: "CE-000001", status: "preparing" }} />
    );

    expect(html).toContain("ผู้ให้บริการขนส่ง");
    expect(html).toContain("เลขพัสดุ");
    expect(html).toContain("บันทึกการจัดส่ง");
    expect(html).toMatch(/required=""[^>]*name="trackingNumber"/);
  });

  it("validates tracking server input only when marking shipped", () => {
    expect(updateOrderFulfillmentSchema.safeParse({
      orderId: "order-1",
      action: "mark_preparing"
    }).success).toBe(true);

    expect(updateOrderFulfillmentSchema.safeParse({
      orderId: "order-1",
      action: "mark_shipped",
      trackingNumber: " "
    }).success).toBe(false);

    expect(updateOrderFulfillmentSchema.safeParse({
      orderId: "order-1",
      action: "mark_shipped",
      carrier: " Thailand Post ",
      trackingNumber: " EM123456789TH "
    })).toMatchObject({
      success: true,
      data: {
        carrier: "Thailand Post",
        trackingNumber: "EM123456789TH"
      }
    });
  });
});
