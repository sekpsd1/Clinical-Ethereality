import { describe, expect, it } from "vitest";
import { normalizeThaiNationalId } from "@/lib/identity/thai-national-id";

describe("Thai national ID validation", () => {
  it("normalizes a valid 13-digit national ID", () => {
    expect(normalizeThaiNationalId("1-1017-00203-45-0")).toBe("1101700203450");
  });

  it("rejects an invalid length or checksum", () => {
    expect(() => normalizeThaiNationalId("110170020345")).toThrow();
    expect(() => normalizeThaiNationalId("1101700203451")).toThrow();
  });
});
