import { describe, expect, it } from "vitest";
import { resolveCustomerNotificationHref } from "@/features/notifications/queries";

describe("customer notification routing", () => {
  it("preserves the customer order list destination from order and payment metadata", () => {
    for (const type of ["order", "payment"] as const) {
      expect(
        resolveCustomerNotificationHref({
          type,
          metadataJson: {
            href: "/store/orders"
          }
        })
      ).toBe("/store/orders");
    }
  });

  it("routes legacy payment-success and unknown payment destinations to the owned order list", () => {
    expect(
      resolveCustomerNotificationHref({
        type: "payment",
        metadataJson: {
          href: "/store/payment-success"
        }
      })
    ).toBe("/store/orders");

    expect(
      resolveCustomerNotificationHref({
        type: "payment",
        metadataJson: {
          href: "https://malicious.example"
        }
      })
    ).toBe("/store/orders");
  });

  it("routes reward notifications to the customer rewards page", () => {
    expect(
      resolveCustomerNotificationHref({
        type: "reward",
        metadataJson: {
          href: "/profile/rewards"
        }
      })
    ).toBe("/profile/rewards");

    expect(
      resolveCustomerNotificationHref({
        type: "reward",
        metadataJson: {
          href: "https://malicious.example"
        }
      })
    ).toBe("/profile/rewards");
  });
});
