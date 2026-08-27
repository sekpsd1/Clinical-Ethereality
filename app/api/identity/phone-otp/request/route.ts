import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentSession,
  InvalidRefreshSessionError,
  RefreshSessionConflictError,
  rotateSessionFromToken,
  setRotatedSessionCookies,
  type RotatedSession
} from "@/lib/auth/session";
import { authCookieNames } from "@/lib/auth/cookies";
import { assertRole } from "@/lib/permissions";
import { requestPhoneVerificationSchema } from "@/features/identity-verification/schema";
import {
  type SmsOtpDiagnosticLogger,
  type SmsOtpRouteComponent,
  writeSmsOtpDiagnostic,
  writeSmsOtpRouteStatus
} from "@/lib/sms/otp";
import {
  getPatientVerificationMessage,
  requestPatientPhoneVerification
} from "@/features/identity-verification/service";

export const dynamic = "force-dynamic";

async function requireOtpSession(request: NextRequest) {
  const currentSession = await getCurrentSession();

  if (currentSession) {
    return { session: currentSession, rotation: null };
  }

  const refreshToken = request.cookies.get(authCookieNames.refresh)?.value;

  if (!refreshToken) {
    throw new InvalidRefreshSessionError();
  }

  const rotation = await rotateSessionFromToken(refreshToken);
  return { session: rotation.session, rotation };
}

export async function POST(request: NextRequest) {
  let routeComponent: SmsOtpRouteComponent = "session_lookup";
  let serviceDiagnosticWritten = false;
  let refreshedSession: RotatedSession | null = null;
  const finalizeResponse = (response: NextResponse) =>
    refreshedSession ? setRotatedSessionCookies(response, refreshedSession) : response;
  const writeRouteStatus = (
    status: "started" | "ready" | "failed",
    applicationHttpStatus?: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503
  ) =>
    writeSmsOtpRouteStatus({
      routeComponent,
      status,
      ...(applicationHttpStatus === undefined ? {} : { applicationHttpStatus })
    });
  const serviceDiagnosticLogger: SmsOtpDiagnosticLogger = (diagnostic) => {
    serviceDiagnosticWritten = true;
    writeSmsOtpDiagnostic(diagnostic);
  };

  try {
    writeRouteStatus("started");
    const resolvedSession = await requireOtpSession(request);
    const { session } = resolvedSession;
    refreshedSession = resolvedSession.rotation;
    writeRouteStatus("ready");

    routeComponent = "role_check";
    writeRouteStatus("started");
    assertRole(session, ["customer"]);
    writeRouteStatus("ready");

    routeComponent = "request_body";
    writeRouteStatus("started");
    let body: unknown;
    try {
      body = await request.json();
      writeRouteStatus("ready");
    } catch {
      const parsedBody = requestPhoneVerificationSchema.safeParse(null);
      writeRouteStatus("failed", 400);
      return finalizeResponse(NextResponse.json(
        {
          ok: false,
          message: parsedBody.success
            ? "ข้อมูลไม่ถูกต้อง"
            : parsedBody.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"
        },
        { status: 400 }
      ));
    }

    routeComponent = "request_schema";
    writeRouteStatus("started");
    const parsed = requestPhoneVerificationSchema.safeParse(body);
    if (!parsed.success) {
      writeRouteStatus("failed", 400);
      return finalizeResponse(
        NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 })
      );
    }
    writeRouteStatus("ready");

    routeComponent = "service_dispatch";
    writeRouteStatus("started");
    const result = await requestPatientPhoneVerification(session.userId, parsed.data, {
      diagnosticLogger: serviceDiagnosticLogger
    });
    writeRouteStatus("ready");
    return finalizeResponse(NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } }));
  } catch (error) {
    const response =
      error instanceof InvalidRefreshSessionError
        ? { status: 401, message: "กรุณาเข้าสู่ระบบอีกครั้ง" }
        : error instanceof RefreshSessionConflictError
          ? { status: 409, message: "ระบบกำลังปรับปรุงสถานะการเข้าสู่ระบบ กรุณาลองใหม่" }
          : getPatientVerificationMessage(error);
    if (!serviceDiagnosticWritten) {
      const applicationHttpStatus = [400, 401, 403, 404, 409, 410, 429, 503].includes(response.status)
        ? (response.status as 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503)
        : 503;
      writeRouteStatus("failed", applicationHttpStatus);
    }
    return finalizeResponse(
      NextResponse.json(
        { ok: false, message: response.message },
        { status: response.status, headers: { "Cache-Control": "no-store" } }
      )
    );
  }
}
