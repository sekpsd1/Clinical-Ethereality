import { randomBytes } from "node:crypto";
import {
  adminDocumentError, adminDocumentId, AdminDocumentAccessError, authorizeAdminDocument, privateDocumentHeaders
} from "@/features/admin/documents/access";
import {
  hasPrintableShippingAddress, renderShippingAddress, shippingDocumentSelect
} from "@/features/admin/documents/shipping-address";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await authorizeAdminDocument();
    const parsed = adminDocumentId.safeParse((await params).orderId);
    if (!parsed.success) throw new AdminDocumentAccessError(404);
    const address = await prisma.orderShippingAddress.findUnique({
      where: { orderId: parsed.data },
      select: shippingDocumentSelect
    });
    if (!hasPrintableShippingAddress(address)) throw new AdminDocumentAccessError(404);

    const download = new URL(request.url).searchParams.get("download") === "1";
    const nonce = download ? undefined : randomBytes(16).toString("base64");
    return new Response(renderShippingAddress(address, nonce), {
      headers: {
        ...privateDocumentHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="shipping-address.html"`,
        "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`
      }
    });
  } catch (error) {
    return adminDocumentError(error, "ไม่พบที่อยู่จัดส่งสำหรับคำสั่งซื้อนี้หรือไม่สามารถเปิดเอกสารได้");
  }
}
