import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions";
import { requestPhoneVerificationSchema } from "@/features/identity-verification/schema";
import { writeSmsOtpDiagnostic } from "@/lib/sms/otp";
import {
  getPatientVerificationMessage,
  requestPatientPhoneVerification
} from "@/features/identity-verification/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    assertRole(session, ["customer"]);
    const parsed = requestPhoneVerificationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      writeSmsOtpDiagnostic({
        stage: "request_schema",
        applicationHttpStatus: 400,
        providerHttpStatus: null,
        providerErrorCode: null,
        providerErrorCategory: "not_applicable"
      });
      return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await requestPatientPhoneVerification(session.userId, parsed.data);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = getPatientVerificationMessage(error);
    return NextResponse.json({ ok: false, message: response.message }, { status: response.status, headers: { "Cache-Control": "no-store" } });
  }
}
