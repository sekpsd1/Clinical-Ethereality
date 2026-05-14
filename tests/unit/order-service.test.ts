import { describe, expect, it } from "vitest";
import { assertOrderFulfillmentTransition, getOrderFulfillmentTransition } from "@/features/orders/service";

describe("order fulfillment service", () => {
  it.each([
    ["mark_preparing", "paid", "preparing"],
    ["mark_shipped", "preparing", "shipped"],
    ["mark_delivered", "shipped", "delivered"]
  ] as const)("maps %s from %s to %s", (action, from, to) => {
    expect(getOrderFulfillmentTransition(action)).toMatchObject({
      from,
      to
    });
    expect(assertOrderFulfillmentTransition(from, action)).toMatchObject({
      from,
      to
    });
  });

  it("rejects invalid fulfillment jumps", () => {
    expect(() => assertOrderFulfillmentTransition("pending_payment", "mark_shipped")).toThrow(
      "Order must be preparing before it can move to shipped."
    );
  });
});
