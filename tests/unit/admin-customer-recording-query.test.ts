import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customerFindFirst: vi.fn(),
  doctorFindFirst: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.customerFindFirst },
    doctor: { findFirst: mocks.doctorFindFirst }
  }
}));

import { getAdminCustomerDetail } from "@/features/admin/customers/queries";

describe("Admin customer recording query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customerFindFirst.mockResolvedValue(null);
    mocks.doctorFindFirst.mockResolvedValue(null);
  });

  it("loads only the canonical screen-and-speaker MP4 for direct and assessment-linked consultations", async () => {
    await getAdminCustomerDetail("customer-1");
    const query = mocks.customerFindFirst.mock.calls[0]?.[0];
    const expectedWhere = {
      provider: "zoom",
      fileType: "mp4",
      recordingType: "shared_screen_with_speaker_view"
    };

    expect(query.include.consultations.include.recordings.where).toEqual(expectedWhere);
    expect(
      query.include.consultAssessments.include.consultations.include.recordings.where
    ).toEqual(expectedWhere);
  });
});
