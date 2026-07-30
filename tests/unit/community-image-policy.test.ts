import { describe, expect, it } from "vitest";
import {
  calculateCommunityImageDimensions,
  formatCommunityImageBytes
} from "@/features/community/images/policy";

describe("community image policy", () => {
  it("keeps a small image at its original dimensions", () => {
    expect(calculateCommunityImageDimensions(800, 600)).toEqual({
      width: 800,
      height: 600
    });
  });

  it("limits either landscape or portrait images to 1600px", () => {
    expect(calculateCommunityImageDimensions(4000, 3000)).toEqual({
      width: 1600,
      height: 1200
    });
    expect(calculateCommunityImageDimensions(1500, 3000)).toEqual({
      width: 800,
      height: 1600
    });
  });

  it("formats compressed sizes for customer feedback", () => {
    expect(formatCommunityImageBytes(512_000)).toBe("500 KB");
    expect(formatCommunityImageBytes(1_572_864)).toBe("1.5 MB");
  });
});
