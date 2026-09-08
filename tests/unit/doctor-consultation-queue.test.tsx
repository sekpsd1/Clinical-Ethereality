import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DoctorConsultations } from "@/features/doctor/DoctorConsultations";
import { prioritizeDoctorConsultations } from "@/features/doctor/consultations/queue-order";
import type { DoctorConsultationItem, DoctorConsultationsData } from "@/features/doctor/consultations/types";

vi.mock("@/features/doctor/DoctorConsultationControls", () => ({
  DoctorConsultationControls: () => null
}));

vi.mock("@/features/doctor/DoctorPrescriptionForm", () => ({
  DoctorPrescriptionForm: () => null
}));

vi.mock("@/features/doctor/DoctorPrescriptionOutcomeForm", () => ({
  DoctorPrescriptionOutcomeForm: ({ currentStatus }: { currentStatus: string }) => (
    <div data-outcome-form={currentStatus}>
      <select>
        <option>รอแพทย์สรุป</option>
        <option>มีใบสั่งยา</option>
        <option>ไม่มีใบสั่งยา</option>
      </select>
    </div>
  )
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
    prescriptionOutcomeStatus: "pending_doctor_summary",
    prescriptionOutcomeLabel: "รอแพทย์สรุป",
    prescriptionOutcomeUpdatedAt: null,
    attendance: {
      label: "รอการยืนยันจาก Zoom",
      description: "ยังไม่มีหลักฐานผู้เข้าร่วม",
      tone: "neutral",
      normalCompletionEligible: false,
      noShowCompletionEligible: false,
      noShowRemainingSeconds: 600
    },
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

describe("Doctor consultation queue", () => {
  it("prioritizes live and scheduled consultations over historical entries", () => {
    const prioritized = prioritizeDoctorConsultations([
      consultation("cancelled", "30 นาที"),
      consultation("completed", "30 นาที"),
      consultation("scheduled", "30 นาที"),
      consultation("live", "30 นาที"),
      consultation("pending_payment", "30 นาที")
    ]);

    expect(prioritized.map((item) => item.status)).toEqual([
      "live",
      "scheduled",
      "cancelled",
      "completed",
      "pending_payment"
    ]);
  });

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

  it("shows an issued prescription as read-only and offers no duplicate prescription control", () => {
    const completed = consultation("completed", "30 นาที");
    completed.prescriptionCount = 1;
    completed.latestPrescriptionId = "prescription-issued";
    completed.latestPrescriptionStatus = "pending_verification";
    completed.prescriptionOutcomeStatus = "prescription_issued";
    completed.prescriptionOutcomeLabel = "มีใบสั่งยา";
    completed.latestPrescriptionMedication = {
      medicationName: "Paracetamol 500 mg",
      dosage: "500 mg",
      quantity: "10 เม็ด",
      instructions: "รับประทานครั้งละ 1 เม็ดหลังอาหาร"
    };
    const data: DoctorConsultationsData = {
      consultations: [completed],
      prescriptionProducts: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 1
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data }));

    expect(html).toContain("ออกใบสั่งยาแล้ว • ลูกค้าพร้อมสั่งซื้อ");
    expect(html).toContain("Paracetamol 500 mg • ขนาด 500 mg • จำนวน 10 เม็ด");
    expect(html).toContain("จึงไม่สามารถออกใบสั่งยาซ้ำได้");
    expect(html).not.toContain("ยังเขียนใบสั่งยาไม่ได้");
    expect(html).not.toContain('href="#prescription-consultation-completed"');
  });

  it("shows exactly the three approved Thai outcome labels after a completed consultation", () => {
    const data: DoctorConsultationsData = {
      consultations: [consultation("completed", "30 นาที")],
      prescriptionProducts: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 1
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data }));

    expect(html.match(/<option>รอแพทย์สรุป<\/option>/g)).toHaveLength(1);
    expect(html.match(/<option>มีใบสั่งยา<\/option>/g)).toHaveLength(1);
    expect(html.match(/<option>ไม่มีใบสั่งยา<\/option>/g)).toHaveLength(1);
    expect(html).toContain('data-outcome-form="pending_doctor_summary"');
  });
});
