import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: () => ({
    ZOOM_WEBHOOK_SECRET: "webhook-secret"
  })
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

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
});
