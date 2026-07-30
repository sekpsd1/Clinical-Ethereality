import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomerCart } from "@/features/cart/CustomerCart";
import { StoreCheckout } from "@/features/products/StoreCheckout";
import type { CartData } from "@/features/cart/types";

const checkoutRequestId = "f75c16fe-0f6a-4ce8-8a1a-2048fb1272da";

function renderCheckout(cart: CartData, paymentAvailable = true): string {
  return renderToStaticMarkup(
    createElement(StoreCheckout, {
      cart,
      checkoutRequestId,
      paymentAvailable
    })
  );
}

describe("store checkout UI safety", () => {
  it("renders only real cart items and defers payment evidence until after order creation", () => {
    const html = renderCheckout({
      items: [
        {
          slug: "hpv-home-test-14",
          name: "HPV Home Test Kit",
          price: "฿1,200",
          quantity: 1,
          availableQuantity: 5,
          lineTotal: "฿1,200",
          requiresPrescription: false,
          media: "kit",
          stockLabel: "พร้อมจัดส่ง 5"
        }
      ],
      staleItems: [],
      itemCount: 1,
      subtotalAmount: 1200,
      subtotal: "฿1,200"
    });

    expect(html).toContain("HPV Home Test Kit");
    expect(html).toContain("สร้างคำสั่งซื้อ");
    expect(html).toContain(`value="${checkoutRequestId}"`);
    expect(html).not.toContain("Paracetamol 500mg");
    expect(html).not.toContain("Amoxicillin 500mg");
    expect(html).not.toContain("แนบหลักฐานการโอนเงิน");
    expect(html).not.toContain("123/45 หมู่บ้านอีธีเรียล");
  });

  it("does not render an order action or sample total for an empty cart", () => {
    const html = renderCheckout({
      items: [],
      staleItems: [],
      itemCount: 0,
      subtotalAmount: 0,
      subtotal: "฿0"
    });

    expect(html).toContain("ยังไม่มีสินค้าในตะกร้า");
    expect(html).not.toContain(`value="${checkoutRequestId}"`);
    expect(html).not.toContain("ยอดรวมสินค้า");
  });

  it("blocks order creation when PromptPay is not ready", () => {
    const html = renderCheckout(
      {
        items: [
          {
            slug: "hpv-home-test-14",
            name: "HPV Home Test Kit",
            price: "฿1,200",
            quantity: 1,
            availableQuantity: 5,
            lineTotal: "฿1,200",
            requiresPrescription: false,
            media: "kit",
            stockLabel: "พร้อมจัดส่ง 5"
          }
        ],
        staleItems: [],
        itemCount: 1,
        subtotalAmount: 1200,
        subtotal: "฿1,200"
      },
      false
    );

    expect(html).toContain("ระบบชำระเงินยังไม่พร้อม");
    expect(html).toContain("ยังไม่จองสต็อกหรือสร้างคำสั่งซื้อ");
    expect(html).not.toContain(`value="${checkoutRequestId}"`);
  });

  it("shows stale cookie entries and blocks checkout until the cart is cleared", () => {
    const cart: CartData = {
      items: [],
      staleItems: [{ slug: "archived-product", quantity: 2 }],
      itemCount: 0,
      subtotalAmount: 0,
      subtotal: "฿0"
    };
    const checkoutHtml = renderCheckout(cart);
    const cartHtml = renderToStaticMarkup(createElement(CustomerCart, { data: cart }));

    expect(checkoutHtml).toContain("archived-product");
    expect(checkoutHtml).toContain("มีสินค้าที่ไม่พร้อมจำหน่ายในตะกร้า");
    expect(checkoutHtml).not.toContain(`value="${checkoutRequestId}"`);
    expect(cartHtml).toContain("archived-product");
    expect(cartHtml).toContain("ล้างตะกร้าและเริ่มใหม่");
    expect(cartHtml).not.toContain('href="/store/checkout"');
  });
});
