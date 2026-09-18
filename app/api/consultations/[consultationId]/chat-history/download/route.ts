import { NextResponse } from "next/server";
import {
  consultationChatExportFilename,
  getConsultationChatExport
} from "@/features/consultations/chat/history-queries";
import { getCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
} as const;

function unavailable(status: 401 | 404) {
  return NextResponse.json(
    { error: status === 401 ? "Authentication required." : "Chat history not found." },
    { status, headers: privateHeaders }
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ consultationId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return unavailable(401);
  if (session.role !== "customer" && session.role !== "doctor") return unavailable(404);

  const { consultationId } = await context.params;
  const result = await getConsultationChatExport(
    session,
    consultationId,
    session.role
  );
  if (!result) return unavailable(404);

  return new Response(result.content, {
    status: 200,
    headers: {
      ...privateHeaders,
      "Content-Disposition": `attachment; filename="${consultationChatExportFilename}"`,
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
