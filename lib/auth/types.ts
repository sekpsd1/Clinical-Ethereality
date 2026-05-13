import type { Role } from "@/lib/permissions/roles";

export type SessionTokenType = "access" | "refresh";

export type AuthSession = {
  userId: string;
  lineUserId: string;
  role: Role;
  sessionId?: string;
  displayName?: string;
  pictureUrl?: string;
};

export type SessionClaims = AuthSession & {
  tokenType: SessionTokenType;
  iss: string;
  sub: string;
  iat: number;
  exp: number;
};

export type PublicSession = AuthSession & {
  expiresAt: string;
};
