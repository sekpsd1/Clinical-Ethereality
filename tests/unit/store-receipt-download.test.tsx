import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderReceiptDownload } from "@/features/orders/OrderReceiptDownload";

describe("Store receipt download links", () => {
  it("provides a native link and a selectable fallback before JavaScript runs in LINE", () => {
    const browserUrl = "https://example.test/store/orders/order-1";
    const html = renderToStaticMarkup(createElement(OrderReceiptDownload, { orderId: "order-1", browserUrl }));
    expect(html).toContain('href="https://example.test/store/orders/order-1?openExternalBrowser=1"');
    expect(html).toContain('value="https://example.test/store/orders/order-1"');
    expect(html).not.toContain("/api/orders/");
  });

  it("links directly to the private PDF in an external browser", () => {
    const html = renderToStaticMarkup(createElement(OrderReceiptDownload, { orderId: "order-1" }));
    expect(html).toContain('href="/api/orders/order-1/receipt"');
    expect(html).toContain("download");
  });
});
