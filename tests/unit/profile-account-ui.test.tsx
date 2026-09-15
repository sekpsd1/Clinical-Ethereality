import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  useActionState: vi.fn(),
  useEffect: vi.fn(),
  setEditing: vi.fn(),
  editing: true
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: mocks.useActionState,
    useEffect: mocks.useEffect,
    useState: () => [mocks.editing, mocks.setEditing]
  };
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => ({ pending: false }) };
});

import { AccountContactEditor } from "@/features/profile/AccountContactEditor";
import { ProfileSettings } from "@/features/profile/ProfileSettings";
import { formatCustomerDateOfBirth } from "@/features/profile/types";

describe("customer profile account UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editing = true;
    mocks.useActionState.mockReturnValue([{ status: "idle", message: "" }, mocks.action]);
  });

  it("renders editable canonical identity, email, and the established phone correction field", () => {
    const html = renderToStaticMarkup(
      <AccountContactEditor
        rows={[]}
        fullName="ผู้ป่วย ทดสอบ"
        dateOfBirth="1990-01-02"
        email="patient@example.com"
        phone="0812345678"
        phoneVerified
        shippingAddressHref="/profile/shipping-addresses?returnTo=%2Fprofile%2Fsettings%3Fsection%3Daccount"
      />
    );

    expect(html).toContain('name="fullName"');
    expect(html).toContain('name="dateOfBirth"');
    expect(html).toContain('type="date"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('autoComplete="tel"');
    expect(html).toContain('inputMode="tel"');
    expect(html).toContain("0812345678");
    expect(html).not.toContain('name="nationalId"');
    expect(html).toContain("บันทึกหรือยกเลิกการแก้ไขข้อมูลบัญชีก่อน");
    expect(html).not.toContain('href="/profile/shipping-addresses');
  });

  it("formats DOB with a Thai Buddhist year", () => {
    expect(formatCustomerDateOfBirth("1990-01-02")).toBe("2 มกราคม 2533");
    expect(formatCustomerDateOfBirth(null)).toBe("ยังไม่ได้ระบุ");
  });

  it("keeps delivery-address navigation outside active account edits", () => {
    mocks.editing = false;
    const html = renderToStaticMarkup(
      <AccountContactEditor
        rows={[]}
        fullName="ผู้ป่วย ทดสอบ"
        dateOfBirth="1990-01-02"
        email="patient@example.com"
        phone="0812345678"
        phoneVerified
        shippingAddressHref="/profile/shipping-addresses?returnTo=%2Fprofile%2Fsettings%3Fsection%3Daccount"
      />
    );

    expect(html).toContain("จัดการที่อยู่");
    expect(html).toContain("ที่อยู่สำหรับการจัดส่งคำสั่งซื้อและร้านยา");
    expect(html).toContain('href="/profile/shipping-addresses?returnTo=%2Fprofile%2Fsettings%3Fsection%3Daccount"');
    expect(html).not.toContain('name="fullName"');
  });

  it("wires the account sheet shortcut to the existing shipping-address route", () => {
    mocks.editing = false;
    const html = renderToStaticMarkup(
      <ProfileSettings
        consentData={{ items: [], acceptedCount: 0, requiredCount: 0 }}
        profileData={{
          displayName: "Customer",
          fullName: "ผู้ป่วย ทดสอบ",
          dateOfBirth: "1990-01-02",
          avatarUrl: null,
          email: "patient@example.com",
          phone: "0812345678",
          phoneVerifiedAt: "2026-09-15T00:00:00.000Z",
          memberStatus: "สมาชิก",
          adviceCount: 0,
          postCount: 0
        }}
        rewardsEnabled={false}
        section="account"
      />
    );

    expect(html).toContain("ข้อมูลบัญชี");
    expect(html).toContain("จัดการที่อยู่");
    expect(html).toContain('href="/profile/shipping-addresses?returnTo=%2Fprofile%2Fsettings%3Fsection%3Daccount"');
  });
});
