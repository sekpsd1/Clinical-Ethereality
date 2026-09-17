import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getAuthorizedRecording } from "@/features/consultations/recordings/access";
import { isEligibleConsultationRecordingMetadata } from "@/features/consultations/recordings/policy";
import { zoomRecordingContentProvider } from "@/features/consultations/recordings/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ consultationId: string; recordingId: string }> }
) {
  const { consultationId, recordingId } = await context.params;
  const session = await getCurrentSession();
  const viewer = session && (session.role === "admin" || session.role === "doctor")
    ? { userId: session.userId, role: session.role }
    : null;
  const recording = await getAuthorizedRecording(viewer, consultationId, recordingId);

  if (!recording || !isEligibleConsultationRecordingMetadata(recording)) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const readiness = await zoomRecordingContentProvider.getReadiness(recording);
  return NextResponse.json(readiness, { headers: PRIVATE_HEADERS });
}
