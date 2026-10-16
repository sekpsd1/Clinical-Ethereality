import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { getOwnedConsultationReceipt, ReceiptAccessError } from "@/features/consultations/receipt/queries";
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

export async function GET(_request: Request, context: { params: Promise<{ consultationId: string }> }) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new ReceiptAccessError(401);
    const parsed = identifier.safeParse((await context.params).consultationId);
    if (!parsed.success) throw new ReceiptAccessError(404);
    const receipt = await getOwnedConsultationReceipt(session, parsed.data);
    const pdf = await renderConsultationReceipt(receipt);
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="consultation-payment-receipt.pdf"'
      }
    });
  } catch (error) {
    return Response.json({ message: "ไม่สามารถดาวน์โหลดใบเสร็จนี้ได้" }, {
      status: error instanceof ReceiptAccessError ? error.status : 503,
      headers: privateHeaders
    });
  }
}
