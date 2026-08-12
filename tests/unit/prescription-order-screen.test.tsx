import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/products/prescriptions/actions", () => ({
  createPrescriptionOrderAction: vi.fn()
}));

vi.mock("@/features/profile/shipping-addresses/ShippingAddressSelector", () => ({
  ShippingAddressSelector: () => <select name="shippingAddressId"><option value="address-1">Home</option></select>
}));

import { PrescriptionOrderScreen } from "@/features/products/PrescriptionOrderScreen";

describe("doctor-issued prescription order screen", () => {
  it("shows only the doctor-selected product and submits no customer product selection", () => {
    const html = renderToStaticMarkup(
      createElement(PrescriptionOrderScreen, {
        data: {
          prescription: {
            id: "prescription-1",
            statusLabel: "พร้อมสั่งซื้อ",
            doctorName: "Doctor",
            pharmacistName: null,
            verifiedAt: null,
            notes: "Follow the instructions.",
            medicationSummary: "Doctor selected product",
            linkedOrderCode: null,
            isProductMappingComplete: true,
            products: [
              {
                id: "product-1",
                name: "Doctor selected product",
                slug: "doctor-selected-product",
                description: "Only the doctor-selected product is shown.",
                priceLabel: "1,200 บาท",
                stockLabel: "พร้อมจัดส่ง 5 ชิ้น",
                availableQuantity: 5,
                prescribedQuantity: 2
              }
            ]
          }
        }
      })
    );

    expect(html).toContain("Doctor selected product");
    expect(html).toContain("จำนวน 2 ชิ้น");
    expect(html).toContain('name="prescriptionId"');
    expect(html).not.toContain('name="productId"');
  });
});
