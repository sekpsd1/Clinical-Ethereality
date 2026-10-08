import { NextResponse } from "next/server";
import {
  consultationChatExportFilename,
  getConsultationChatExport
} from "@/features/consultations/chat/history-queries";
import { getPublicAppOrigin, normalizeLineAuthNextPath } from "@/lib/auth/line-oauth";
import { getCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
} as const;

function unavailable() {
  return NextResponse.json(
    { error: "Chat history not found." },
    { status: 404, headers: privateHeaders }
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ consultationId: string }> }
) {
  const { consultationId } = await context.params;
  const session = await getCurrentSession();
  if (!session) {
    const downloadPath = normalizeLineAuthNextPath(
      `/api/consultations/${encodeURIComponent(consultationId)}/chat-history/download`
    );
    const signInUrl = new URL("/auth/line", getPublicAppOrigin(new URL(request.url).origin));
    signInUrl.searchParams.set("next", downloadPath);

    return NextResponse.redirect(signInUrl, {
      status: 307,
      headers: privateHeaders
    });
  }
  if (session.role !== "customer" && session.role !== "doctor") return unavailable();

  const result = await getConsultationChatExport(
    session,
    consultationId,
    session.role
  );
  if (!result) return unavailable();

  return new Response(result.content, {
    status: 200,
    headers: {
      ...privateHeaders,
      "Content-Disposition": `attachment; filename="${consultationChatExportFilename}"`,
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}
