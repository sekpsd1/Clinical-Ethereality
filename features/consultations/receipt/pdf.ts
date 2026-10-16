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

    const pageWidth = doc.page.width - 96;
    const ink = "#191c1e";
    const teal = "#115e59";
    const muted = "#4b5563";
    // Layout explicitly: PDFKit's continued-run wrapper can overflow long references.
    // Fontkit shapes whole runs; Thai graphemes are never split at a line boundary.
    const words = new Intl.Segmenter("th", { granularity: "word" });
    const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
    function text(value: string, size = 12, bold = false, options: {
      x?: number; width?: number; align?: "left" | "right"; color?: string; gap?: number;
    } = {}) {
      if (!hasReceiptGlyphs(value)) throw new Error("Unsupported receipt glyph");
      const width = options.width ?? pageWidth;
      const left = options.x ?? 48;
      doc.fillColor(options.color ?? ink);
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
        const parts = runs(line);
        let x = left + (options.align === "right" ? width - measure(line) : 0);
        for (const run of parts) {
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
      doc.y += options.gap ?? size * 0.65;
    }
    const rule = (y: number) => {
      doc.save().moveTo(48, y).lineTo(doc.page.width - 48, y)
        .lineWidth(0.6).strokeColor("#cbd5d1").stroke().restore();
    };
    const paid = Number(receipt.amount).toLocaleString("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    // Calm document hierarchy, no invented logo, signature, tax ID or seal.
    doc.save().rect(48, 48, pageWidth, 3).fill(teal).restore();
    doc.y = 63;
    text("BANGKOK CYTOGENETICS CLINIC", 9, true, { color: teal });
    doc.y = 91;
    text("ใบเสร็จรับเงินค่าปรึกษา", 23, true, { color: teal });
    doc.y = Math.max(doc.y + 5, 151);
    text(receiptIssuer.name, 12, true, { gap: 4 });
    text(receiptIssuer.address, 10, false, { color: muted });
    const dividerY = doc.y + 12;
    rule(dividerY);

    const detailsY = dividerY + 18;
    doc.y = detailsY;
    text("เลขอ้างอิงใบเสร็จ", 9, false, { color: muted, gap: 2, width: 270 });
    text(receipt.reference, 10.5, true, { width: 270, gap: 0 });
    const referenceEnd = doc.y;
    doc.y = detailsY;
    const rightColumn = { x: 340, width: pageWidth - 292 };
    text("วันที่ยืนยันรับชำระเงิน", 9, false, { ...rightColumn, color: muted, gap: 2 });
    text(formatReceiptDate(receipt.confirmedAt), 10.5, false, { ...rightColumn, gap: 0 });
    doc.y = Math.max(referenceEnd, doc.y) + 18;
    text("ชื่อผู้ชำระตามบัญชีผู้ใช้", 9, false, { color: muted, gap: 2 });
    text(receipt.payerAccountName, 12, false, { gap: 0 });

    // All receipt inputs are bounded; reserve a complete table rather than splitting rows.
    if (doc.y + 200 > doc.page.height - 140) doc.addPage();
    const tableY = doc.y + 24;
    doc.save().rect(48, tableY, pageWidth, 30).fill("#f3f6f5").restore();
    doc.y = tableY + 7;
    text("รายการ", 10, true, { x: 62, width: 270, gap: 0 });
    doc.y = tableY + 7;
    text("จำนวนเงิน (THB)", 10, true, { x: 350, width: pageWidth - 316, align: "right", gap: 0 });
    doc.y = tableY + 45;
    text("ค่าปรึกษาแพทย์", 12, false, { x: 62, width: 270, gap: 0 });
    doc.y = tableY + 45;
    text(paid, 12, false, { x: 350, width: pageWidth - 316, align: "right", gap: 0 });
    const totalY = tableY + 84;
    doc.save().rect(48, totalY, pageWidth, 66).fill("#e0f7f6").restore();
    doc.y = totalY + 22;
    text("ยอดรับชำระทั้งหมด", 11, true, { x: 62, width: 180, color: teal, gap: 0 });
    doc.y = totalY + 14;
    text(`${paid} ${receipt.currency}`, 20, true, {
      x: 256, width: pageWidth - 222, align: "right", color: teal, gap: 0
    });
    doc.y = totalY + 82;
    text(`ช่องทางชำระเงิน: ${receipt.channel}`, 10, false, { color: muted });

    const footerY = Math.max(doc.y + 22, doc.page.height - 121);
    rule(footerY);
    doc.y = footerY + 14;
    text("เอกสารรับชำระเงินจากระบบ ไม่ใช่ใบกำกับภาษี", 9, true, { color: muted, gap: 4 });
    text("ชื่อผู้ชำระแสดงตามบัญชีผู้ใช้ปัจจุบัน วันที่แสดงเป็นวันที่ยืนยันรับชำระเงิน ไม่ใช่เวลาโอนจากธนาคาร", 8.5, false, { color: muted, gap: 0 });
    doc.end();
    return await complete;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
