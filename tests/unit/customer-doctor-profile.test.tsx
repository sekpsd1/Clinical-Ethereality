import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DoctorProfile } from "@/features/consultations/doctor-profile/DoctorProfile";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { doctor: { findFirst: mocks.findFirst } } }));
import { getCustomerDoctorProfile } from "@/features/consultations/doctor-profile/queries";
const doctor = {
  id: "cm000000000000000000000001", bio: "ตัวอย่าง\n<script>alert(1)</script>",
  specialty: "สูตินรีเวช", licenseNumber: "ตัวอย่าง", consultationFee: 1234,
  user: { fullName: "แพทย์ตัวอย่าง", displayName: "LINE alias", avatarUrl: null }
};
describe("customer doctor profile", () => {
  it("rejects invalid ids without querying", async () => {
    mocks.findFirst.mockClear();
    expect(await getCustomerDoctorProfile("fallback-demo")).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("selects only approved active doctors and professional fields", async () => {
    mocks.findFirst.mockResolvedValue(doctor);
    expect(await getCustomerDoctorProfile(doctor.id)).toEqual(doctor);
    const query = mocks.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: doctor.id, status: "approved", user: { status: "active" } });
    expect(Object.keys(query.select).sort()).toEqual(["bio", "consultationFee", "id", "licenseNumber", "specialty", "user"]);
    expect(query.select.user.select).toEqual({ fullName: true, displayName: true, avatarUrl: true });
  });
  it("escapes biography and shows persisted fee, name and booking link", () => {
    const html = renderToStaticMarkup(<DoctorProfile doctor={doctor} bookingHref="/consult/assessment" />);
    expect(html).toContain("แพทย์ตัวอย่าง");
    expect(html).not.toContain("LINE alias");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("1,234 บาท / 15 นาที");
    expect(html).toContain('href="/consult/assessment"');
  });
  it("handles missing biography and fee", () => {
    const html = renderToStaticMarkup(<DoctorProfile doctor={{ ...doctor, bio: null, consultationFee: null }} bookingHref="/consult/assessment" />);
    expect(html).toContain("ยังไม่มีข้อมูลประวัติแพทย์");
    expect(html).toContain("ยังไม่ระบุค่าปรึกษา");
  });
  it("links photo, name and history separately from booking", () => {
    const html = renderToStaticMarkup(<ConsultDoctorList data={{ activeRecommendation: null, doctors: [{
      id: doctor.id, name: "แพทย์ตัวอย่าง", specialty: "ตัวอย่าง", tags: [], price: "1,234 บาท",
      rating: "4.9", imageSrc: "/images/doctors/kamonpat.jpg", isRecommended: false,
      profileHref: `/consult/doctors/${doctor.id}` as import("next").Route, bookingHref: "/consult/assessment"
    }] }} />);
    expect(html.match(new RegExp(`href="/consult/doctors/${doctor.id}"`, "g"))).toHaveLength(3);
    expect(html).toContain("ดูประวัติแพทย์");
    expect(html).toContain('href="/consult/assessment"');
  });
});
