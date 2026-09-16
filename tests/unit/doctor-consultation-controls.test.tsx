import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DoctorConsultationItem } from "@/features/doctor/consultations/types";

const workflowMocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  dispatch: vi.fn(),
  setCanStartConsultation: vi.fn(),
  useActionState: vi.fn(),
  useEffect: vi.fn()
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: workflowMocks.useActionState,
    useEffect: workflowMocks.useEffect,
    useState: (initialValue: unknown) => [initialValue, workflowMocks.setCanStartConsultation]
  };
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();

  return {
    ...actual,
    useFormStatus: () => ({ pending: false })
  };
});

import { DoctorConsultationControls } from "@/features/doctor/DoctorConsultationControls";

type WorkflowFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  onSubmit: (event: { preventDefault: () => void }) => void;
};

function consultation(
  status: "scheduled" | "live",
  attendance: Partial<Pick<DoctorConsultationItem, "attendance">["attendance"]> = {}
) {
  const resolvedAttendance: Pick<DoctorConsultationItem, "attendance">["attendance"] = {
    label: "Zoom ยืนยันว่าทั้งสองฝ่ายออกจากห้องแล้ว",
    description: "พร้อมจบการปรึกษา",
    tone: "success",
    normalCompletionEligible: true,
    noShowCompletionEligible: false,
    requiredDurationMinutes: 15,
    verifiedDoctorPresenceSeconds: 900,
    noShowRemainingSeconds: null,
    ...attendance
  };

  return {
    id: "consultation-1",
    status,
    summary: null,
    attendance: resolvedAttendance,
    canStartConsultation: true,
    startAvailableAt: "2030-01-01T09:55:00.000Z",
    startAvailableInMs: 0
  } satisfies Pick<
    DoctorConsultationItem,
    | "id"
    | "status"
    | "summary"
    | "attendance"
    | "canStartConsultation"
    | "startAvailableAt"
    | "startAvailableInMs"
  >;
}

function findWorkflowForm(node: ReactNode): ReactElement<WorkflowFormProps> {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) {
      continue;
    }

    const element = child as ReactElement<{ children?: ReactNode }>;

    if (element.type === "form") {
      return element as ReactElement<WorkflowFormProps>;
    }

    try {
      return findWorkflowForm(element.props.children);
    } catch {
      // Continue looking through sibling elements.
    }
  }

  throw new Error("Doctor consultation workflow form was not rendered");
}

async function submitForm(form: ReactElement<WorkflowFormProps>) {
  let prevented = false;
  const event = {
    preventDefault: () => {
      prevented = true;
    }
  };

  form.props.onSubmit(event);

  if (!prevented) {
    await form.props.action(new FormData());
  }

  return { prevented };
}

describe("Doctor consultation controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      clearTimeout: globalThis.clearTimeout,
      confirm: workflowMocks.confirm,
      removeEventListener: vi.fn(),
      setTimeout: globalThis.setTimeout
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("requires final confirmation and does not dispatch completion when rejected", async () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    workflowMocks.confirm.mockReturnValue(false);
    const form = findWorkflowForm(DoctorConsultationControls({ consultation: consultation("live") }));

    const result = await submitForm(form);

    expect(workflowMocks.confirm).toHaveBeenCalledWith(
      "ยืนยันว่าการปรึกษาเสร็จสิ้นจริงและต้องการปิดห้องนี้ใช่ไหม? การดำเนินการนี้เป็นขั้นตอนสุดท้าย"
    );
    expect(result.prevented).toBe(true);
    expect(workflowMocks.dispatch).not.toHaveBeenCalled();
  });

  it("dispatches completion exactly once after explicit confirmation", async () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    workflowMocks.confirm.mockReturnValue(true);
    const form = findWorkflowForm(DoctorConsultationControls({ consultation: consultation("live") }));

    const result = await submitForm(form);

    expect(result.prevented).toBe(false);
    expect(workflowMocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("automatically continues to the secure Zoom handoff after a successful start", () => {
    workflowMocks.useActionState.mockReturnValue([
      {
        status: "success",
        message: "เริ่มการปรึกษาและสร้างห้อง Zoom แล้ว กำลังเปิดเบราว์เซอร์ภายนอก...",
        launchConsultationId: "consultation-1"
      },
      workflowMocks.dispatch,
      false
    ]);

    const html = renderToStaticMarkup(
      <DoctorConsultationControls consultation={consultation("scheduled")} />
    );

    expect(html).toContain("กำลังเปิดเบราว์เซอร์ภายนอก");
    expect(html).not.toContain("/consult/live?consultation=consultation-1");
    expect(html).not.toContain("เข้าห้องปรึกษา/Zoom ตอนนี้");
    expect(html).not.toContain(">เริ่มการปรึกษา</button>");
  });

  it("keeps start disabled until the identity gate is confirmed", () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);

    const blocked = renderToStaticMarkup(
      <DoctorConsultationControls consultation={consultation("scheduled")} />
    );
    const ready = renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={consultation("scheduled")}
        identityConfirmed
      />
    );

    expect(blocked).toContain('name="identityConfirmed" value="false"');
    expect(blocked.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).toContain("disabled");
    expect(blocked).toContain("ตรวจสอบตัวตนกับผู้ป่วยก่อนเริ่มการปรึกษา");
    expect(ready).toContain('name="identityConfirmed" value="true"');
    expect(ready.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).not.toMatch(
      /\sdisabled(?:="")?(?=\s|>)/
    );
  });

  it("disables early start with clear preparation-window copy", () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    const html = renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={{
          ...consultation("scheduled"),
          canStartConsultation: false,
          startAvailableAt: "2030-01-01T09:55:00.000Z",
          startAvailableInMs: 60_000
        }}
      />
    );

    expect(html).toContain("เปิดห้องได้ก่อนเวลานัด 5 นาที");
    expect(html).toContain("disabled");
    expect(html).toContain("เริ่มการปรึกษา");
  });

  it("shows the preparation-window time in the clinic timezone", () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);

    const html = renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={{
          ...consultation("scheduled"),
          canStartConsultation: false,
          startAvailableAt: "2030-01-01T09:55:00.000Z",
          startAvailableInMs: 60_000
        }}
      />
    );

    expect(html).toContain("16:55");
  });

  it("uses actual elapsed time when a throttled timer resumes after the preparation window opens", () => {
    let elapsedMs = 0;
    const timerCallbacks: Array<() => void> = [];
    const setTimeout = vi.fn((callback: () => void) => {
      timerCallbacks.push(callback);
      return timerCallbacks.length;
    });
    const addDocumentListener = vi.fn();

    vi.stubGlobal("performance", {
      now: () => elapsedMs
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      clearTimeout: vi.fn(),
      confirm: workflowMocks.confirm,
      removeEventListener: vi.fn(),
      setTimeout
    });
    vi.stubGlobal("document", {
      addEventListener: addDocumentListener,
      removeEventListener: vi.fn(),
      visibilityState: "visible"
    });
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    workflowMocks.useEffect.mockImplementationOnce((effect: () => void) => effect());

    renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={{
          ...consultation("scheduled"),
          canStartConsultation: false,
          startAvailableAt: "2030-01-01T09:55:00.000Z",
          startAvailableInMs: 300_000
        }}
      />
    );

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(addDocumentListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    elapsedMs = 300_001;
    timerCallbacks[0]?.();

    expect(workflowMocks.setCanStartConsultation).toHaveBeenCalledWith(true);
  });

  it("fails closed in the UI when the appointment time is missing", () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    const html = renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={{
          ...consultation("scheduled"),
          canStartConsultation: false,
          startAvailableAt: null,
          startAvailableInMs: null
        }}
      />
    );

    expect(html).toContain("นัดหมายนี้ไม่มีเวลาเริ่มที่ยืนยันแล้ว");
    expect(html).toContain("disabled");
  });

  it("keeps completion visible, disabled, and non-submittable until attendance evidence is eligible", async () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    const waitingConsultation = consultation("live", {
      label: "Zoom ยืนยันแพทย์แล้ว • รอผู้ป่วย",
      description: "ต้องรอต่อเนื่องอีกประมาณ 8 นาที",
      tone: "warning",
      normalCompletionEligible: false,
      noShowCompletionEligible: false,
      noShowRemainingSeconds: 480
    });
    const component = DoctorConsultationControls({ consultation: waitingConsultation });
    const html = renderToStaticMarkup(component);
    const result = await submitForm(findWorkflowForm(component));

    expect(html).toContain("รอผู้ป่วย");
    expect(html).toContain("ยืนยันจบการปรึกษา");
    expect(html).toContain('type="button"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-describedby="attendance-status-consultation-1 attendance-description-consultation-1 attendance-reason-consultation-1"');
    expect(html).not.toContain('name="transition"');
    expect(html).not.toContain("ยืนยันไม่มาตามนัด");
    expect(result.prevented).toBe(true);
    expect(workflowMocks.dispatch).not.toHaveBeenCalled();
  });

  it("shows the normal completion control when refreshed attendance props become eligible", () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    const waitingHtml = renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={consultation("live", {
          label: "รอการยืนยันจาก Zoom",
          description: "ยังไม่มีหลักฐานผู้เข้าร่วม",
          tone: "neutral",
          normalCompletionEligible: false,
          noShowCompletionEligible: false,
          noShowRemainingSeconds: 600
        })}
      />
    );
    const eligibleHtml = renderToStaticMarkup(
      <DoctorConsultationControls consultation={consultation("live")} />
    );

    expect(waitingHtml).toContain("ยืนยันจบการปรึกษา");
    expect(waitingHtml).toContain('type="button"');
    expect(waitingHtml).toContain("disabled");
    expect(eligibleHtml).toContain("Zoom ยืนยันว่าทั้งสองฝ่ายออกจากห้องแล้ว");
    expect(eligibleHtml).toContain("ยืนยันจบการปรึกษา");
    expect(eligibleHtml).toContain('type="submit"');
    expect(eligibleHtml).toContain('name="summary"');
    expect(eligibleHtml.match(/<button[^>]*type="submit"[^>]*>/)?.[0]).not.toMatch(
      /\sdisabled(?:="")?(?=\s|>)/
    );
  });

  it("shows only the controlled no-show action after server eligibility", () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    const html = renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={consultation("live", {
          label: "ยืนยันเวลารอครบ 15 นาทีแล้ว",
          description: "พร้อมบันทึกผลไม่มาตามนัด",
          tone: "warning",
          normalCompletionEligible: false,
          noShowCompletionEligible: true,
          noShowRemainingSeconds: 0
        })}
      />
    );

    expect(html).toContain("customer_did_not_join");
    expect(html).toContain("แพทย์อยู่ต่อเนื่องครบ 15 นาที");
    expect(html).toContain("ยืนยันไม่มาตามนัด");
    expect(html).not.toContain("ยืนยันจบการปรึกษา");
    expect(html).not.toContain("name=\"summary\"");
  });

  it("requires distinct final confirmation before dispatching no-show", async () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    workflowMocks.confirm.mockReturnValue(false);
    const form = findWorkflowForm(
      DoctorConsultationControls({
        consultation: consultation("live", {
          label: "ยืนยันเวลารอครบ 15 นาทีแล้ว",
          description: "พร้อมบันทึกผลไม่มาตามนัด",
          tone: "warning",
          normalCompletionEligible: false,
          noShowCompletionEligible: true,
          noShowRemainingSeconds: 0
        })
      })
    );

    const result = await submitForm(form);

    expect(workflowMocks.confirm).toHaveBeenCalledWith(
      "ยืนยันว่าผู้ป่วยไม่ได้เข้าห้อง Zoom และต้องการบันทึกผลไม่มาตามนัดใช่ไหม? ระบบจะแจ้งผู้ป่วยและไม่สร้างคำแนะนำทางคลินิก"
    );
    expect(result.prevented).toBe(true);
    expect(workflowMocks.dispatch).not.toHaveBeenCalled();
  });
});
