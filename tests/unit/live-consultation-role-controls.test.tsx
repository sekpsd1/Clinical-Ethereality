import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LiveConsultationChatData } from "@/features/consultations/chat/types";

vi.mock("@/features/consultations/chat/ConsultationChatAutoRefresh", () => ({
  ConsultationChatAutoRefresh: () => null
}));
vi.mock("@/features/consultations/chat/ConsultationMessageComposer", () => ({
  ConsultationMessageComposer: () => <div data-testid="message-composer" />
}));

import { LiveConsultation } from "@/features/consultations/LiveConsultation";

function chat(viewerRole: LiveConsultationChatData["viewerRole"]): LiveConsultationChatData {
  return {
    consultationId: "consultation-uat",
    viewerRole,
    doctorName: "Doctor UAT",
    doctorImageUrl: "/images/doctors/waiting-avatar.png",
    patientImageUrl: "/images/doctors/waiting-avatar.png",
    statusLabel: "Live",
    attendanceLabel: "รอการยืนยันจาก Zoom",
    attendanceDescription: "รอข้อมูลการเข้าร่วม",
    attendanceTone: "neutral",
    canSend: true,
    videoHref: null,
    videoMode: "unavailable",
    returnHref: viewerRole === "doctor" ? "/doctor/consultations" : "/consult/appointments/consultation-uat",
    messages: []
  };
}

describe("LiveConsultation role controls", () => {
  it("omits the return-to-queue phone control for the doctor without changing the chat composer", () => {
    const html = renderToStaticMarkup(<LiveConsultation chat={chat("doctor")} />);

    expect(html).toContain('data-testid="message-composer"');
    expect(html).not.toContain("กลับคิว");
    expect(html).not.toContain('aria-label="ออกจากห้องปรึกษา"');
    expect(html).not.toContain('href="/doctor/consultations"');
  });

  it("retains the customer hang-up control and its existing destination", () => {
    const html = renderToStaticMarkup(<LiveConsultation chat={chat("customer")} />);

    expect(html).toContain("วางสาย");
    expect(html).toContain('aria-label="ออกจากห้องปรึกษา"');
    expect(html).toContain('href="/consult/appointments/consultation-uat"');
  });

  it("retains the existing admin return control", () => {
    const html = renderToStaticMarkup(<LiveConsultation chat={chat("admin")} />);

    expect(html).toContain("กลับคิว");
    expect(html).toContain('aria-label="ออกจากห้องปรึกษา"');
  });
});
