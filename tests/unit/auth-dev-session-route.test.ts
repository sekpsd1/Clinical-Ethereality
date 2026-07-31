import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthSessionRecord: vi.fn(),
  setSessionCookies: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  createAuthSessionRecord: mocks.createAuthSessionRecord,
  setSessionCookies: mocks.setSessionCookies
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: mocks.userFindFirst,
      findUnique: mocks.userFindUnique
    }
  }
}));

import { POST } from "@/app/api/auth/dev-session/route";

const databaseUser = {
  id: "local-customer-id",
  lineUserId: "seed-line-customer",
  role: "customer" as const,
  displayName: "Local Customer",
  avatarUrl: null,
  status: "active" as const
};

function createRequest() {
  return new NextRequest("http://localhost:3001/api/auth/dev-session", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      role: "customer",
      persistRefreshSession: true
    })
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ENABLE_DEV_AUTH_BYPASS", "true");
  vi.stubEnv("DATABASE_URL", "mysql://root:local@127.0.0.1:3307/clinical_ethereality");
  mocks.userFindUnique.mockResolvedValue(databaseUser);
  mocks.userFindFirst.mockResolvedValue(null);
  mocks.createAuthSessionRecord.mockImplementation(async (session) => ({
    ...session,
    sessionId: "local-refresh-session"
  }));
  mocks.setSessionCookies.mockImplementation(async (response: NextResponse) => response);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/dev-session persistent refresh safety", () => {
  it("stays unavailable in Production even when the bypass flag is set", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(createRequest());

    expect(response.status).toBe(404);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("refuses a remote database", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:secret@db.example/clinical_ethereality");

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.createAuthSessionRecord).not.toHaveBeenCalled();
  });

  it("refuses an unapproved database name even through a local tunnel", async () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:secret@127.0.0.1:3307/production_database");

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.createAuthSessionRecord).not.toHaveBeenCalled();
  });

  it("persists only a real seeded user on an approved local test database", async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(mocks.createAuthSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: databaseUser.id, role: "customer" }),
      expect.objectContaining({ userAgent: null, ipAddress: null })
    );
    expect(mocks.setSessionCookies).toHaveBeenCalled();
  });
});
