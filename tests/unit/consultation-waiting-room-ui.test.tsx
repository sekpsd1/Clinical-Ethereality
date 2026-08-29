import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultWaitingRoom } from "@/features/consultations/ConsultWaitingRoom";
import type { ConsultationWaitingRoomData } from "@/features/consultations/waiting-room/types";

function waitingRoomData(overrides: Partial<ConsultationWaitingRoomData> = {}): ConsultationWaitingRoomData {
  return {
    consultationId: "consultation-uat",
    viewerRole: "customer",
    consultationStatus: "scheduled",
    doctorName: "Doctor UAT",
    doctorImageUrl: "/images/doctors/waiting-avatar.png",
    scheduledLabel: "1 ม.ค. 2573 17:00",
    statusMessage: "ยืนยันการชำระเงินเรียบร้อยแล้ว",
    countdownTitle: "เริ่มในอีก",
    countdownValue: "00:30",
    canEnterLive: false,
    liveHref: null,
    returnHref: "/consult/appointments/consultation-uat",
    ...overrides
  };
}

describe("ConsultWaitingRoom", () => {
  it("renders the finalized waiting-room shell without a live link before the server time gate", () => {
    const html = renderToStaticMarkup(<ConsultWaitingRoom data={waitingRoomData()} />);

    expect(html).toContain("ห้องนั่งรอปรึกษา");
    expect(html).toContain("aria-disabled=\"true\"");
    expect(html).not.toContain("href=\"/consult/live");
  });

  it("renders only the server-provided consultation context when entry is allowed", () => {
    const html = renderToStaticMarkup(
      <ConsultWaitingRoom
        data={waitingRoomData({
          consultationStatus: "live",
          canEnterLive: true,
          countdownTitle: "แพทย์เปิดห้องแล้ว",
          countdownValue: "พร้อม",
          liveHref: "/consult/live?consultation=consultation-uat"
        })}
      />
    );

    expect(html).toContain("href=\"/consult/live?consultation=consultation-uat\"");
    expect(html).toContain("พร้อมเข้าสู่ห้องปรึกษา");
  });
});
