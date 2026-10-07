import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppEnv } from "@/lib/env/schema";
import { archiveOneRecordingStep } from "@/features/consultations/recordings/drive-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const env = getAppEnv();
  const expected = env.GOOGLE_DRIVE_ARCHIVE_JOB_SECRET;
  if (!env.ENABLE_GOOGLE_DRIVE_RECORDING_ARCHIVE || !expected) {
    return NextResponse.json({ ok: false, error: "Archive job is not configured." }, { status: 503 });
  }
  const received = request.headers.get("x-clinical-job-secret") ?? "";
  if (Buffer.byteLength(expected) !== Buffer.byteLength(received) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await archiveOneRecordingStep();
    return NextResponse.json({ ok: result.status !== "failed" && result.status !== "retry", result }, {
      status: result.status === "failed" || result.status === "retry" ? 503 : 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Archive job unavailable." }, { status: 503 });
  }
}
