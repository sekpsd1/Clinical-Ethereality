import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: mocks.noStore }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { consultation: { findFirst: mocks.findFirst, count: mocks.count } } }));

import { ProfileUpcomingAppointment } from "@/features/profile/ProfileUpcomingAppointment";
import { getCustomerUpcomingAppointment } from "@/features/profile/upcoming-appointment";

const customerSession: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

describe("customer upcoming appointment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads only the signed-in customer's future confirmed appointment", async () => {
    const now = new Date("2026-09-17T03:00:00.000Z");
    mocks.findFirst.mockResolvedValue({
      id: "consultation-1",
      scheduledAt: new Date("2026-09-18T02:00:00.000Z"),
      doctor: { user: { displayName: "พญ. แพทย์ทดสอบ" } }
    });
    mocks.count.mockResolvedValue(3);

    await expect(getCustomerUpcomingAppointment(customerSession, now)).resolves.toMatchObject({
      appointment: {
        id: "consultation-1",
        doctorName: "พญ. แพทย์ทดสอบ",
        relativeDayLabel: "พรุ่งนี้",
        additionalCount: 2,
        isImminent: true
      }
    });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { patientId: "customer-1", status: "scheduled", scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" }
    }));
    expect(mocks.count).toHaveBeenCalledWith({ where: { patientId: "customer-1", status: "scheduled", scheduledAt: { gte: now } } });
  });

  it("rejects staff roles before reading appointments", async () => {
    for (const role of ["doctor", "pharmacist", "admin"] as const) {
      await expect(getCustomerUpcomingAppointment({ ...customerSession, role })).rejects.toThrow("This role is not allowed");
    }
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("hides the section when no confirmed future appointment is available", () => {
    expect(renderToStaticMarkup(createElement(ProfileUpcomingAppointment, { data: { appointment: null } }))).toBe("");
  });

  it("renders the next appointment, urgency text, remaining count, and safe detail route", () => {
    const html = renderToStaticMarkup(createElement(ProfileUpcomingAppointment, {
      data: {
        appointment: {
          id: "consultation-1",
          doctorName: "พญ. ชื่อแพทย์สำหรับทดสอบการตัดบรรทัดบนมือถือ",
          scheduledDateTime: "18 ก.ย. 2569 09:00 น.",
          relativeDayLabel: "พรุ่งนี้",
          isImminent: true,
          additionalCount: 2
        }
      }
    }));

    expect(html).toContain('id="upcoming-appointment-heading"');
    expect(html).toContain("นัดปรึกษาที่กำลังจะมาถึง");
    expect(html).toContain("นัดของคุณใกล้ถึงเวลาแล้ว");
    expect(html).toContain("และอีก 2 นัด");
    expect(html).toContain('href="/consult/appointments/consultation-1"');
    expect(html).toContain("break-words");
  });
});
