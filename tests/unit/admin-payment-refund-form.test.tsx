import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/payments/actions", () => ({
  refundStorePaymentAction: vi.fn()
}));

import { AdminPaymentRefundForm } from "@/features/admin/AdminPaymentRefundForm";

const payment = {
  id: "payment-1",
  orderCode: "CE-UAT001",
  amount: "1 บาท",
  refundAmountInput: "1.00"
};

describe("Admin payment refund form", () => {
  it("disables the form when manual refund readiness is not ready", () => {
    const html = renderToStaticMarkup(
      <AdminPaymentRefundForm
        payment={payment}
        readiness={{ status: "not_ready", message: "ยังไม่พร้อมบันทึกคืนเงิน กรุณาตรวจ schema ก่อน" }}
      />
    );

    expect(html).toContain("ยังไม่พร้อมบันทึกคืนเงิน กรุณาตรวจ schema ก่อน");
    expect(html).toContain("disabled");
    expect(html).not.toContain('name="refundTransactionReference"');
  });

  it("shows the refund inputs only when readiness is ready", () => {
    const html = renderToStaticMarkup(
      <AdminPaymentRefundForm payment={payment} readiness={{ status: "ready", message: "พร้อมบันทึกคืนเงิน" }} />
    );

    expect(html).toContain('name="refundTransactionReference"');
    expect(html).toContain("บันทึกคืนเงิน CE-UAT001");
  });
});
