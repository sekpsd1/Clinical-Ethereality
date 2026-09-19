import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoctorPatientDetail } from "@/features/doctor/DoctorPatientDetail";
import type { DoctorPatientDetailData } from "@/features/doctor/patients/detail-types";

describe("doctor patient history chat entry", () => {
  it("links only a completed assigned consultation to the full chat history", () => {
    const data: DoctorPatientDetailData = {
      patient: {
        id: "patient-1",
        name: "ผู้รับบริการหนึ่ง",
        reference: "PT-1234",
        consultations: [
          {
            id: "consultation-completed",
            status: "completed",
            statusLabel: "เสร็จสิ้น",
            scheduledAt: "1 ม.ค. 2573 10:00",
            createdAt: "1 ม.ค. 2573 09:00",
            summary: "ติดตามอาการ",
            chatHistoryHref: "/doctor/consultations/consultation-completed/chat-history",
            assessment: null,
            prescriptions: [],
            recentMessages: []
          },
          {
            id: "consultation-live",
            status: "live",
            statusLabel: "กำลังปรึกษา",
            scheduledAt: "2 ม.ค. 2573 10:00",
            createdAt: "2 ม.ค. 2573 09:00",
            summary: null,
            chatHistoryHref: null,
            assessment: null,
            prescriptions: [],
            recentMessages: []
          }
        ]
      }
    };

    const html = renderToStaticMarkup(createElement(DoctorPatientDetail, { data }));

    expect(html.match(/ประวัติแชต/g)).toHaveLength(1);
    expect(html).toContain("/doctor/consultations/consultation-completed/chat-history");
    expect(html).not.toContain("/doctor/consultations/consultation-live/chat-history");
  });
});
