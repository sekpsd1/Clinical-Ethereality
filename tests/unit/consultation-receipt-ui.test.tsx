import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReceiptImage } from "@/features/consultations/receipt/ReceiptImage";

describe("receipt download action", () => {
  it("withholds absent/ineligible receipts", () => {
    expect(renderToStaticMarkup(<ReceiptImage href={null} />)).toBe("");
    expect(renderToStaticMarkup(<ReceiptImage />)).toBe("");
  });
  it("uses a native download with no prefetch, target window, consent or form submission", () => {
    const html = renderToStaticMarkup(<ReceiptImage href="/api/consultations/owned/receipt" />);
    expect(html).toContain('href="/api/consultations/owned/receipt?format=jpg&amp;download=1"');
    expect(html).toContain('download=""');
    expect(html).toContain("ดาวน์โหลดใบเสร็จ JPG");
    expect(html).not.toMatch(/<form|target=|prefetch|type="submit"/);
  });
});
