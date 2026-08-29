import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { userId: string; role: "customer" | "doctor" | "admin" | "pharmacist"; displayName?: string | null },
  findFirst: vi.fn(),
  signature: vi.fn(),
  zak: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: () => mocks.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { consultation: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/env/schema", () => ({ getAppEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://app.example.test" }) }));
vi.mock("@/lib/zoom/meeting-sdk", () => ({ issueZoomMeetingSdkSignature: mocks.signature }));
vi.mock("@/lib/zoom/meetings", () => ({ getZoomHostZakIfConfigured: mocks.zak }));

import { getZoomMeetingFrameAccess, getZoomMeetingJoinData } from "@/features/consultations/zoom/queries";

const scheduledAt = new Date("2030-01-01T10:00:00.000Z");
const afterAppointment = new Date("2030-01-01T10:01:00.000Z");

describe("Zoom consultation access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
    mocks.findFirst.mockResolvedValue({
      id: "consultation-1",
      status: "live",
      scheduledAt,
      zoomMeetingId: "12345678901",
      zoomPassword: "passcode"
    });
    mocks.signature.mockResolvedValue("sdk-signature");
    mocks.zak.mockResolvedValue("host-zak");
  });

  it("issues a host signature and ZAK only to the assigned doctor", async () => {
    mocks.session = { userId: "doctor-1", role: "doctor", displayName: "Dr A" };

    const data = await getZoomMeetingJoinData("consultation-1", afterAppointment);

    expect(mocks.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      doctor: { userId: "doctor-1" },
      status: "live",
      scheduledAt: { lte: afterAppointment }
    });
    expect(mocks.signature).toHaveBeenCalledWith("12345678901", 1);
    expect(mocks.zak).toHaveBeenCalledOnce();
    expect(data).toMatchObject({ available: true, zak: "host-zak", userName: "Dr A" });
  });

  it("issues only a participant signature to the consultation owner", async () => {
    mocks.session = { userId: "customer-1", role: "customer", displayName: "Customer" };

    const data = await getZoomMeetingJoinData("consultation-1", afterAppointment);

    expect(mocks.findFirst.mock.calls[0]?.[0].where).toMatchObject({ patientId: "customer-1" });
    expect(mocks.signature).toHaveBeenCalledWith("12345678901", 0);
    expect(mocks.zak).not.toHaveBeenCalled();
    expect(data).toMatchObject({ available: true, userName: "Customer" });
    expect(JSON.stringify(data)).not.toContain("host-zak");
  });

  it("authorizes the isolated frame without minting a signature or host token", async () => {
    mocks.session = { userId: "doctor-1", role: "doctor", displayName: "Dr A" };

    const data = await getZoomMeetingFrameAccess("consultation-1", afterAppointment);

    expect(mocks.findFirst.mock.calls[0]?.[0].where).toMatchObject({ doctor: { userId: "doctor-1" } });
    expect(mocks.signature).not.toHaveBeenCalled();
    expect(mocks.zak).not.toHaveBeenCalled();
    expect(data).toMatchObject({ available: true, consultationId: "consultation-1" });
  });

  it("blocks role mismatches before querying consultation data", async () => {
    mocks.session = { userId: "pharmacist-1", role: "pharmacist", displayName: "Pharmacist" };

    const data = await getZoomMeetingJoinData("consultation-1");

    expect(data).toMatchObject({ available: false });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.signature).not.toHaveBeenCalled();
  });

  it("blocks admin live-room access before querying consultation data", async () => {
    mocks.session = { userId: "admin-1", role: "admin", displayName: "Admin" };

    const data = await getZoomMeetingJoinData("consultation-1", afterAppointment);

    expect(data).toMatchObject({ available: false });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.signature).not.toHaveBeenCalled();
  });

  it("fails closed when the database result is not live or is before the time gate", async () => {
    mocks.session = { userId: "customer-1", role: "customer" };
    mocks.findFirst.mockResolvedValue({
      id: "consultation-1",
      status: "scheduled",
      scheduledAt,
      zoomMeetingId: "12345678901",
      zoomPassword: "passcode"
    });

    const data = await getZoomMeetingJoinData(
      "consultation-1",
      new Date("2030-01-01T09:59:59.000Z")
    );

    expect(data).toMatchObject({ available: false });
    expect(mocks.signature).not.toHaveBeenCalled();
  });

  it("fails safely without credential details when signing is unavailable", async () => {
    mocks.session = { userId: "customer-1", role: "customer" };
    mocks.signature.mockResolvedValue(null);

    const data = await getZoomMeetingJoinData("consultation-1", afterAppointment);

    expect(data).toMatchObject({ available: false });
    expect(JSON.stringify(data)).not.toContain("meeting-sdk-client-secret");
  });
});
