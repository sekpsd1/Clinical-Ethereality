import {
  adminDocumentError, adminDocumentId, AdminDocumentAccessError, authorizeAdminDocument, privateDocumentHeaders
} from "@/features/admin/documents/access";
import { renderAdminPaymentReceipt } from "@/features/admin/documents/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    await authorizeAdminDocument();
    const parsed = adminDocumentId.safeParse((await params).paymentId);
    if (!parsed.success) throw new AdminDocumentAccessError(404);
    const { bytes, filename } = await renderAdminPaymentReceipt(parsed.data);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...privateDocumentHeaders,
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return adminDocumentError(error, "ไม่สามารถดาวน์โหลดใบเสร็จนี้ได้");
  }
}
