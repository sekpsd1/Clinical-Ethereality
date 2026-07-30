import { describe, expect, it } from "vitest";
import { mapAssessmentAnswers } from "@/features/doctor/patients/detail-queries";

describe("doctor patient assessment answers", () => {
  it("maps stored assessment labels and values into readable rows", () => {
    expect(
      mapAssessmentAnswers({
        symptom: {
          value: "fever",
          label: "ไข้/หนาวสั่น"
        },
        duration: {
          value: "1-3days",
          label: "1-3 วัน"
        }
      })
    ).toEqual([
      {
        key: "symptom",
        label: "ไข้/หนาวสั่น",
        value: "fever"
      },
      {
        key: "duration",
        label: "1-3 วัน",
        value: "1-3days"
      }
    ]);
  });

  it("handles scalar and unknown answer values without exposing raw objects", () => {
    expect(
      mapAssessmentAnswers({
        consent: true,
        complex: {
          nested: {
            secret: "not-rendered"
          }
        }
      })
    ).toEqual([
      {
        key: "consent",
        label: "consent",
        value: "true"
      },
      {
        key: "complex",
        label: "complex",
        value: "-"
      }
    ]);
  });
});
