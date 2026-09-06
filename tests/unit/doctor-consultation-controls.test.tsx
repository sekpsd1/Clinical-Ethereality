import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DoctorConsultationItem } from "@/features/doctor/consultations/types";

const workflowMocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  dispatch: vi.fn(),
  useActionState: vi.fn()
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: workflowMocks.useActionState
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

function consultation(status: "scheduled" | "live") {
  return {
    id: "consultation-1",
    status,
    summary: null
  } satisfies Pick<DoctorConsultationItem, "id" | "status" | "summary">;
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
    vi.stubGlobal("window", { confirm: workflowMocks.confirm });
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
});
