import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { ReceiptAccessError } from "@/features/consultations/receipt/queries";
import { getOwnedOrderReceipt } from "@/features/orders/receipt";
import { renderReceiptImage } from "@/features/consultations/receipt/image";
import { renderConsultationReceipt } from "@/features/consultations/receipt/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Vary": "Cookie"
};

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new ReceiptAccessError(401);
    const parsed = identifier.safeParse((await context.params).orderId);
    if (!parsed.success) throw new ReceiptAccessError(404);
    const { receipt, order } = await getOwnedOrderReceipt(session, parsed.data);
    const options = new URL(request.url).searchParams;
    const asImage = options.get("format") === "jpg";
    const disposition = options.get("download") === "1" ? "attachment" : "inline";
    const bytes = asImage ? await renderReceiptImage(receipt, order) : await renderConsultationReceipt(receipt, order);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": asImage ? "image/jpeg" : "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": asImage
          ? `${disposition}; filename="store-payment-receipt.jpg"`
          : 'attachment; filename="store-payment-receipt.pdf"'
      }
    });
  } catch (error) {
    return Response.json({ message: "ไม่สามารถดาวน์โหลดใบเสร็จนี้ได้" }, {
      status: error instanceof ReceiptAccessError ? error.status : 503,
      headers: privateHeaders
    });
  }
}
