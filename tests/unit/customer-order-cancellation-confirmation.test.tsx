import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cancellationMocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  confirm: vi.fn(),
  useActionState: vi.fn()
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: cancellationMocks.useActionState
  };
});

import { CustomerOrderCancellation } from "@/features/orders/CustomerOrderCancellation";
import { cancelCustomerOrderAction } from "@/features/orders/actions";

type CancellationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  onSubmit: (event: { preventDefault: () => void }) => void;
};

function findCancellationForm(node: ReactNode): ReactElement<CancellationFormProps> {
  for (const child of Children.toArray(node)) {
    if (!isValidElement(child)) {
      continue;
    }

    const element = child as ReactElement<{ children?: ReactNode }>;

    if (element.type === "form") {
      return element as ReactElement<CancellationFormProps>;
    }

    try {
      return findCancellationForm(element.props.children);
    } catch {
      // Continue looking through sibling elements.
    }
  }

  throw new Error("Customer order cancellation form was not rendered");
}

async function submitForm(form: ReactElement<CancellationFormProps>) {
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

describe("Customer order cancellation confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancellationMocks.useActionState.mockReturnValue([
      { status: "idle", message: "" },
      cancellationMocks.dispatch,
      false
    ]);
    vi.stubGlobal("window", { confirm: cancellationMocks.confirm });
  });

  it("prevents submission and does not dispatch the Server Action when confirmation is rejected", async () => {
    cancellationMocks.confirm.mockReturnValue(false);
    const form = findCancellationForm(
      CustomerOrderCancellation({ orderId: "order-1", orderCode: "CE-ORDER-1" })
    );

    const result = await submitForm(form);

    expect(cancellationMocks.useActionState).toHaveBeenCalledWith(
      cancelCustomerOrderAction,
      { status: "idle", message: "" }
    );
    expect(cancellationMocks.confirm).toHaveBeenCalledWith(
      "ยืนยันยกเลิกคำสั่งซื้อ CE-ORDER-1 ใช่ไหม?"
    );
    expect(result.prevented).toBe(true);
    expect(cancellationMocks.dispatch).not.toHaveBeenCalled();
  });

  it("dispatches the Server Action exactly once when confirmation is accepted", async () => {
    cancellationMocks.confirm.mockReturnValue(true);
    const form = findCancellationForm(
      CustomerOrderCancellation({ orderId: "order-1", orderCode: "CE-ORDER-1" })
    );

    const result = await submitForm(form);

    expect(result.prevented).toBe(false);
    expect(cancellationMocks.dispatch).toHaveBeenCalledTimes(1);
  });
});
