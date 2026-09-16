import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findFirst: mocks.findFirst } }
}));

import {
  hasPendingDoctorInvitation,
  requiresDoctorInvitationStatus
} from "@/features/staff-invite/pending-doctor";

describe("Doctor invitation session gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps both pending claims and approved stale customer sessions on the status screen", async () => {
    mocks.findFirst.mockResolvedValue({ id: "user-1" });

    await expect(requiresDoctorInvitationStatus("user-1")).resolves.toBe(true);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "user-1",
        OR: [
          { role: "customer", doctorProfile: { is: { status: "pending_review" } } },
          { role: "doctor", doctorProfile: { is: { status: "approved" } } }
        ],
        claimedDoctorInvitations: {
          some: {
            role: "doctor",
            claimedAt: { not: null },
            revokedAt: null
          }
        }
      }),
      select: { id: true }
    });
  });

  it("keeps the narrower pending predicate for claim status and legacy invite blocking", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(hasPendingDoctorInvitation("user-2")).resolves.toBe(false);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "user-2",
        role: "customer",
        doctorProfile: { is: { status: "pending_review" } }
      }),
      select: { id: true }
    });
  });
});
