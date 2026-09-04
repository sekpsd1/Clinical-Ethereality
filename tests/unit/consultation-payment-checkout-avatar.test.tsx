import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

import { ConsultPaymentCheckout } from "@/features/consultations/ConsultPaymentCheckout";
import type { ConsultationPaymentData } from "@/features/consultations/payment/types";

const data: ConsultationPaymentData = {
  consultation: {
    id: "consultation-1",
    doctorName: "Websthai",
    doctorSpecialty: "เวชศาสตร์ชะลอวัย",
    doctorAvatarUrl: "/api/staff-files/websthai-profile",
    scheduledDate: "7 ก.ย. 2569",
    scheduledTime: "09:00",
    status: "pending_payment",
    statusLabel: "รอชำระเงิน",
    feeAmount: 1,
    feeLabel: "1 บาท",
    appointmentHref: "/consult/appointments/consultation-1",
    waitingRoomHref: "/consult/waiting-room?consultation=consultation-1",
    privateSlipAttachmentId: null,
    promptPay: {
      payload: null,
      qrDataUrl: null,
      promptPayIdLabel: "PromptPay ID not configured",
      isConfigured: false
    },
    verificationRetryAfterSeconds: 0
  },
  paymentStatus: "idle"
};

describe("ConsultPaymentCheckout doctor avatar", () => {
  it("uses the native DoctorAvatar instead of Next image optimization for staff-file URLs", () => {
    const html = renderToStaticMarkup(<ConsultPaymentCheckout data={data} />);

    expect(html).toContain('alt="Websthai"');
    expect(html).toContain("<img");
    expect(html).not.toContain("/_next/image");
  });
});
