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
  probeRecordingContentAvailability,
  RecordingProviderError,
  zoomRecordingContentProvider
} from "@/features/consultations/recordings/provider";
import { parseRecordingRangeHeader } from "@/features/consultations/recordings/range";
import { isEligibleConsultationRecordingMetadata } from "@/features/consultations/recordings/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rangeNotSatisfiable() {
  return NextResponse.json(
    { error: "Requested recording range is unavailable." },
    { status: 416, headers: { "Cache-Control": "private, no-store" } }
  );
}

function safeProviderUnavailable(mode: RecordingAccessMode, status: 502 | 503) {
  const retryHref = mode === "download" ? "?download=1&amp;safe=1" : "?safe=1";
  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ไฟล์บันทึกยังไม่พร้อมใช้งาน</title>
</head>
<body style="margin:0;background:#f4f8f7;color:#183b3a;font-family:system-ui,sans-serif">
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box">
    <section style="max-width:420px;background:white;border:1px solid #d9e7e4;border-radius:16px;padding:24px;text-align:center;box-shadow:0 12px 30px rgba(24,59,58,.08)">
      <h1 style="font-size:20px;margin:0">ไฟล์บันทึกยังไม่พร้อมใช้งาน</h1>
      <p style="font-size:14px;line-height:1.7;color:#5d7471;margin:12px 0 0">ระบบยังรับไฟล์จาก Zoom ไม่สำเร็จ กรุณารอสักครู่แล้วตรวจสอบอีกครั้ง</p>
      <a href="${retryHref}" style="display:inline-flex;min-height:48px;align-items:center;justify-content:center;margin-top:20px;padding:0 24px;border-radius:999px;background:#087f78;color:white;font-size:14px;font-weight:700;text-decoration:none">ตรวจสอบและลองอีกครั้ง</a>
    </section>
  </main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function handleRecordingRequest(
  request: NextRequest,
  context: { params: Promise<{ consultationId: string; recordingId: string }> },
  readinessOnly: boolean
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

  if (!recording || !isEligibleConsultationRecordingMetadata(recording)) {
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
    if (readinessOnly) {
      await probeRecordingContentAvailability(recording, zoomRecordingContentProvider);
      return new Response(null, {
        status: 204,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    const content = await zoomRecordingContentProvider.open(
      recording,
      range.kind === "valid" ? { range: range.value } : undefined
    );
    if (externalAccess) {
      const auditResult = await auditExternalRecordingAccessOnce(externalAccess);
      if (auditResult === "invalid") {
        await content.body?.cancel().catch(() => undefined);
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401, headers: { "Cache-Control": "private, no-store" } }
        );
      }
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
    if (!readinessOnly && request.nextUrl.searchParams.get("safe") === "1") {
      return safeProviderUnavailable(mode, status);
    }
    return NextResponse.json(
      { error: status === 503 ? "Recording access is not enabled." : "Recording is temporarily unavailable." },
      { status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ consultationId: string; recordingId: string }> }
) {
  return handleRecordingRequest(request, context, false);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ consultationId: string; recordingId: string }> }
) {
  return handleRecordingRequest(request, context, true);
}
