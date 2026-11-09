import path from "node:path";
import sharp from "sharp";
import { formatReceiptDate, receiptIssuer, type ConsultationReceipt } from "./model";

const fontfile = path.join(process.cwd(), "assets/fonts/receipt/NotoSansThai-Regular.ttf");
const width = 1000;
const margin = 60;

function escapeMarkup(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function renderReceiptImage(
  receipt: ConsultationReceipt,
  order?: { code: string; lines: string[] }
): Promise<Buffer> {
  const title = order ? "ใบเสร็จรับเงินค่าสินค้า" : "ใบเสร็จรับเงินค่าปรึกษา";
  const paid = Number(receipt.amount).toLocaleString("th-TH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const details = [
    `เลขอ้างอิง ${receipt.reference}`,
    `ยืนยันรับชำระเงิน ${formatReceiptDate(receipt.confirmedAt)}`,
    `ชื่อผู้ชำระตามบัญชีผู้ใช้ ${receipt.payerAccountName}`,
    ...(order ? [`เลขคำสั่งซื้อ ${order.code}`, ...order.lines] : ["ค่าปรึกษาแพทย์"]),
    `ช่องทางชำระเงิน ${receipt.channel}`
  ].map(escapeMarkup).join("\n");
  const text = [
    `<span foreground="#115e59" size="43000"><b>${title}</b></span>`,
    escapeMarkup(receiptIssuer.name),
    escapeMarkup(receiptIssuer.address),
    details,
    `<span foreground="#115e59" size="38000"><b>ยอดรับชำระทั้งหมด ${paid} บาท</b></span>`,
    "เอกสารรับชำระเงินจากระบบ ไม่ใช่ใบกำกับภาษี"
  ].join("\n\n");
  const { data, info } = await sharp({
    text: { text, font: "Noto Sans Thai 30", fontfile, width: width - 2 * margin, rgba: true }
  }).png().toBuffer({ resolveWithObject: true });

  return sharp({
    create: { width, height: info.height + 2 * margin, channels: 3, background: "#ffffff" }
  }).composite([{ input: data, left: margin, top: margin }]).jpeg({ quality: 90 }).toBuffer();
}
