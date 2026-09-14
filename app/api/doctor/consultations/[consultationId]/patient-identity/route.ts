import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  getPatientIdentityForConsultation,
  hasTrustedPatientIdentityOrigin,
  PatientIdentityAccessError
} from "@/features/doctor/consultations/patient-identity";

export const dynamic = "force-dynamic";

const consultationIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,191}$/);
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer"
} as const;
const unavailableMessage = "ไม่สามารถเปิดข้อมูลยืนยันตัวตนได้";

function unavailable(status: number, message = unavailableMessage) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: responseHeaders }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ consultationId: string }> }
) {
  if (!hasTrustedPatientIdentityOrigin(request)) {
    return unavailable(403);
  }

  const session = await getCurrentSession().catch(() => null);

  if (!session) {
    return unavailable(401);
  }

  if (!hasPermission(session, "consultation:read:assigned")) {
    return unavailable(403);
  }

  const parsedId = consultationIdSchema.safeParse((await params).consultationId);

  if (!parsedId.success) {
    return unavailable(400);
  }

  try {
    const identity = await prisma.$transaction(
      (tx) =>
        getPatientIdentityForConsultation(tx, {
          consultationId: parsedId.data,
          session
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(
      { ok: true, identity },
      { headers: responseHeaders }
    );
  } catch (error) {
    if (error instanceof PatientIdentityAccessError) {
      if (error.code === "identity_incomplete") {
        return unavailable(
          409,
          "ข้อมูลยืนยันตัวตนยังไม่พร้อม กรุณาให้ลูกค้ายืนยันตัวตนก่อน"
        );
      }

      if (error.code === "invalid_status") {
        return unavailable(409);
      }

      return unavailable(403);
    }

    return unavailable(503);
  }
}
