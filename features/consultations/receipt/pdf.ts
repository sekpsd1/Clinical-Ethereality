import PDFDocument from "pdfkit";
import path from "node:path";
import { formatReceiptDate, receiptIssuer, type ConsultationReceipt } from "./model";
import { hasReceiptGlyphs } from "./font-coverage";

const fontRoot = path.join(process.cwd(), "assets", "fonts", "receipt");

/** In-memory generation only. No patient content enters file storage or PDF metadata. */
export async function renderConsultationReceipt(receipt: ConsultationReceipt): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4", margin: 48, autoFirstPage: true,
    info: { Title: "Consultation payment receipt", Author: "Bangkok Cytogenetics Clinic" }
  });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Attach rejection handler immediately, including synchronous generation failures.
  void complete.catch(() => undefined);
  try {
    for (const [name, file] of Object.entries({
      Thai: "NotoSansThai-Regular.ttf", ThaiBold: "NotoSansThai-Bold.ttf",
      Latin: "NotoSans-Regular.ttf", LatinBold: "NotoSans-Bold.ttf"
    })) doc.registerFont(name, path.join(fontRoot, file));

    const width = doc.page.width - 96;
    // Layout explicitly: PDFKit's continued-run wrapper can overflow long references.
    // Fontkit shapes whole runs; Thai graphemes are never split at a line boundary.
    const words = new Intl.Segmenter("th", { granularity: "word" });
    const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
    function text(value: string, size = 12, bold = false) {
      if (!hasReceiptGlyphs(value)) throw new Error("Unsupported receipt glyph");
      doc.fontSize(size);
      function runs(line: string) {
        return (line.match(/[\u0e00-\u0e7f]+|[^\u0e00-\u0e7f]+/gu) ?? []).map(value => {
          const base = /[\u0e00-\u0e7f]/u.test(value) ? "Thai" : "Latin";
          const font = bold ? `${base}Bold` : base;
          return { value, font, width: doc.font(font).widthOfString(value) };
        });
      }
      const measure = (line: string) => runs(line).reduce((sum, run) => sum + run.width, 0);
      const lineHeight = size * 1.75;
      function flush(line: string) {
        if (!line.trim()) return;
        if (doc.y + lineHeight > doc.page.height - 48) doc.addPage();
        const y = doc.y;
        let x = 48;
        for (const run of runs(line)) {
          doc.font(run.font).text(run.value, x, y, { lineBreak: false });
          x += run.width;
        }
        doc.x = 48;
        doc.y = y + lineHeight;
      }
      let line = "";
      for (const word of words.segment(value)) {
        if (measure(line + word.segment) > width && measure(word.segment) <= width) {
          flush(line); line = "";
        }
        for (const part of graphemes.segment(word.segment)) {
          if (measure(line + part.segment) > width) { flush(line); line = ""; }
          line += part.segment;
        }
      }
      flush(line);
      doc.y += size * 0.65;
    }
    doc.fillColor("#115e59");
    text("ใบเสร็จรับเงินค่าปรึกษา", 20, true);
    doc.fillColor("#191c1e");
    text(receiptIssuer.name, 14, true);
    text(receiptIssuer.address);
    doc.moveDown();
    text(`เลขอ้างอิงใบเสร็จ: ${receipt.reference}`);
    text(`วันที่ยืนยันรับชำระเงิน: ${formatReceiptDate(receipt.confirmedAt)}`);
    text(`ชื่อผู้ชำระตามบัญชีผู้ใช้: ${receipt.payerAccountName}`);
    doc.moveDown();
    const ruleY = doc.y;
    doc.moveTo(48, ruleY).lineTo(doc.page.width - 48, ruleY).strokeColor("#cbd5d1").stroke();
    doc.moveDown();
    text("รายการ: ค่าปรึกษาแพทย์", 14, true);
    text(`จำนวนเงินที่รับชำระ: ${Number(receipt.amount).toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })} ${receipt.currency}`, 16, true);
    text(`ช่องทางชำระเงิน: ${receipt.channel}`);
    doc.moveDown();
    doc.fillColor("#4b5563");
    text("เอกสารรับชำระเงินจากระบบ ไม่ใช่ใบกำกับภาษี", 10);
    text("ชื่อผู้ชำระแสดงตามบัญชีผู้ใช้ปัจจุบัน วันที่แสดงเป็นวันที่ยืนยันรับชำระเงิน ไม่ใช่เวลาโอนจากธนาคาร", 10);
    doc.end();
    return await complete;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
