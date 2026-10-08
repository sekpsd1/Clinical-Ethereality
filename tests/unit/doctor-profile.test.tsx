import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/doctor/consultations",
  requireRoleSession: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRoleSession: mocks.requireRoleSession
}));

import DoctorProfilePage from "@/app/doctor/profile/page";
import { DoctorShell } from "@/components/layout/DoctorShell";
import { DoctorProfile } from "@/features/doctor/DoctorProfile";

describe("Doctor profile navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/doctor/consultations";
  });

  it("keeps consultation and patient entries while adding a visible Doctor profile entry", () => {
    const html = renderToStaticMarkup(
      <DoctorShell viewerRole="doctor">
        <p>Doctor content</p>
      </DoctorShell>
    );

    expect(html).toContain('href="/doctor/consultations"');
    expect(html).toContain('href="/doctor/patients"');
    expect(html).toContain('href="/doctor/profile"');
    expect(html).toContain("โปรไฟล์");
    expect(html).toContain("grid-cols-3");
  });

  it("marks the profile entry active and keeps it hidden from Admin support navigation", () => {
    mocks.pathname = "/doctor/profile";

    const doctorHtml = renderToStaticMarkup(
      <DoctorShell viewerRole="doctor">
        <p>Doctor profile</p>
      </DoctorShell>
    );
    const adminHtml = renderToStaticMarkup(
      <DoctorShell viewerRole="admin">
        <p>Admin support</p>
      </DoctorShell>
    );

    const profileLink = doctorHtml.match(/<a[^>]*href="\/doctor\/profile"[^>]*>/)?.[0] ?? "";

    expect(profileLink).toContain('aria-current="page"');
    expect(adminHtml).not.toContain('href="/doctor/profile"');
    expect(adminHtml).toContain("grid-cols-2");
  });
});

describe("DoctorProfile", () => {
  it("shows only permitted account context and the existing logout control", () => {
    const html = renderToStaticMarkup(
      <DoctorProfile data={{ displayName: "แพทย์ทดสอบ", avatarUrl: null }} />
    );

    expect(html).toContain("โปรไฟล์แพทย์");
    expect(html).toContain("แพทย์ทดสอบ");
    expect(html).toContain("บัญชีแพทย์ที่เชื่อมต่อกับ LINE");
    expect(html).toContain("ออกจากระบบ");
    expect(html).toContain("เฉพาะ session ในเบราว์เซอร์นี้");
  });

  it("requires an exact Doctor session before rendering the page", async () => {
    mocks.requireRoleSession.mockResolvedValue({
      userId: "doctor-1",
      lineUserId: "line-doctor-1",
      role: "doctor",
      displayName: "แพทย์ทดสอบ",
      pictureUrl: "https://example.test/doctor.jpg",
      expiresAt: "2030-01-01T00:00:00.000Z"
    });

    const page = await DoctorProfilePage();
    const html = renderToStaticMarkup(page);

    expect(mocks.requireRoleSession).toHaveBeenCalledWith(["doctor"], "/doctor/profile");
    expect(html).toContain("แพทย์ทดสอบ");
  });
});
