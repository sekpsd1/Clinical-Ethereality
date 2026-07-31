import { describe, expect, it } from "vitest";
import { shouldStartLineLoginAfterRefresh } from "@/features/auth/LineLiffLogin";

describe("LINE re-authentication policy after refresh", () => {
  it("starts LINE Login only for an invalid or missing refresh session", () => {
    expect(shouldStartLineLoginAfterRefresh(401)).toBe(true);
  });

  it.each([null, 409, 500, 503])("keeps operational status %s out of LINE Login", (status) => {
    expect(shouldStartLineLoginAfterRefresh(status)).toBe(false);
  });
});
