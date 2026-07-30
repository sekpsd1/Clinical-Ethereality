import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppEnv } from "@/lib/env/schema";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";

export const dynamic = "force-dynamic";

type ZoomWebhookBody = {
  event?: unknown;
  payload?: unknown;
};

function getZoomSignature(secret: string, timestamp: string, rawBody: string): string {
  const message = `v0:${timestamp}:${rawBody}`;
  const hash = createHmac("sha256", secret).update(message).digest("hex");

  return `v0=${hash}`;
}

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMeetingId(body: ZoomWebhookBody): string | null {
  const payload = getObject(body.payload);
  const object = getObject(payload.object);
  const id = object.id;

  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

export async function POST(request: NextRequest) {
  const env = getAppEnv();

  if (!env.ZOOM_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "Zoom webhook is not configured."
      },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-zm-request-timestamp") ?? "";
  const receivedSignature = request.headers.get("x-zm-signature") ?? "";
  const requestTime = Number(timestamp);
  const isFresh = Number.isFinite(requestTime) && Math.abs(Date.now() / 1000 - requestTime) <= 5 * 60;
  const expectedSignature = getZoomSignature(env.ZOOM_WEBHOOK_SECRET, timestamp, rawBody);

  if (!isFresh || !signaturesMatch(expectedSignature, receivedSignature)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Zoom webhook signature is invalid."
      },
      { status: 401 }
    );
  }

  let body: ZoomWebhookBody;

  try {
    body = JSON.parse(rawBody) as ZoomWebhookBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Zoom webhook payload is invalid."
      },
      { status: 400 }
    );
  }

  if (body.event === "endpoint.url_validation") {
    const payload = getObject(body.payload);
    const plainToken = payload.plainToken;

    if (typeof plainToken !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "Zoom validation token is missing."
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      plainToken,
      encryptedToken: createHmac("sha256", env.ZOOM_WEBHOOK_SECRET).update(plainToken).digest("hex")
    });
  }

  if (body.event !== "meeting.started" && body.event !== "meeting.ended") {
    return NextResponse.json({
      ok: true,
      ignored: true
    });
  }

  const meetingId = getMeetingId(body);

  if (!meetingId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Zoom meeting id is missing."
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: {
        zoomMeetingId: meetingId
      },
      select: {
        id: true,
        patientId: true,
        status: true,
        doctor: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!consultation) {
      return;
    }

    const auditAction =
      body.event === "meeting.started" ? "zoom.meeting_started" : "zoom.meeting_ended";
    const duplicateEvent = await tx.auditLog.findFirst({
      where: {
        action: auditAction,
        entityType: "consultation",
        entityId: consultation.id
      },
      select: {
        id: true
      }
    });

    if (duplicateEvent) {
      return;
    }

    const nextStatus =
      body.event === "meeting.started" && consultation.status === "scheduled"
        ? "live"
        : null;

    if (nextStatus) {
      await tx.consultation.update({
        where: {
          id: consultation.id
        },
        data: {
          status: nextStatus
        }
      });
    }

    await tx.notification.create({
      data: {
        userId: body.event === "meeting.ended" ? consultation.doctor.userId : consultation.patientId,
        type: "consultation",
        channel: "in_app",
        title: body.event === "meeting.started" ? "ห้อง Zoom เริ่มแล้ว" : "ห้อง Zoom สิ้นสุดแล้ว",
        body:
          body.event === "meeting.started"
            ? "เปิดห้องปรึกษาเพื่อเข้าร่วมการสนทนากับแพทย์"
            : "กรุณากลับไปที่คิวแพทย์เพื่อเขียนสรุปและจบการปรึกษา",
        metadataJson: {
          consultationId: consultation.id,
          href:
            body.event === "meeting.started"
              ? `/consult/live?consultation=${consultation.id}`
              : "/doctor/consultations"
        }
      }
    });

    await writeAuditLog(tx, {
      action: auditAction,
      entityType: "consultation",
      entityId: consultation.id,
      metadata: {
        meetingId,
        previousStatus: consultation.status,
        nextStatus: nextStatus ?? consultation.status
      }
    });
  });

  return NextResponse.json({
    ok: true
  });
}
