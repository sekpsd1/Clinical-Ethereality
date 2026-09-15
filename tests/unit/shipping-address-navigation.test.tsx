import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShippingAddresses } from "@/features/profile/ShippingAddresses";

describe("shipping address return navigation", () => {
  it("preserves the safe account return target for the header and add-address action", () => {
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
    expect(html).toContain("กลับไปเลือกที่อยู่ในคำสั่งซื้อ");
  });
});
