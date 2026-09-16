import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/payments/actions", () => ({
  reviewConsultationPaymentAction: vi.fn(),
  reviewManualAppointmentPaymentAction: vi.fn()
}));

import { AdminConsultationPaymentReviewForm } from "@/features/admin/AdminConsultationPaymentReviewForm";
import type { AdminPaymentQueueItem } from "@/features/admin/payments/types";

const payment: AdminPaymentQueueItem = {
  id: "payment-1",
  orderId: null,
  consultationId: "consultation-1",
  orderCode: "CONSULT-000001",
  paymentKindLabel: "ค่าปรึกษาแพทย์",
  canManualReview: false,
  customerName: "Customer",
  customerPhone: "0800000000",
  customerPhoneVerificationStatus: "verified",
  amount: "900 บาท",
  amountInput: "900.00",
  adminEvidenceHref: null,
  refundAmountInput: "900.00",
  status: "pending_review",
  methodLabel: "PromptPay",
  providerLabel: "SlipOK",
  reviewSourceLabel: "รอ Manual Review",
  resultLabel: "ระบบตรวจสอบไม่พร้อม",
  receiverLabel: "รอตรวจสอบ",
  itemSummary: "ค่าปรึกษา",
  submittedAt: "15 ก.ย. 2569",
  reviewedAt: null,
  consultationManualReview: {
    kind: "provider_fallback",
    eligible: true,
    reasonCode: "provider_unavailable",
    reason: "slot ยังถูกสำรอง หากยืนยันจะนัดหมายทันที",
    slipHref: "/api/payments/slips/slip-1",
    slotState: "active"
  }
};

describe("Admin consultation payment review form", () => {
  it("requires private Admin evidence and explains immediate confirmation", () => {
    const html = renderToStaticMarkup(
      <AdminConsultationPaymentReviewForm payment={payment} />
    );

    expect(html).toContain('name="supportingEvidence"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).toContain('name="confirmationNote"');
    expect(html).toContain('name="evidenceSource"');
    expect(html).toContain("เปิดดูได้เฉพาะ Admin");
    expect(html).toContain("ยืนยันรายการนี้ทันทีโดยไม่ต้องรอครบ 24 ชั่วโมง");
  });

  it("identifies a table-origin manual request without offering to create a new slot", () => {
    const html = renderToStaticMarkup(
      <AdminConsultationPaymentReviewForm
        payment={{
          ...payment,
          consultationManualReview: {
            ...payment.consultationManualReview!,
            kind: "manual_appointment"
          }
        }}
      />
    );

    expect(html).toContain("ตรวจรายการโอนสำหรับนัดที่ Admin รับเรื่อง");
    expect(html).toContain("รายการนี้ส่งมาจากตารางแพทย์");
    expect(html).toContain("ไม่ได้สร้างช่วงเวลาหรือนัดหมายใหม่");
    expect(html).toContain("ยืนยันรายการโอนและนัดหมาย");
  });
});
