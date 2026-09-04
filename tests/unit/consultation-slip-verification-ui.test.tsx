import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultationSlipVerification } from "@/features/consultations/payment/ConsultationSlipVerification";

describe("ConsultationSlipVerification", () => {
  it("shows a polite waiting state with a spinner while automatic verification starts", () => {
    const html = renderToStaticMarkup(
      <ConsultationSlipVerification
        attachmentId="attachment-1"
        consultationId="consultation-1"
        retryAfterSeconds={0}
        autoVerify
      />
    );

    expect(html).toContain("กรุณารอสักครู่");
    expect(html).toContain("animate-spin");
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("ตรวจสอบสลิปอัตโนมัติ</button>");
  });

  it("keeps the retry control for existing uploaded slips", () => {
    const html = renderToStaticMarkup(
      <ConsultationSlipVerification
        attachmentId="attachment-1"
        consultationId="consultation-1"
        retryAfterSeconds={0}
        autoVerify={false}
      />
    );

    expect(html).toContain("ตรวจสอบสลิปอัตโนมัติ");
  });
});
