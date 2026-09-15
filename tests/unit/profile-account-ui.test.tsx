import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  useActionState: vi.fn(),
  useEffect: vi.fn(),
  setEditing: vi.fn()
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: mocks.useActionState,
    useEffect: mocks.useEffect,
    useState: () => [true, mocks.setEditing]
  };
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => ({ pending: false }) };
});

import { AccountContactEditor } from "@/features/profile/AccountContactEditor";
import { formatCustomerDateOfBirth } from "@/features/profile/types";

describe("customer profile account UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("formats DOB with a Thai Buddhist year", () => {
    expect(formatCustomerDateOfBirth("1990-01-02")).toBe("2 มกราคม 2533");
    expect(formatCustomerDateOfBirth(null)).toBe("ยังไม่ได้ระบุ");
  });
});
