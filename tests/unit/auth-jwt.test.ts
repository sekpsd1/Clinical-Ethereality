import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidSessionTokenError,
  getSessionTtlSeconds,
  issueSessionToken,
  verifySessionToken
} from "@/lib/auth/jwt";

const session = {
  userId: "user-1",
  lineUserId: "line-1",
  role: "doctor" as const,
  sessionId: "session-1"
};

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", "test-secret-that-is-longer-than-thirty-two-characters");
  vi.stubEnv("JWT_ISSUER", "clinical-ethereality");
  vi.stubEnv("JWT_ACCESS_TOKEN_TTL", "15m");
  vi.stubEnv("JWT_REFRESH_TOKEN_TTL", "30d");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("JWT session token policy", () => {
  it("keeps the configured access and refresh lifetimes unchanged", () => {
    expect(getSessionTtlSeconds("access")).toBe(15 * 60);
    expect(getSessionTtlSeconds("refresh")).toBe(30 * 24 * 60 * 60);
  });

  it("issues unique refresh tokens even when rotation happens in the same second", async () => {
    const first = await issueSessionToken(session, "refresh");
    const second = await issueSessionToken(session, "refresh");

    expect(first).not.toBe(second);
    await expect(verifySessionToken(first, "refresh")).resolves.toMatchObject({
      userId: "user-1",
      role: "doctor",
      tokenType: "refresh"
    });
    await expect(verifySessionToken(second, "refresh")).resolves.toMatchObject({
      userId: "user-1",
      role: "doctor",
      tokenType: "refresh"
    });
  });

  it("classifies an actually expired access token as invalid", async () => {
    const accessToken = await issueSessionToken(session, "access");
    vi.advanceTimersByTime(15 * 60 * 1000 + 1_000);

    await expect(verifySessionToken(accessToken, "access")).rejects.toBeInstanceOf(InvalidSessionTokenError);
  });

  it("does not classify missing verifier configuration as an invalid token", async () => {
    const accessToken = await issueSessionToken(session, "access");
    vi.stubEnv("JWT_SECRET", "");

    try {
      await verifySessionToken(accessToken, "access");
      throw new Error("Expected verification to fail.");
    } catch (error) {
      expect(error).not.toBeInstanceOf(InvalidSessionTokenError);
    }
  });
});
