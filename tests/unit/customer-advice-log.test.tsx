import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  consultationFindFirst: vi.fn(),
  attachmentFindFirst: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_noStore: mocks.noStore
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consultation: {
      findFirst: mocks.consultationFindFirst
    },
    fileAttachment: {
      findFirst: mocks.attachmentFindFirst
    }
  }
}));

import { AdviceLog } from "@/features/consultations/AdviceLog";
import { getCustomerAdviceLog } from "@/features/consultations/advice-log/queries";

const customerSession: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

function completedConsultation() {
  return {
    id: "consultation-1",
    scheduledAt: new Date("2030-01-01T03:00:00.000Z"),
    bookedDurationMinutes: 30,
    summary: "สรุปจริงสำหรับลูกค้าคนนี้",
    doctor: {
      specialty: "เวชศาสตร์ครอบครัว",
      userId: "doctor-1",
      user: {
        displayName: "พญ. แพทย์จริง",
        avatarUrl: "/images/doctors/real-doctor.jpg"
      }
    },
    prescriptions: [
      {
        id: "prescription-1",
        itemsJson: [
          {
            medicationName: "ยาทดสอบที่ออกจริง",
            dosage: "10 mg",
            quantity: "5 เม็ด",
            instructions: "รับประทานหลังอาหาร",
            warnings: "หยุดใช้หากมีผื่น"
          }
        ]
      }
    ]
  };
}

describe("customer advice log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.attachmentFindFirst.mockResolvedValue(null);
  });

  it("reads and renders only the requested completed consultation owned by the customer", async () => {
    mocks.consultationFindFirst.mockResolvedValue(completedConsultation());

    const data = await getCustomerAdviceLog(customerSession, "consultation-1");
    const html = renderToStaticMarkup(createElement(AdviceLog, { data }));

    expect(mocks.consultationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-1",
          patientId: "customer-1",
          status: "completed"
        }
      })
    );
    expect(data.advice).toMatchObject({
      doctorName: "พญ. แพทย์จริง",
      summary: "สรุปจริงสำหรับลูกค้าคนนี้",
      returnHref: "/consult/appointments/consultation-1"
    });
    expect(html).toContain("พญ. แพทย์จริง");
    expect(html).toContain("สรุปจริงสำหรับลูกค้าคนนี้");
    expect(html).toContain("ยาทดสอบที่ออกจริง");
    expect(html).toContain("/consult/appointments/consultation-1");
    expect(html).not.toContain("นพ. ธีรภัทร์ รัตนวานิช");
    expect(html).not.toContain("ใบสั่งยา_0421.pdf");
    expect(html).not.toContain('href="/consult/live"');
  });

  it("fails closed when the consultation is not owned or not completed", async () => {
    mocks.consultationFindFirst.mockResolvedValue(null);

    const data = await getCustomerAdviceLog(customerSession, "consultation-other");
    const html = renderToStaticMarkup(createElement(AdviceLog, { data }));

    expect(data).toEqual({ advice: null });
    expect(mocks.attachmentFindFirst).not.toHaveBeenCalled();
    expect(html).toContain("ไม่พบสรุปผลการปรึกษา");
    expect(html).toContain('href="/consult"');
  });

  it("rejects a malformed consultation id before reading the database", async () => {
    await expect(
      getCustomerAdviceLog(customerSession, "../doctor/consultations")
    ).resolves.toEqual({ advice: null });
    expect(mocks.consultationFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a doctor before reading a customer consultation", async () => {
    await expect(
      getCustomerAdviceLog(
        {
          ...customerSession,
          userId: "doctor-1",
          role: "doctor"
        },
        "consultation-1"
      )
    ).rejects.toThrow("This role is not allowed");
    expect(mocks.consultationFindFirst).not.toHaveBeenCalled();
  });
});
