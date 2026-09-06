import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  applyAttendance: vi.fn(),
  writeAuditLog: vi.fn(),
  env: {
    ZOOM_WEBHOOK_SECRET: "webhook-secret" as string | undefined
  }
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: () => mocks.env
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

vi.mock("@/features/consultations/attendance/webhook-service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/consultations/attendance/webhook-service")
  >();

  return {
    ...actual,
    applyZoomParticipantAttendanceEvent: mocks.applyAttendance
  };
});

import { POST } from "@/app/api/webhooks/zoom/route";

function signedRequest(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = `v0=${createHmac("sha256", "webhook-secret")
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;

  return new NextRequest("http://localhost/api/webhooks/zoom", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-zm-request-timestamp": timestamp,
      "x-zm-signature": signature
    }
  });
}

describe("Zoom webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.ZOOM_WEBHOOK_SECRET = "webhook-secret";
    mocks.applyAttendance.mockResolvedValue({ duplicate: false, consultationId: "consultation-1" });
  });

  it("rejects a request with an invalid signature before accessing the database", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/zoom", {
      method: "POST",
      body: JSON.stringify({
        event: "meeting.started"
      }),
      headers: {
        "x-zm-request-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-zm-signature": "v0=invalid"
      }
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("answers Zoom endpoint validation with the expected encrypted token", async () => {
    const plainToken = "zoom-plain-token";
    const body = JSON.stringify({
      event: "endpoint.url_validation",
      payload: {
        plainToken
      }
    });

    const response = await POST(signedRequest(body));
    const responseBody = (await response.json()) as {
      plainToken: string;
      encryptedToken: string;
    };

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({
      plainToken,
      encryptedToken: createHmac("sha256", "webhook-secret").update(plainToken).digest("hex")
    });
  });

  it("rejects expired signed requests before accessing the database", async () => {
    const body = JSON.stringify({ event: "meeting.started" });
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);

    const response = await POST(signedRequest(body, timestamp));

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("fails safely when the webhook secret is missing", async () => {
    mocks.env.ZOOM_WEBHOOK_SECRET = undefined;
    const response = await POST(new NextRequest("http://localhost/api/webhooks/zoom", { method: "POST" }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe("Zoom webhook is not configured.");
    expect(JSON.stringify(body)).not.toContain("webhook-secret");
  });

  it("does not duplicate notifications or audit logs when Zoom retries an event", async () => {
    const tx = {
      consultation: {
        findFirst: vi.fn().mockResolvedValue({
          id: "consultation-1",
          patientId: "patient-1",
          status: "live",
          doctor: {
            userId: "doctor-1"
          }
        }),
        update: vi.fn()
      },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue({
          id: "audit-1"
        })
      },
      notification: {
        create: vi.fn()
      }
    };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const body = JSON.stringify({
      event: "meeting.started",
      payload: {
        object: {
          id: 12345678901
        }
      }
    });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    expect(tx.consultation.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("accepts a strictly validated participant event only through a serializable transaction", async () => {
    mocks.transaction.mockImplementation(async (callback: (client: object) => unknown) => callback({}));
    const body = JSON.stringify({
      event: "meeting.participant_joined",
      event_ts: 1893492000000,
      payload: {
        object: {
          id: 12345678901,
          uuid: "meeting-uuid",
          participant: {
            customer_key: "d0123456789abcdef0123456789abcdef",
            user_id: "meeting-user-1",
            join_time: "2030-01-01T10:00:00.000Z"
          }
        }
      }
    });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
    expect(mocks.applyAttendance).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        eventType: "joined",
        meetingId: "12345678901",
        customerKey: "d0123456789abcdef0123456789abcdef"
      })
    );
  });

  it("rejects malformed participant identity before database access", async () => {
    const body = JSON.stringify({
      event: "meeting.participant_left",
      event_ts: 1893492600000,
      payload: {
        object: {
          id: "12345678901",
          uuid: "meeting-uuid",
          participant: {
            customer_key: "Doctor Display Name",
            user_id: "meeting-user-1",
            leave_time: "2030-01-01T10:10:00.000Z"
          }
        }
      }
    });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.applyAttendance).not.toHaveBeenCalled();
  });

  it("keeps the appointment-time guard when Zoom reports an early meeting start", async () => {
    const tx = {
      consultation: {
        findFirst: vi.fn().mockResolvedValue({
          id: "consultation-1",
          patientId: "patient-1",
          status: "scheduled",
          scheduledAt: new Date("2030-01-01T10:00:00.000Z"),
          doctor: { userId: "doctor-1" }
        }),
        update: vi.fn()
      },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      notification: {
        create: vi.fn()
      }
    };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const body = JSON.stringify({
      event: "meeting.started",
      event_ts: new Date("2030-01-01T09:59:00.000Z").getTime(),
      payload: { object: { id: 12345678901 } }
    });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    expect(tx.consultation.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "zoom.meeting_started_rejected" })
    );
  });
});
