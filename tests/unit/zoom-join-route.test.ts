import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getZoomExternalMeetingJoinData: vi.fn()
}));

vi.mock("@/features/consultations/zoom/queries", () => ({
  getZoomExternalMeetingJoinData: mocks.getZoomExternalMeetingJoinData
}));

import { GET } from "@/app/api/consultations/[consultationId]/zoom-join/route";

describe("Zoom external-browser join-data route", () => {
  it("uses the existing access helper and prevents browser caching", async () => {
    mocks.getZoomExternalMeetingJoinData.mockResolvedValue({
      available: false,
      consultationId: "consultation-1",
      leaveUrl: "https://app.example.test/consult",
      message: "Zoom room is unavailable"
    });

    const response = await GET(new Request("https://app.example.test/api/consultations/consultation-1/zoom-join"), {
      params: Promise.resolve({ consultationId: "consultation-1" })
    });

    expect(mocks.getZoomExternalMeetingJoinData).toHaveBeenCalledWith("consultation-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ available: false });
  });
});
