import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DoctorConsultations } from "@/features/doctor/DoctorConsultations";
import type { DoctorConsultationItem, DoctorConsultationsData } from "@/features/doctor/consultations/types";

vi.mock("@/features/doctor/DoctorConsultationControls", () => ({
  DoctorConsultationControls: () => null
}));

vi.mock("@/features/doctor/DoctorPrescriptionForm", () => ({
  DoctorPrescriptionForm: () => null
}));

function consultation(status: DoctorConsultationItem["status"], durationLabel: string): DoctorConsultationItem {
  return {
    id: `consultation-${status}`,
    patientName: "Patient",
    patientLineId: "PT-1234",
    status,
    readinessLabel: "พร้อมตรวจ",
    readinessTitle: "พร้อมตรวจ",
    readinessDescription: "ตรวจข้อมูลนัดหมาย",
    readinessTone: "success",
    paymentStatusLabel: "ยืนยันแล้ว",
    paymentStatusDescription: "ชำระเงินแล้ว",
    paymentStatus: "verified",
    paymentEvidenceSummary: null,
    paymentReviewedAt: null,
    canOpenConsultRoom: false,
    consultRoomHref: null,
    scheduledAt: "3 ส.ค. 2569 09:00",
    durationLabel,
    summary: null,
    prescriptionCount: 0,
    latestPrescriptionId: null,
    latestPrescriptionStatus: null,
    latestPrescriptionNotes: null,
    latestPrescriptionMedication: null,
    latestChatMessage: null,
    assessment: null,
    createdAt: "1 ส.ค. 2569 11:21"
  };
}

describe("Doctor consultation queue duration", () => {
  it("shows configured duration on every consultation status card", () => {
    const data: DoctorConsultationsData = {
      consultations: [
        consultation("requested", "15 นาที"),
        consultation("pending_payment", "30 นาที"),
        consultation("scheduled", "45 นาที"),
        consultation("live", "60 นาที"),
        consultation("completed", "30 นาที"),
        consultation("cancelled", "15 นาที")
      ],
      prescriptionProducts: [],
      summary: {
        scheduled: 1,
        live: 1,
        completed: 1
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data }));

    expect(html.match(/ระยะเวลานัด/g)).toHaveLength(data.consultations.length);
    expect(html).toContain("15 นาที");
    expect(html).toContain("30 นาที");
    expect(html).toContain("45 นาที");
    expect(html).toContain("60 นาที");
    expect(html).toContain("col-span-2");
  });

  it("keeps the duration tile explicit when historic slot data is unavailable", () => {
    const data: DoctorConsultationsData = {
      consultations: [consultation("completed", "ยังไม่ระบุ")],
      prescriptionProducts: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 1
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data }));

    expect(html).toContain("ระยะเวลานัด");
    expect(html).toContain("ยังไม่ระบุ");
  });
});
