import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  useReducer: vi.fn()
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return { ...actual, useReducer: mocks.useReducer };
});

vi.mock("@/features/doctor/DoctorConsultationControls", () => ({
  DoctorConsultationControls: ({ identityConfirmed }: { identityConfirmed?: boolean }) => (
    <div data-doctor-consultation-controls data-identity-confirmed={String(Boolean(identityConfirmed))}>
      เริ่มการปรึกษา
    </div>
  )
}));

import {
  DoctorPatientIdentityGate,
  formatPatientDateOfBirth,
  initialPatientIdentityGateState,
  patientIdentityGateReducer,
  requestDoctorPatientIdentity,
  type PatientIdentityGateState
} from "@/features/doctor/DoctorPatientIdentityGate";

const consultation = {
  id: "consultation-1",
  status: "scheduled" as const,
  summary: null,
  attendance: {
    label: "รอการยืนยันจาก Zoom",
    description: "ยังไม่มีหลักฐานผู้เข้าร่วม",
    tone: "neutral" as const,
    normalCompletionEligible: false,
    noShowCompletionEligible: false,
    requiredDurationMinutes: 15,
    verifiedDoctorPresenceSeconds: 0,
    noShowRemainingSeconds: 600
  },
  canStartConsultation: true,
  startAvailableAt: "2030-01-01T09:55:00.000Z",
  startAvailableInMs: 0
};

const identity = {
  fullName: "ชื่อจริงสำหรับทดสอบ",
  nationalId: "1101700203450",
  dateOfBirth: "1990-01-02"
};

function renderState(state: PatientIdentityGateState): string {
  mocks.useReducer.mockReturnValue([state, mocks.dispatch]);
  return renderToStaticMarkup(<DoctorPatientIdentityGate consultation={consultation} />);
}

describe("doctor patient identity UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useReducer.mockReturnValue([initialPatientIdentityGateState, mocks.dispatch]);
  });

  it("keeps identity out of the initial HTML and gates the start control", () => {
    const html = renderState(initialPatientIdentityGateState);

    expect(html).toContain("ยืนยันตัวตนผู้ป่วย");
    expect(html).toContain("เปิดข้อมูลยืนยันตัวตน");
    expect(html).toContain('data-identity-confirmed="false"');
    expect(html).not.toContain(identity.fullName);
    expect(html).not.toContain(identity.nationalId);
    expect(html).not.toContain(identity.dateOfBirth);
  });

  it("renders loading and retryable error states without stale identity", () => {
    const loading = renderState({
      status: "loading",
      identity: null,
      confirmed: false,
      message: ""
    });
    const error = renderState({
      status: "error",
      identity: null,
      confirmed: false,
      message: "ข้อมูลยืนยันตัวตนยังไม่พร้อม กรุณาให้ลูกค้ายืนยันตัวตนก่อน"
    });

    expect(loading).toContain("กำลังเปิดข้อมูล");
    expect(loading).toContain("disabled");
    expect(error).toContain("ให้ลูกค้ายืนยันตัวตนก่อน");
    expect(error).toContain("เปิดข้อมูลยืนยันตัวตน");
    expect(error).not.toContain(identity.nationalId);
  });

  it("shows all three fields, Buddhist-era date, hide control, and checkbox after reveal", () => {
    const html = renderState({
      status: "revealed",
      identity,
      confirmed: false,
      message: ""
    });

    expect(html).toContain(identity.fullName);
    expect(html).toContain(identity.nationalId);
    expect(html).toContain("2 มกราคม 2533");
    expect(html).toContain("ตรวจสอบข้อมูลกับผู้ป่วยแล้ว");
    expect(html).toContain("ซ่อนข้อมูลยืนยันตัวตน");
    expect(html).toContain("break-all");
    expect(html).toContain("w-full");
    expect(html).toContain('data-identity-confirmed="false"');
  });

  it("enables the start gate only after a successful reveal and explicit confirmation", () => {
    const revealed = patientIdentityGateReducer(initialPatientIdentityGateState, {
      type: "reveal_succeeded",
      identity
    });
    const confirmed = patientIdentityGateReducer(revealed, {
      type: "confirmation_changed",
      confirmed: true
    });
    const html = renderState(confirmed);

    expect(confirmed.confirmed).toBe(true);
    expect(html).toContain('data-identity-confirmed="true"');
  });

  it("hide clears the PII and confirmation instead of keeping a stale gate", () => {
    const hidden = patientIdentityGateReducer(
      { status: "revealed", identity, confirmed: true, message: "" },
      { type: "hide" }
    );

    expect(hidden).toEqual(initialPatientIdentityGateState);
    expect(renderState(hidden)).not.toContain(identity.fullName);
    expect(renderState(hidden)).toContain('data-identity-confirmed="false"');
  });

  it("fetches identity only through a same-origin no-store POST and validates the response", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, identity })
    });

    await expect(requestDoctorPatientIdentity("consultation-1", fetcher)).resolves.toEqual(identity);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/doctor/consultations/consultation-1/patient-identity",
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      }
    );
  });

  it("rejects malformed success payloads and preserves the customer-verification instruction", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        identity: { ...identity, nationalId: "123" }
      })
    });

    await expect(requestDoctorPatientIdentity("consultation-1", fetcher)).rejects.toThrow(
      "กรุณาให้ลูกค้ายืนยันตัวตนก่อน"
    );
  });

  it("formats the date of birth with a Thai Buddhist year", () => {
    expect(formatPatientDateOfBirth("1990-01-02")).toBe("2 มกราคม 2533");
  });
});
