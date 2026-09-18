import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DoctorConsultations } from "@/features/doctor/DoctorConsultations";
import {
  filterDoctorConsultationsByQueueStatus,
  getNonOperationalDoctorConsultationCount,
  prioritizeDoctorConsultations
} from "@/features/doctor/consultations/queue-order";
import type { DoctorConsultationItem, DoctorConsultationsData } from "@/features/doctor/consultations/types";

vi.mock("@/features/doctor/DoctorConsultationControls", () => ({
  DoctorConsultationControls: ({ consultation }: { consultation: DoctorConsultationItem }) =>
    consultation.status === "live" ? (
      <div data-consultation-controls>
        <button type="button" disabled>
          ยืนยันจบการปรึกษา
        </button>
      </div>
    ) : null
}));

vi.mock("@/features/doctor/DoctorPatientIdentityGate", () => ({
  DoctorPatientIdentityGate: ({ consultation }: { consultation: DoctorConsultationItem }) =>
    consultation.status === "scheduled" || consultation.status === "live" ? (
      <>
        <div data-patient-identity-gate>ยืนยันตัวตนผู้ป่วย</div>
        <div data-consultation-controls>
          {consultation.status === "live" ? (
            <button type="button" disabled>
              ยืนยันจบการปรึกษา
            </button>
          ) : (
            <button type="button" disabled>
              เริ่มการปรึกษา
            </button>
          )}
        </div>
      </>
    ) : null
}));

vi.mock("@/features/doctor/DoctorConsultationQueueAutoRefresh", () => ({
  DoctorConsultationQueueAutoRefresh: ({ enabled }: { enabled: boolean }) => (
    <span data-queue-auto-refresh={String(enabled)} />
  )
}));

vi.mock("@/features/doctor/DoctorPrescriptionForm", () => ({
  DoctorPrescriptionForm: () => <div data-prescription-section>รายการยา</div>
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
    chatHistoryHref: status === "completed" ? "/doctor/consultations/consultation-completed/chat-history" : null,
    scheduledAt: "3 ส.ค. 2569 09:00",
    canStartConsultation: false,
    startAvailableAt: "2026-08-03T01:55:00.000Z",
    startAvailableInMs: 60_000,
    durationLabel,
    summary: null,
    prescriptionOutcomeStatus: "pending_doctor_summary",
    prescriptionOutcomeLabel: "รอแพทย์สรุป",
    prescriptionOutcomeUpdatedAt: null,
    canUpdatePrescriptionOutcome: true,
    attendance: {
      label: "รอการยืนยันจาก Zoom",
      description: "ยังไม่มีหลักฐานผู้เข้าร่วม",
      tone: "neutral",
      normalCompletionEligible: false,
      noShowCompletionEligible: false,
      requiredDurationMinutes: 15,
      verifiedDoctorPresenceSeconds: 0,
      noShowRemainingSeconds: 600
    },
    prescriptionCount: 0,
    latestPrescriptionId: null,
    latestPrescriptionStatus: null,
    latestPrescriptionNotes: null,
    latestPrescriptionMedication: null,
    latestChatMessage: null,
    assessment: null,
    recordings: [],
    createdAt: "1 ส.ค. 2569 11:21"
  };
}

describe("Doctor consultation queue", () => {
  it("places the patient identity gate before controls and the prescription form", () => {
    const data: DoctorConsultationsData = {
      consultations: [consultation("scheduled", "15 นาที")],
      prescriptionProducts: [],
      summary: { scheduled: 1, live: 0, completed: 0 }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "scheduled" }));
    const identityIndex = html.indexOf("data-patient-identity-gate");
    const controlsIndex = html.indexOf("data-consultation-controls");
    const prescriptionIndex = html.indexOf("data-prescription-section");

    expect(identityIndex).toBeGreaterThan(-1);
    expect(controlsIndex).toBeGreaterThan(identityIndex);
    expect(prescriptionIndex).toBeGreaterThan(controlsIndex);
  });

  it("keeps the visible disabled live completion action before the prescription section", () => {
    const data: DoctorConsultationsData = {
      consultations: [consultation("live", "30 นาที")],
      prescriptionProducts: [],
      summary: { scheduled: 0, live: 1, completed: 0 }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "live" }));
    const completionIndex = html.indexOf("ยืนยันจบการปรึกษา");
    const prescriptionIndex = html.indexOf("data-prescription-section");

    expect(completionIndex).toBeGreaterThan(-1);
    expect(html.slice(completionIndex - 120, completionIndex)).toContain("disabled");
    expect(prescriptionIndex).toBeGreaterThan(completionIndex);
  });

  it("enables attendance refresh only while a live consultation is present", () => {
    const liveData: DoctorConsultationsData = {
      consultations: [consultation("live", "30 นาที")],
      prescriptionProducts: [],
      summary: { scheduled: 0, live: 1, completed: 0 }
    };
    const completedData: DoctorConsultationsData = {
      consultations: [consultation("completed", "30 นาที")],
      prescriptionProducts: [],
      summary: { scheduled: 0, live: 0, completed: 1 }
    };

    expect(renderToStaticMarkup(createElement(DoctorConsultations, { data: liveData }))).toContain(
      'data-queue-auto-refresh="true"'
    );
    expect(
      renderToStaticMarkup(createElement(DoctorConsultations, { data: completedData }))
    ).toContain('data-queue-auto-refresh="false"');
  });

  it("shows the approved Telemedicine services in the requested order", () => {
    const data: DoctorConsultationsData = {
      consultations: [],
      prescriptionProducts: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 0
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data }));
    const telemedicineIndex = html.indexOf("Telemedicine");
    const gynecologistIndex = html.indexOf("สูตินารีแพทย์");
    const hpvStisIndex = html.indexOf("HPV/STIs");
    const generalConsultationIndex = html.indexOf("ปรึกษาทั่วไป");
    const consultationListIndex = html.indexOf("รายการปรึกษา");

    expect(telemedicineIndex).toBeGreaterThan(-1);
    expect(gynecologistIndex).toBeGreaterThan(telemedicineIndex);
    expect(hpvStisIndex).toBeGreaterThan(gynecologistIndex);
    expect(generalConsultationIndex).toBeGreaterThan(hpvStisIndex);
    expect(consultationListIndex).toBeGreaterThan(generalConsultationIndex);
    expect(html).not.toContain("ตรวจ HPV");
  });

  it("defaults to the ready queue and exposes one accessible status filter at a time", () => {
    const scheduled = consultation("scheduled", "15 นาที");
    scheduled.patientName = "Ready patient";
    const live = consultation("live", "30 นาที");
    live.patientName = "Live patient";
    const completed = consultation("completed", "30 นาที");
    completed.patientName = "Completed patient";
    const data: DoctorConsultationsData = {
      consultations: [scheduled, live, completed],
      prescriptionProducts: [],
      summary: { scheduled: 1, live: 1, completed: 1 }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data }));

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-controls="doctor-consultation-status-list"');
    expect(html).toContain("รายการปรึกษา");
    expect(html).toContain("กำลังแสดง: พร้อมตรวจ");
    expect(html).toContain("Ready patient");
    expect(html).not.toContain("Live patient");
    expect(html).not.toContain("Completed patient");
    expect(html.match(/min-h-24/g)).toHaveLength(3);
  });

  it("maps exactly one operational status group at a time without losing other-status awareness", () => {
    const scheduled = consultation("scheduled", "15 นาที");
    const live = consultation("live", "30 นาที");
    const completed = consultation("completed", "30 นาที");
    const pending = consultation("pending_payment", "30 นาที");
    const consultations = [scheduled, live, completed, pending];

    expect(filterDoctorConsultationsByQueueStatus(consultations, "scheduled")).toEqual([scheduled]);
    expect(filterDoctorConsultationsByQueueStatus(consultations, "live")).toEqual([live]);
    expect(filterDoctorConsultationsByQueueStatus(consultations, "completed")).toEqual([completed]);
    expect(getNonOperationalDoctorConsultationCount(consultations)).toBe(1);
  });

  it("keeps the selected queue empty instead of switching groups automatically", () => {
    const data: DoctorConsultationsData = {
      consultations: [consultation("live", "30 นาที")],
      prescriptionProducts: [],
      summary: { scheduled: 0, live: 1, completed: 0 }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data }));

    expect(html).toContain("ยังไม่มีรายการพร้อมตรวจ");
    expect(html).not.toContain("<article");
  });

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

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "scheduled" }));

    expect(html.match(/ระยะเวลานัด/g)).toHaveLength(1);
    expect(html).toContain("45 นาที");
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

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "completed" }));

    expect(html).toContain("ระยะเวลานัด");
    expect(html).toContain("ยังไม่ระบุ");
  });

  it("links a completed assigned consultation to its read-only chat history", () => {
    const data: DoctorConsultationsData = {
      consultations: [consultation("completed", "30 นาที")],
      prescriptionProducts: [],
      summary: { scheduled: 0, live: 0, completed: 1 }
    };

    const html = renderToStaticMarkup(
      createElement(DoctorConsultations, { data, initialSelectedStatus: "completed" })
    );

    expect(html).toContain("ประวัติแชต");
    expect(html).toContain("/doctor/consultations/consultation-completed/chat-history");
    expect(html).not.toContain("เปิดแชท/ห้องปรึกษา");
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

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "completed" }));

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

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "completed" }));

    expect(html.match(/<option>รอแพทย์สรุป<\/option>/g)).toHaveLength(1);
    expect(html.match(/<option>มีใบสั่งยา<\/option>/g)).toHaveLength(1);
    expect(html.match(/<option>ไม่มีใบสั่งยา<\/option>/g)).toHaveLength(1);
    expect(html).toContain('data-outcome-form="pending_doctor_summary"');
  });

  it("keeps the outcome read-only for Admin support access", () => {
    const completed = consultation("completed", "30 นาที");
    completed.canUpdatePrescriptionOutcome = false;
    const data: DoctorConsultationsData = {
      consultations: [completed],
      prescriptionProducts: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 1
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "completed" }));

    expect(html).toContain("ผลสรุปใบสั่งยา");
    expect(html).toContain("รอแพทย์สรุป");
    expect(html).not.toContain("data-outcome-form");
    expect(html).not.toContain("<option");
  });

  it("shows protected recording actions on a completed consultation", () => {
    const completed = consultation("completed", "30 นาที");
    completed.recordings = [
      {
        id: "recording-video-1",
        kind: "video",
        title: "วิดีโอหน้าจอและผู้พูด",
        fileTypeLabel: "MP4",
        fileSizeLabel: "12 MB",
        recordedAtLabel: "3 ส.ค. 2569 09:00",
        durationLabel: "30 นาที",
        retentionUntilLabel: "3 ส.ค. 2574"
      }
    ];
    const data: DoctorConsultationsData = {
      consultations: [completed],
      prescriptionProducts: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 1
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorConsultations, { data, initialSelectedStatus: "completed" }));

    expect(html).toContain("บันทึกการปรึกษา");
    expect(html).toContain("วิดีโอหน้าจอและผู้พูด");
    expect(html).toContain("เปิดดู");
    expect(html).toContain("ดาวน์โหลด");
    expect(html).not.toContain("href=\"/api/consultations/consultation-completed/recordings/recording-video-1");
  });
});
