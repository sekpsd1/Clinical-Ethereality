import { NextResponse } from "next/server";
import { requireCurrentSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions";
import { verifyPhoneVerificationSchema } from "@/features/identity-verification/schema";
import {
  getPatientVerificationMessage,
  verifyPatientPhoneVerification
} from "@/features/identity-verification/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSession();
    assertRole(session, ["customer"]);
    const parsed = verifyPhoneVerificationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "รหัส OTP ไม่ถูกต้อง" }, { status: 400 });
    }

    await verifyPatientPhoneVerification(session.userId, parsed.data.challengeId, parsed.data.code);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = getPatientVerificationMessage(error);
    return NextResponse.json({ ok: false, message: response.message }, { status: response.status, headers: { "Cache-Control": "no-store" } });
  }
}
