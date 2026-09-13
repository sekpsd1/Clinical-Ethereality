import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  exchangeRecordingExternalHandoff,
  getRecordingExternalCookieName,
  getRecordingExternalCookieOptions,
  RecordingExternalHandoffError
} from "@/features/consultations/recordings/external-handoff";
import { hasTrustedRecordingHandoffOrigin } from "@/features/consultations/recordings/handoff-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,191}$/);
const exchangeSchema = z.object({
  ticket: z.string().trim().min(80).max(160),
  consultationId: idSchema,
  recordingId: idSchema,
  mode: z.enum(["view", "download"])
}).strict();

function invalid(status: number) {
  return NextResponse.json(
    { ok: false, error: "Temporary recording access is invalid or expired." },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!hasTrustedRecordingHandoffOrigin(request)) return invalid(403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalid(400);
  }

  const parsed = exchangeSchema.safeParse(payload);
  if (!parsed.success) return invalid(400);

  try {
    const exchanged = await exchangeRecordingExternalHandoff(
      parsed.data.ticket,
      parsed.data.consultationId,
      parsed.data.recordingId,
      parsed.data.mode
    );
    const response = NextResponse.json(
      {
        ok: true,
        consultationId: exchanged.consultationId,
        recordingId: exchanged.recordingId,
        mode: exchanged.mode,
        expiresAt: exchanged.expiresAt.toISOString()
      },
      { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } }
    );
    response.cookies.set(
      getRecordingExternalCookieName(exchanged.mode),
      exchanged.externalSessionToken,
      getRecordingExternalCookieOptions(exchanged.consultationId, exchanged.recordingId)
    );
    return response;
  } catch (error) {
    if (!(error instanceof RecordingExternalHandoffError)) {
      console.error("Recording handoff exchange failed.", { code: "unexpected" });
    }
    return invalid(401);
  }
}
