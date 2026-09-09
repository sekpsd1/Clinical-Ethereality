import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  auditRecordingAccess,
  getAuthorizedRecording
} from "@/features/consultations/recordings/access";
import {
  RecordingProviderError,
  zoomRecordingContentProvider
} from "@/features/consultations/recordings/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ consultationId: string; recordingId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { consultationId, recordingId } = await context.params;
  const recording = await getAuthorizedRecording(session, consultationId, recordingId);
  if (!recording) return NextResponse.json({ error: "Recording not found." }, { status: 404 });

  const mode = request.nextUrl.searchParams.get("download") === "1" ? "download" : "view";

  try {
    const content = await zoomRecordingContentProvider.open(recording);
    await auditRecordingAccess(session, recording, mode);

    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${mode === "download" ? "attachment" : "inline"}; filename="consultation-recording-${recording.id}.${recording.fileType.toLowerCase()}"`,
      "Content-Type": content.contentType,
      "X-Content-Type-Options": "nosniff"
    });
    if (content.contentLength) headers.set("Content-Length", content.contentLength);

    return new Response(content.body, { status: 200, headers });
  } catch (error) {
    const status = error instanceof RecordingProviderError && error.code === "NOT_CONFIGURED" ? 503 : 502;
    return NextResponse.json(
      { error: status === 503 ? "Recording access is not enabled." : "Recording is temporarily unavailable." },
      { status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
