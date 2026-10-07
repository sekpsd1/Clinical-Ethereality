import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppEnv } from "@/lib/env/schema";
import { archiveOneRecordingStep } from "@/features/consultations/recordings/drive-archive";
import { archiveJobBodySchema, type ArchiveTarget } from "@/features/consultations/recordings/archive-target";

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
  let target: ArchiveTarget | undefined;
  try {
    // Bound actual bytes, not just the untrusted Content-Length header.
    const reader = request.body?.getReader();
    let text = "";
    if (reader) {
      const chunks: Uint8Array[] = [];
      let size = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Invalid body")), 5000);
      });
      try {
        while (true) {
          const { value, done } = await Promise.race([reader.read(), timeout]);
          if (done) break;
          size += value.byteLength;
          if (size > 2048) throw new Error("Invalid body");
          chunks.push(value);
        }
        text = Buffer.concat(chunks).toString("utf8");
      } finally { clearTimeout(timer); void reader.cancel().catch(() => undefined); }
    }
    if (text.length) {
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new Error("Invalid body");
      target = archiveJobBodySchema.parse(JSON.parse(text)).target;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid archive request." }, { status: 400,
      headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const result = target ? await archiveOneRecordingStep(target) : await archiveOneRecordingStep();
    return NextResponse.json({ ok: result.status !== "failed" && result.status !== "retry", result }, {
      status: result.status === "failed" || result.status === "retry" ? 503 : 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Archive job unavailable." }, { status: 503 });
  }
}
