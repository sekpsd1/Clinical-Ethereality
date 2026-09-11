import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConsultAssessmentDuration } from "@/features/consultations/ConsultAssessmentDuration";
import { ConsultAssessmentSymptoms } from "@/features/consultations/ConsultAssessmentSymptoms";
import {
  clearOtherSymptomDraft,
  readOtherSymptomDraft,
  writeOtherSymptomDraft
} from "@/features/consultations/assessment/draft";

describe("other symptom assessment UI", () => {
  it("shows a required detail field when returning to the other symptom option", () => {
    const html = renderToStaticMarkup(
      createElement(ConsultAssessmentSymptoms, { initialSelectedSymptom: "other" })
    );

    expect(html).toContain("โปรดระบุอาการ");
    expect(html).toContain('name="symptomDetail"');
    expect(html).toContain('aria-label="ระบุอาการอื่นๆ"');
    expect(html).toContain('maxLength="100"');
    expect(html).toContain("disabled");
  });

  it("keeps health detail out of duration and back-navigation URLs", () => {
    const html = renderToStaticMarkup(
      createElement(ConsultAssessmentDuration, { selectedSymptom: "other" })
    );

    expect(html).toContain('/consult/assessment/symptoms?symptom=other');
    expect(html).not.toContain("symptomDetail=");
    expect(html).toContain('name="symptomDetail"');
    expect(html).toContain("disabled");
  });

  it("round-trips the draft through bounded session storage helpers", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key))
    };

    writeOtherSymptomDraft(storage, "เจ็บท้องน้อย");

    expect(readOtherSymptomDraft(storage)).toBe("เจ็บท้องน้อย");
    writeOtherSymptomDraft(storage, "อ".repeat(120));
    expect(readOtherSymptomDraft(storage)).toHaveLength(100);
    clearOtherSymptomDraft(storage);
    expect(readOtherSymptomDraft(storage)).toBe("");
  });

  it("keeps selection in browser history and clears the draft on submit and logout", () => {
    const symptomSource = fs.readFileSync(
      path.resolve("features/consultations/ConsultAssessmentSymptoms.tsx"),
      "utf8"
    );
    const durationSource = fs.readFileSync(
      path.resolve("features/consultations/ConsultAssessmentDuration.tsx"),
      "utf8"
    );
    const logoutSource = fs.readFileSync(path.resolve("features/profile/LogoutButton.tsx"), "utf8");

    expect(symptomSource).toContain('url.searchParams.set("symptom", symptom)');
    expect(symptomSource).toContain("window.history.replaceState(window.history.state");
    expect(durationSource).toContain("onSubmit={() => clearOtherSymptomDraft");
    expect(logoutSource).toContain("clearOtherSymptomDraft(getBrowserSessionDraftStorage())");
  });
});
