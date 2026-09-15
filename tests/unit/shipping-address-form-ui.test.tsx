import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThaiAddressLoadMessage } from "@/components/address/ThaiAddressFields";
import { ShippingAddressForm } from "@/features/profile/shipping-addresses/ShippingAddressForm";

describe("shipping address mobile form", () => {
  it("keeps free-text delivery lines and renders dependent Thai geography controls", () => {
    const html = renderToStaticMarkup(createElement(ShippingAddressForm));

    expect(html).toContain("บ้านเลขที่ ถนน ซอย");
    expect(html).toContain('name="province"');
    expect(html).toContain('name="district"');
    expect(html).toContain('name="subdistrict"');
    expect(html).toContain('name="postalCode"');
    expect(html).toContain("กำลังโหลดข้อมูลที่อยู่ประเทศไทย");
    expect(html).toContain("h-11 w-full");
    expect(html).toContain("h-12 w-full");
  });

  it("keeps legacy geography visible during loading so an edit does not blank stored values", () => {
    const html = renderToStaticMarkup(
      createElement(ShippingAddressForm, {
        address: {
          id: "legacy-address",
          label: "บ้านเดิม",
          recipientName: "ลูกค้าเดิม",
          phone: "0812345678",
          addressLine1: "1 ถนนเดิม",
          addressLine2: null,
          province: "จังหวัดเดิม",
          district: "อำเภอเดิม",
          subdistrict: "ตำบลเดิม",
          postalCode: "99999",
          isDefault: true
        }
      })
    );

    expect(html).toContain("จังหวัดเดิม");
    expect(html).toContain("อำเภอเดิม");
    expect(html).toContain("ตำบลเดิม");
    expect(html).toContain('value="99999"');
  });

  it("provides a recoverable dataset loading error without a custom keyboard overlay", () => {
    const html = renderToStaticMarkup(
      createElement(ThaiAddressLoadMessage, { status: "error", onRetry: () => undefined })
    );

    expect(html).toContain("โหลดข้อมูลที่อยู่ไม่สำเร็จ");
    expect(html).toContain("ลองใหม่");
    expect(html).toContain('type="button"');
  });
});
