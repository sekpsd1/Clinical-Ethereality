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
  attendance: Pick<DoctorConsultationItem, "attendance">["attendance"] = {
    label: "Zoom ยืนยันผู้เข้าร่วมครบแล้ว",
    description: "พร้อมจบการปรึกษา",
    tone: "success",
    normalCompletionEligible: true,
    noShowCompletionEligible: false,
    noShowRemainingSeconds: null
  }
) {
  return {
    id: "consultation-1",
    status,
    summary: null,
    attendance,
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

  it("shows an immediate room route after a successful start", () => {
    workflowMocks.useActionState.mockReturnValue([
      {
        status: "success",
        message: "เริ่มการปรึกษาและสร้างห้อง Zoom แล้ว",
        roomHref: "/consult/live?consultation=consultation-1"
      },
      workflowMocks.dispatch,
      false
    ]);

    const html = renderToStaticMarkup(
      <DoctorConsultationControls consultation={consultation("scheduled")} />
    );

    expect(html).toContain("เข้าห้องปรึกษา/Zoom ตอนนี้");
    expect(html).toContain("/consult/live?consultation=consultation-1");
    expect(html).not.toContain(">เริ่มการปรึกษา</button>");
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

  it("hides completion actions until server attendance evidence is eligible", () => {
    workflowMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      workflowMocks.dispatch,
      false
    ]);
    const html = renderToStaticMarkup(
      <DoctorConsultationControls
        consultation={consultation("live", {
          label: "Zoom ยืนยันแพทย์แล้ว • รอผู้ป่วย",
          description: "ต้องรอต่อเนื่องอีกประมาณ 8 นาที",
          tone: "warning",
          normalCompletionEligible: false,
          noShowCompletionEligible: false,
          noShowRemainingSeconds: 480
        })}
      />
    );

    expect(html).toContain("รอผู้ป่วย");
    expect(html).not.toContain("ยืนยันจบการปรึกษา");
    expect(html).not.toContain("ยืนยันไม่มาตามนัด");
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
          label: "ยืนยันเวลารอครบ 10 นาทีแล้ว",
          description: "พร้อมบันทึกผลไม่มาตามนัด",
          tone: "warning",
          normalCompletionEligible: false,
          noShowCompletionEligible: true,
          noShowRemainingSeconds: 0
        })}
      />
    );

    expect(html).toContain("customer_did_not_join");
    expect(html).toContain("ยืนยันไม่มาตามนัด");
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
          label: "ยืนยันเวลารอครบ 10 นาทีแล้ว",
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
