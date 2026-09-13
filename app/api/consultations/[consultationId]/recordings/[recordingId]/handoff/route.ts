import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicAppOrigin } from "@/lib/auth/line-oauth";
import {
  issueRecordingExternalHandoff,
  RecordingExternalHandoffError
} from "@/features/consultations/recordings/external-handoff";
import {
  getRecordingHandoffRequestIp,
  hasTrustedRecordingHandoffOrigin
} from "@/features/consultations/recordings/handoff-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,191}$/);
const bodySchema = z.object({ mode: z.enum(["view", "download"]) }).strict();

function unavailable(status: number) {
  return NextResponse.json(
    { ok: false, error: "Unable to open this recording." },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ consultationId: string; recordingId: string }> }
) {
  if (!hasTrustedRecordingHandoffOrigin(request)) return unavailable(403);

  const params = await context.params;
  const consultationId = idSchema.safeParse(params.consultationId);
  const recordingId = idSchema.safeParse(params.recordingId);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return unavailable(400);
  }

  const body = bodySchema.safeParse(payload);
  if (!consultationId.success || !recordingId.success || !body.success) return unavailable(400);

  try {
    const handoff = await issueRecordingExternalHandoff(
      consultationId.data,
      recordingId.data,
      body.data.mode,
      { ipAddress: getRecordingHandoffRequestIp(request) }
    );
    const launchUrl = new URL("/recordings/handoff", getPublicAppOrigin(request.nextUrl.origin));
    launchUrl.searchParams.set("consultation", handoff.consultationId);
    launchUrl.searchParams.set("recording", handoff.recordingId);
    launchUrl.searchParams.set("mode", handoff.mode);
    launchUrl.hash = `handoff=${encodeURIComponent(handoff.ticket)}`;

    return NextResponse.json(
      { ok: true, launchUrl: launchUrl.toString(), expiresAt: handoff.expiresAt.toISOString() },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer"
        }
      }
    );
  } catch (error) {
    if (!(error instanceof RecordingExternalHandoffError)) {
      console.error("Recording handoff issuance failed.", { code: "unexpected" });
    }
    return unavailable(403);
  }
}
