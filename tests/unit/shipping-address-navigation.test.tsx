import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShippingAddresses } from "@/features/profile/ShippingAddresses";

describe("shipping address return navigation", () => {
  it("uses account wording only for the exact account return target", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingAddresses, {
        addresses: [],
        showForm: false,
        returnTo: "/profile/settings?section=account"
      })
    );

    expect(html).toContain('aria-label="กลับไปข้อมูลบัญชี"');
    expect(html).toContain('href="/profile/settings?section=account"');
    expect(html).toContain('href="/profile/shipping-addresses?new=1&amp;returnTo=%2Fprofile%2Fsettings%3Fsection%3Daccount"');
    expect(html).toContain("กลับไปข้อมูลบัญชี");
    expect(html).not.toContain("กลับไปเลือกที่อยู่ในคำสั่งซื้อ");
  });

  it("retains order address-selection wording for checkout", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingAddresses, {
        addresses: [],
        showForm: false,
        returnTo: "/store/checkout"
      })
    );

    expect(html).toContain('aria-label="กลับไปเลือกที่อยู่ในคำสั่งซื้อ"');
    expect(html).toContain('href="/store/checkout"');
    expect(html).toContain('href="/profile/shipping-addresses?new=1&amp;returnTo=%2Fstore%2Fcheckout"');
    expect(html).toContain("กลับไปเลือกที่อยู่ในคำสั่งซื้อ");
  });

  it("does not label an arbitrary internal return target as an account or order flow", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingAddresses, {
        addresses: [],
        showForm: false,
        returnTo: "/community"
      })
    );

    expect(html).toContain('aria-label="กลับไปหน้าโปรไฟล์"');
    expect(html).not.toContain('href="/community"');
    expect(html).not.toContain("กลับไปข้อมูลบัญชี");
    expect(html).not.toContain("กลับไปเลือกที่อยู่ในคำสั่งซื้อ");
  });
});
