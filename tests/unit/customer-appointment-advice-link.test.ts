import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  findFirst: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_noStore: mocks.noStore
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consultation: {
      findFirst: mocks.findFirst
    }
  }
}));

import { getCustomerAppointmentDetail } from "@/features/consultations/appointment/queries";

const session: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

describe("completed appointment advice link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the owned consultation id to the advice log", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "consultation-1",
      doctorId: "doctor-profile-1",
      status: "completed",
      scheduledAt: new Date("2030-01-01T03:00:00.000Z"),
      doctor: {
        specialty: "เวชศาสตร์ครอบครัว",
        consultationFee: 500,
        user: {
          displayName: "พญ. แพทย์จริง",
          avatarUrl: null
        }
      },
      payment: {
        status: "verified"
      }
    });

    const data = await getCustomerAppointmentDetail(session, "consultation-1");

    expect(data.appointment?.ctaHref).toBe(
      "/consult/advice-log?consultation=consultation-1"
    );
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "consultation-1",
          patientId: "customer-1"
        }
      })
    );
  });
});
