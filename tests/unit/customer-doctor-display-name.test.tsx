import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCustomerDoctorDisplayName } from "@/features/consultations/doctor-display-name";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";
import { DoctorBooking } from "@/features/consultations/DoctorBooking";

const mocks = vi.hoisted(() => ({ many: vi.fn(), first: vi.fn(), session: vi.fn(), assessment: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/features/consultations/booking/BookingTimeSlotForm", () => ({ BookingTimeSlotForm: () => null }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  doctor: { findMany: mocks.many, findFirst: mocks.first },
  consultAssessment: { findFirst: mocks.assessment }
} }));
import { getConsultDoctorListData } from "@/features/consultations/doctor-list/queries";
import { getDoctorBookingData } from "@/features/consultations/booking/queries";

const doctorId = "ck12345678901234567890123";
function fixture(fullName: string | null = "นพ. ชื่อจริง ตัวอย่าง", displayName: string | null = "LINE_ALIAS_FIXTURE") {
  return {
    id: doctorId, user: { fullName, displayName, avatarUrl: "/api/staff-files/synthetic-photo" },
    specialty: "สูตินรีเวช", consultationFee: 1250, availability: [], dateOverrides: []
  };
}

describe("Customer Doctor name preference", () => {
  it.each([
    [{ fullName: "  นพ. ชื่อจริง ตัวอย่าง  ", displayName: "LINE alias" }, "นพ. ชื่อจริง ตัวอย่าง"],
    [{ fullName: null, displayName: "Legacy alias" }, "Legacy alias"],
    [{ fullName: "  ", displayName: " Legacy alias " }, "Legacy alias"],
    [{ fullName: null, displayName: null }, "แพทย์ผู้ให้คำปรึกษา"],
    [{ fullName: "", displayName: " " }, "แพทย์ผู้ให้คำปรึกษา"]
  ])("uses existing data with explicit legacy fallback (%j)", (user, expected) => {
    expect(getCustomerDoctorDisplayName(user)).toBe(expected);
  });
  beforeEach(() => {
    vi.clearAllMocks(); mocks.session.mockResolvedValue(null);
    mocks.many.mockResolvedValue([fixture()]); mocks.first.mockResolvedValue(fixture());
  });
  it("selects persisted fullName on approved active Doctors without filtering or renaming records", async () => {
    const data = await getConsultDoctorListData();
    expect(data.doctors[0]).toMatchObject({
      id: doctorId, name: "นพ. ชื่อจริง ตัวอย่าง", specialty: "สูตินรีเวช",
      price: "1,250 บาท / 15 นาที", bookingHref: `/consult/assessment?doctorId=${doctorId}`,
      imageSrc: "/api/staff-files/synthetic-photo"
    });
    const query = mocks.many.mock.calls[0][0];
    expect(query.where).toEqual({ status: "approved", user: { status: "active" } });
    expect(query.include.user.select).toEqual({ avatarUrl: true, fullName: true, displayName: true });
    const html = renderToStaticMarkup(<ConsultDoctorList data={data} />);
    expect(html).toContain("นพ. ชื่อจริง ตัวอย่าง");
    expect(html).not.toContain("LINE_ALIAS_FIXTURE");
  });
  it("uses the same professional name in booking Doctor header data, preserving identifiers/fee/avatar/slots", async () => {
    const data = await getDoctorBookingData(doctorId);
    expect(data).toEqual({ doctor: {
      id: doctorId, name: "นพ. ชื่อจริง ตัวอย่าง", specialty: "สูตินรีเวช",
      fee: "1,250 บาท", avatarUrl: "/api/staff-files/synthetic-photo"
    }, slots: [] });
    const query = mocks.first.mock.calls[0][0];
    expect(query.where).toEqual({ id: doctorId, status: "approved", user: { status: "active" } });
    expect(query.include.user.select.fullName).toBe(true);
    const html = renderToStaticMarkup(<DoctorBooking data={data} verification={{
      fullName: null, dateOfBirth: null, nationalId: null, phone: null, phoneVerifiedAt: null, isVerified: false
    }} canSelfConsent={false} />);
    expect(html).toContain("นพ. ชื่อจริง ตัวอย่าง");
    expect(html).not.toContain("LINE_ALIAS_FIXTURE");
  });
  it("retains LINE/generic fallback consistently for legacy Doctors in both queries", async () => {
    for (const [fullName, displayName, expected] of [
      [null, "Legacy alias", "Legacy alias"], [" ", null, "แพทย์ผู้ให้คำปรึกษา"]
    ]) {
      mocks.many.mockResolvedValue([fixture(fullName, displayName)]);
      mocks.first.mockResolvedValue(fixture(fullName, displayName));
      expect((await getConsultDoctorListData()).doctors[0].name).toBe(expected);
      expect((await getDoctorBookingData(doctorId)).doctor?.name).toBe(expected);
    }
  });
  it("preserves existing assessment recommendation and booking identity with a professional name", async () => {
    mocks.session.mockResolvedValue({ userId: "customer-fixture" });
    mocks.assessment.mockResolvedValue({ recommendationTopic: "หัวข้อเดิม", recommendationSpecialty: "สาขาเดิม" });
    const data = await getConsultDoctorListData();
    expect(data.activeRecommendation).toEqual({ topic: "หัวข้อเดิม", specialty: "สาขาเดิม" });
    expect(data.doctors[0]).toMatchObject({
      id: doctorId, name: "นพ. ชื่อจริง ตัวอย่าง", isRecommended: true,
      bookingHref: `/consult/booking/somchai?doctorId=${doctorId}`
    });
  });
});
