import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { ConsultationChatHistory } from "@/features/consultations/chat/ConsultationChatHistory";
import type { ConsultationChatHistoryData } from "@/features/consultations/chat/history-types";

describe("read-only consultation chat history UI", () => {
  it("renders chronological sender and timestamp details with page-only navigation", () => {
    const data: ConsultationChatHistoryData = {
      consultationId: "consultation-1",
      viewerRole: "customer",
      counterpartName: "พญ. แพทย์หนึ่ง",
      page: 1,
      pageSize: 50,
      totalMessages: 51,
      totalPages: 2,
      messages: [
        {
          id: "message-1",
          body: "ข้อความที่หนึ่ง",
          createdAt: "2030-01-01T03:00:00.000Z",
          senderName: "พญ. แพทย์หนึ่ง",
          senderRole: "doctor",
          isOwnMessage: false
        },
        {
          id: "message-2",
          body: "ข้อความที่สอง",
          createdAt: "2030-01-01T03:01:00.000Z",
          senderName: "ผู้รับบริการหนึ่ง",
          senderRole: "customer",
          isOwnMessage: true
        }
      ]
    };

    const html = renderToStaticMarkup(
      createElement(ConsultationChatHistory, {
        data,
        backHref: "/consult/appointments/consultation-1" as Route,
        pageHref: "/consult/appointments/consultation-1/chat-history"
      })
    );

    expect(html).toContain("ประวัติแชต");
    expect(html).toContain("อ่านอย่างเดียวหลังจบการปรึกษา");
    expect(html).toContain("แชตในแอป Clinical lab service เท่านั้น ไม่รวม Zoom Chat");
    expect(html.indexOf("ข้อความที่หนึ่ง")).toBeLessThan(html.indexOf("ข้อความที่สอง"));
    expect(html).toContain("พญ. แพทย์หนึ่ง • แพทย์");
    expect(html).toContain("ผู้รับบริการหนึ่ง • ผู้รับบริการ");
    expect(html).toContain("dateTime=\"2030-01-01T03:00:00.000Z\"");
    expect(html).toContain("/chat-history?page=2");
    expect(html).not.toContain("message-1");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<textarea");
    expect(html).toContain("ดาวน์โหลดแชต");
    expect(html).toContain("clinical-lab-chat-history.txt");
    expect(html).toContain("/api/consultations/consultation-1/chat-history/download");
    expect(html).not.toContain("ดาวน์โหลด Zoom Chat");
    expect(html).not.toContain("ส่งข้อความ");
    expect(html).not.toContain("แก้ไข");
    expect(html).not.toContain("ลบข้อความ");
  });
});
