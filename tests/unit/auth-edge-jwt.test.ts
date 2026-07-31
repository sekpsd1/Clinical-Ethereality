import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidAccessTokenError, verifyAccessTokenAtEdge } from "@/lib/auth/edge-jwt";
import { issueSessionToken } from "@/lib/auth/jwt";

const session = {
  userId: "doctor-user",
  lineUserId: "doctor-line",
  role: "doctor" as const,
  sessionId: "doctor-session"
};

beforeEach(() => {
  vi.stubEnv("JWT_SECRET", "edge-test-secret-that-is-longer-than-thirty-two-characters");
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

describe("edge access-token verification", () => {
  it("accepts a current access token", async () => {
    const token = await issueSessionToken(session, "access");

    await expect(verifyAccessTokenAtEdge(token)).resolves.toMatchObject({
      userId: session.userId,
      role: "doctor",
      tokenType: "access"
    });
  });

  it("classifies an expired access token as invalid", async () => {
    const token = await issueSessionToken(session, "access");
    vi.advanceTimersByTime(15 * 60 * 1000 + 1_000);

    await expect(verifyAccessTokenAtEdge(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it("classifies a malformed base64url signature as invalid", async () => {
    const token = await issueSessionToken(session, "access");
    const [header, payload] = token.split(".");

    await expect(verifyAccessTokenAtEdge(`${header}.${payload}.***`)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it("does not classify missing verifier configuration as token expiry", async () => {
    const token = await issueSessionToken(session, "access");
    vi.stubEnv("JWT_SECRET", "");

    try {
      await verifyAccessTokenAtEdge(token);
      throw new Error("Expected verification to fail.");
    } catch (error) {
      expect(error).not.toBeInstanceOf(InvalidAccessTokenError);
    }
  });
});
