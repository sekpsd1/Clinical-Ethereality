import { describe, expect, it } from "vitest";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { renderConsultationReceipt } from "@/features/consultations/receipt/pdf";

describe("actual Thai receipt PDF renderer", () => {
  it("fails closed for unsupported glyphs instead of rendering missing-character boxes", async () => {
    await expect(renderConsultationReceipt({
      reference: "CP-synthetic", payerAccountName: "ทดสอบ😀", amount: "1234.50",
      confirmedAt: new Date("2026-01-31T18:00:00Z"), currency: "THB", channel: "PromptPay"
    })).rejects.toThrow("Unsupported receipt glyph");
  });
  it("embeds Thai/Latin fonts and renders synthetic maximum/long content without business access", async () => {
    const bytes = await renderConsultationReceipt({
      reference: "CP-csyntheticreceiptpayment0000000000000000000000000000000000000000000000000000000000",
      payerAccountName: "นางสาวกัญญ์ณัฏฐ์ ศรีสุวรรณพัฒนกิจวัฒนสกุล ทดสอบข้อมูลจำลองเท่านั้น Test Payer ".repeat(3).slice(0, 255),
      amount: "99999999.99", confirmedAt: new Date("2026-01-31T18:00:00Z"), currency: "THB", channel: "PromptPay"
    });
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const syntax = bytes.toString("latin1");
    expect(syntax).toContain("/FontFile2");
    expect(syntax).toContain("/ToUnicode");
    expect(syntax).toContain("NotoSansThai");
    expect(syntax).toContain("NotoSans");
    if (process.env.RECEIPT_QA_OUTPUT) {
      await mkdir(process.env.RECEIPT_QA_OUTPUT, { recursive: true });
      await writeFile(path.join(process.env.RECEIPT_QA_OUTPUT, "consultation-receipt-synthetic.pdf"), bytes);
    }
  });
});
