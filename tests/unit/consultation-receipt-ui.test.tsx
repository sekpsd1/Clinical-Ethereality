import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReceiptDownload } from "@/features/consultations/receipt/ReceiptDownload";

describe("receipt download action", () => {
  it("withholds absent/ineligible receipts", () => {
    expect(renderToStaticMarkup(<ReceiptDownload href={null} />)).toBe("");
    expect(renderToStaticMarkup(<ReceiptDownload />)).toBe("");
  });
  it("uses a native download with no prefetch, target window, consent or form submission", () => {
    const html = renderToStaticMarkup(<ReceiptDownload href="/api/consultations/owned/receipt" />);
    expect(html).toContain('href="/api/consultations/owned/receipt"');
    expect(html).toContain('download=""');
    expect(html).toContain("ดาวน์โหลดใบเสร็จค่าปรึกษา (PDF)");
    expect(html).not.toMatch(/<form|target=|prefetch|type="submit"/);
  });
});
