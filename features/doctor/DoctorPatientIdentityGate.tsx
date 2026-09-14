"use client";

import { useReducer } from "react";
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { DoctorConsultationControls } from "@/features/doctor/DoctorConsultationControls";
import type { DoctorConsultationItem } from "@/features/doctor/consultations/types";
import type { VerifiedPatientIdentity } from "@/features/doctor/consultations/patient-identity";

type IdentityGateStatus = "hidden" | "loading" | "revealed" | "error";

export type PatientIdentityGateState = {
  status: IdentityGateStatus;
  identity: VerifiedPatientIdentity | null;
  confirmed: boolean;
  message: string;
};

export type PatientIdentityGateAction =
  | { type: "reveal_requested" }
  | { type: "reveal_succeeded"; identity: VerifiedPatientIdentity }
  | { type: "reveal_failed"; message: string }
  | { type: "confirmation_changed"; confirmed: boolean }
  | { type: "hide" };

export const initialPatientIdentityGateState: PatientIdentityGateState = {
  status: "hidden",
  identity: null,
  confirmed: false,
  message: ""
};

export function patientIdentityGateReducer(
  state: PatientIdentityGateState,
  action: PatientIdentityGateAction
): PatientIdentityGateState {
  switch (action.type) {
    case "reveal_requested":
      return { status: "loading", identity: null, confirmed: false, message: "" };
    case "reveal_succeeded":
      return {
        status: "revealed",
        identity: action.identity,
        confirmed: false,
        message: ""
      };
    case "reveal_failed":
      return { status: "error", identity: null, confirmed: false, message: action.message };
    case "confirmation_changed":
      return state.status === "revealed" && state.identity
        ? { ...state, confirmed: action.confirmed }
        : state;
    case "hide":
      return initialPatientIdentityGateState;
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "json">>;

export async function requestDoctorPatientIdentity(
  consultationId: string,
  fetcher: FetchLike = fetch
): Promise<VerifiedPatientIdentity> {
  const response = await fetcher(
    `/api/doctor/consultations/${encodeURIComponent(consultationId)}/patient-identity`,
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    }
  );
  const payload = (await response.json().catch(() => null)) as {
    identity?: Partial<VerifiedPatientIdentity>;
    message?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : "ยังเปิดข้อมูลยืนยันตัวตนไม่ได้ กรุณาลองใหม่"
    );
  }

  const identity = payload?.identity;

  if (
    !identity ||
    typeof identity.fullName !== "string" ||
    !identity.fullName.trim() ||
    typeof identity.nationalId !== "string" ||
    !/^\d{13}$/.test(identity.nationalId) ||
    typeof identity.dateOfBirth !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(identity.dateOfBirth)
  ) {
    throw new Error("ข้อมูลยืนยันตัวตนยังไม่พร้อม กรุณาให้ลูกค้ายืนยันตัวตนก่อน");
  }

  return identity as VerifiedPatientIdentity;
}

export function formatPatientDateOfBirth(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

type ConsultationForIdentityGate = Pick<
  DoctorConsultationItem,
  | "id"
  | "status"
  | "summary"
  | "attendance"
  | "canStartConsultation"
  | "startAvailableAt"
  | "startAvailableInMs"
>;

export function DoctorPatientIdentityGate({
  consultation
}: {
  consultation: ConsultationForIdentityGate;
}) {
  const [state, dispatch] = useReducer(
    patientIdentityGateReducer,
    initialPatientIdentityGateState
  );

  if (consultation.status !== "scheduled" && consultation.status !== "live") {
    return <DoctorConsultationControls consultation={consultation} />;
  }

  const reveal = async () => {
    dispatch({ type: "reveal_requested" });

    try {
      const identity = await requestDoctorPatientIdentity(consultation.id);
      dispatch({ type: "reveal_succeeded", identity });
    } catch (error) {
      dispatch({
        type: "reveal_failed",
        message:
          error instanceof Error
            ? error.message
            : "ยังเปิดข้อมูลยืนยันตัวตนไม่ได้ กรุณาลองใหม่"
      });
    }
  };

  return (
    <>
      <section
        aria-labelledby={`patient-identity-title-${consultation.id}`}
        className="mt-4 rounded-[8px] border border-primary/20 bg-primary/5 p-3"
        data-patient-identity-gate
      >
        <div className="flex items-start gap-2">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
            strokeWidth={2.1}
          />
          <div className="min-w-0 flex-1">
            <h4
              id={`patient-identity-title-${consultation.id}`}
              className="text-sm font-bold text-primary"
            >
              ยืนยันตัวตนผู้ป่วย
            </h4>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-muted">
              ตรวจสอบกับผู้ป่วยโดยตรงก่อนเริ่มการปรึกษา แพทย์ไม่สามารถแก้ข้อมูลส่วนนี้แทนได้
            </p>
          </div>
        </div>

        {state.status === "revealed" && state.identity ? (
          <div className="mt-3 rounded-[8px] border border-primary/15 bg-white p-3">
            <dl className="grid gap-3 text-xs">
              <div>
                <dt className="font-semibold text-muted">ชื่อ-นามสกุล</dt>
                <dd className="mt-1 break-words font-bold text-text">{state.identity.fullName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">เลขบัตรประชาชน</dt>
                <dd className="mt-1 break-all font-bold tracking-[0.08em] text-text">
                  {state.identity.nationalId}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">วันเดือนปีเกิด (พ.ศ.)</dt>
                <dd className="mt-1 font-bold text-text">
                  {formatPatientDateOfBirth(state.identity.dateOfBirth)}
                </dd>
              </div>
            </dl>

            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-[8px] border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs font-bold leading-5 text-text">
              <input
                type="checkbox"
                checked={state.confirmed}
                onChange={(event) =>
                  dispatch({
                    type: "confirmation_changed",
                    confirmed: event.currentTarget.checked
                  })
                }
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              ตรวจสอบข้อมูลกับผู้ป่วยแล้ว
            </label>

            <button
              type="button"
              onClick={() => dispatch({ type: "hide" })}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-white px-4 text-xs font-bold text-primary"
            >
              <EyeOff aria-hidden="true" className="size-4" strokeWidth={2.1} />
              ซ่อนข้อมูลยืนยันตัวตน
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={reveal}
            disabled={state.status === "loading"}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-60"
          >
            {state.status === "loading" ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={2.1} />
            ) : (
              <Eye aria-hidden="true" className="size-4" strokeWidth={2.1} />
            )}
            {state.status === "loading" ? "กำลังเปิดข้อมูล" : "เปิดข้อมูลยืนยันตัวตน"}
          </button>
        )}

        <p
          role="status"
          aria-live="polite"
          className={`mt-2 text-[11px] font-semibold leading-5 ${
            state.status === "error" ? "text-danger" : "text-muted"
          }`}
        >
          {state.status === "error" ? state.message : ""}
        </p>
      </section>

      <DoctorConsultationControls
        consultation={consultation}
        identityConfirmed={state.status === "revealed" && state.confirmed}
      />
    </>
  );
}
