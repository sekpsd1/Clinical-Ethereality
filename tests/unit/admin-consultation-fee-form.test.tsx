import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminDoctorOption } from "@/features/admin/schedules/types";

vi.mock("@/features/admin/consultation-fees/actions", () => ({
  updateConsultationFeeAction: vi.fn()
}));

import { AdminConsultationFeeSettings } from "@/features/admin/AdminConsultationFeeSettings";

function doctor(overrides: Partial<AdminDoctorOption> = {}): AdminDoctorOption {
  return {
    id: "doctor-1",
    name: "พญ. ทดสอบ ระบบ",
    specialty: "เวชศาสตร์ความงาม",
    status: "approved",
    userStatus: "active",
    consultationFeeInput: "800.00",
    consultationFeeLabel: "800.00 บาท",
    feeEligible: true,
    updatedAtIso: "2026-08-27T08:00:00.000Z",
    ...overrides
  };
}

describe("Admin consultation fee settings", () => {
  it("renders the server version, exact money input, and explicit submit action", () => {
    const html = renderToStaticMarkup(<AdminConsultationFeeSettings doctors={[doctor()]} />);

    expect(html).toContain('name="doctorId" value="doctor-1"');
    expect(html).toContain('name="expectedUpdatedAt" value="2026-08-27T08:00:00.000Z"');
    expect(html).toContain('name="consultationFee"');
    expect(html).toContain('value="800.00"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain("บันทึกค่าปรึกษา");
    expect(html).toContain("ระบบการจองและชำระเงินอ่านค่าปัจจุบันจากเซิร์ฟเวอร์");
  });

  it("disables fee changes for an inactive doctor account", () => {
    const html = renderToStaticMarkup(
      <AdminConsultationFeeSettings
        doctors={[doctor({ userStatus: "suspended", feeEligible: false })]}
      />
    );

    expect(html).toContain("บัญชีแพทย์ไม่ได้อยู่ในสถานะใช้งาน");
    expect(html).toContain("disabled");
  });
});
