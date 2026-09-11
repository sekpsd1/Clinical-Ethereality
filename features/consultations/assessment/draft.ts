import { assessmentSymptomDetailMaxLength } from "@/features/consultations/assessment/constants";

const assessmentOtherSymptomDraftKey = "consult-assessment:other-symptom:v1";

type SessionDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function getBrowserSessionDraftStorage(): SessionDraftStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readOtherSymptomDraft(storage: SessionDraftStorage | null): string {
  if (!storage) {
    return "";
  }

  try {
    return (storage.getItem(assessmentOtherSymptomDraftKey) ?? "").slice(0, assessmentSymptomDetailMaxLength);
  } catch {
    return "";
  }
}

export function writeOtherSymptomDraft(storage: SessionDraftStorage | null, detail: string): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(assessmentOtherSymptomDraftKey, detail.slice(0, assessmentSymptomDetailMaxLength));
  } catch {
    // Keep the assessment usable when browser storage is unavailable.
  }
}

export function clearOtherSymptomDraft(storage: SessionDraftStorage | null): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(assessmentOtherSymptomDraftKey);
  } catch {
    // Browser storage cleanup is best-effort; never block logout or submission.
  }
}
