import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichLineIdentityWithProfile } from "@/lib/auth/line";

describe("LINE profile enrichment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the verified LINE profile for the display name and avatar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            userId: "line-user-1",
            displayName: "LINE Customer",
            pictureUrl: "https://profile.line-scdn.net/avatar"
          }),
          { status: 200 }
        )
      )
    );

    await expect(
      enrichLineIdentityWithProfile(
        {
          lineUserId: "line-user-1",
          displayName: "Existing Customer"
        },
        "line-access-token"
      )
    ).resolves.toMatchObject({
      lineUserId: "line-user-1",
      displayName: "LINE Customer",
      pictureUrl: "https://profile.line-scdn.net/avatar"
    });
  });

  it("rejects a profile that does not match the verified ID token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            userId: "another-line-user",
            displayName: "Another Customer"
          }),
          { status: 200 }
        )
      )
    );

    await expect(
      enrichLineIdentityWithProfile(
        {
          lineUserId: "line-user-1"
        },
        "line-access-token"
      )
    ).rejects.toThrow("LINE profile does not match");
  });
});
