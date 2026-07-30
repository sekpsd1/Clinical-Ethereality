import { describe, expect, it } from "vitest";
import {
  getModerationNextStatus,
  getReportResolutionStatus
} from "@/features/admin/moderation/rules";

describe("community moderation transitions", () => {
  it("keeps reported visible content when the report is dismissed", () => {
    expect(getModerationNextStatus("article", "restore")).toBe("published");
    expect(getModerationNextStatus("comment", "restore")).toBe("visible");
    expect(getReportResolutionStatus("restore")).toBe("dismissed");
  });

  it("records actioned reports for hide and archive decisions", () => {
    expect(getModerationNextStatus("article", "hide")).toBe("hidden");
    expect(getModerationNextStatus("comment", "archive")).toBe("archived");
    expect(getReportResolutionStatus("hide")).toBe("actioned");
    expect(getReportResolutionStatus("archive")).toBe("actioned");
  });
});
