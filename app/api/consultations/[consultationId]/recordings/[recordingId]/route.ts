import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  auditRecordingAccess,
  getAuthorizedRecording
} from "@/features/consultations/recordings/access";
import {
  auditExternalRecordingAccessOnce,
  getRecordingExternalAccess,
  type RecordingAccessMode
} from "@/features/consultations/recordings/external-handoff";
import {
  RecordingProviderError,
  zoomRecordingContentProvider
} from "@/features/consultations/recordings/provider";
import { parseRecordingRangeHeader } from "@/features/consultations/recordings/range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rangeNotSatisfiable() {
  return NextResponse.json(
    { error: "Requested recording range is unavailable." },
    { status: 416, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ consultationId: string; recordingId: string }> }
) {
  const { consultationId, recordingId } = await context.params;
  const mode: RecordingAccessMode = request.nextUrl.searchParams.get("download") === "1" ? "download" : "view";
  const session = await getCurrentSession();
  const mainViewer = session && (session.role === "admin" || session.role === "doctor")
    ? { userId: session.userId, role: session.role }
    : null;
  const mainRecording = await getAuthorizedRecording(mainViewer, consultationId, recordingId);
  const externalAccess = mainRecording
    ? null
    : await getRecordingExternalAccess(consultationId, recordingId, mode);
  const recording = mainRecording ?? externalAccess?.recording ?? null;

  if (!recording) {
    return session
      ? NextResponse.json({ error: "Recording not found." }, { status: 404 })
      : NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const range = parseRecordingRangeHeader(
    request.headers.get("range"),
    recording.fileType,
    recording.fileSizeBytes
  );
  if (range.kind === "invalid") return rangeNotSatisfiable();

  try {
    const content = await zoomRecordingContentProvider.open(
      recording,
      range.kind === "valid" ? { range: range.value } : undefined
    );
    if (externalAccess) {
      await auditExternalRecordingAccessOnce(externalAccess);
    } else if (mainViewer) {
      await auditRecordingAccess(mainViewer, recording, mode);
    }

    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${mode === "download" ? "attachment" : "inline"}; filename="consultation-recording-${recording.id}.${recording.fileType.toLowerCase()}"`,
      "Content-Type": content.contentType,
      "X-Content-Type-Options": "nosniff"
    });
    if (content.contentLength) headers.set("Content-Length", content.contentLength);
    if (content.contentRange) headers.set("Content-Range", content.contentRange);
    if (content.acceptRanges) headers.set("Accept-Ranges", content.acceptRanges);

    return new Response(content.body, { status: content.status, headers });
  } catch (error) {
    if (error instanceof RecordingProviderError && error.code === "RANGE_NOT_SATISFIABLE") {
      return rangeNotSatisfiable();
    }
    const status = error instanceof RecordingProviderError && error.code === "NOT_CONFIGURED" ? 503 : 502;
    return NextResponse.json(
      { error: status === 503 ? "Recording access is not enabled." : "Recording is temporarily unavailable." },
      { status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
