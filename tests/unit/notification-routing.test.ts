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

  it("allows only internal dynamic community destinations", () => {
    expect(
      resolveCustomerNotificationHref({
        type: "community",
        metadataJson: {
          href: "/community/member-wellness-post"
        }
      })
    ).toBe("/community/member-wellness-post");

    expect(
      resolveCustomerNotificationHref({
        type: "community",
        metadataJson: {
          href: "https://malicious.example/community/post"
        }
      })
    ).toBe("/community");
  });

  it("preserves an exact internal live-consultation destination with an opaque id", () => {
    expect(
      resolveCustomerNotificationHref({
        type: "consultation",
        metadataJson: {
          href: "/consult/live?consultation=cmf8p4w7h0001qz6x9k2v3abc"
        }
      })
    ).toBe("/consult/live?consultation=cmf8p4w7h0001qz6x9k2v3abc");
  });

  it("rejects malformed or expanded live-consultation destinations", () => {
    const unsafeHrefs = [
      "https://malicious.example/consult/live?consultation=cmf8p4w7h0001qz6x9k2v3abc",
      "//malicious.example/consult/live?consultation=cmf8p4w7h0001qz6x9k2v3abc",
      "/consult/live?consultation=",
      "/consult/live?consultation=cmf8p4w7h0001qz6x9k2v3abc&next=/store",
      "/consult/live?consultation=cmf8p4w7h0001qz6x9k2v3abc#details",
      "/consult/live?consultation=../../admin",
      "/consult/live/extra?consultation=cmf8p4w7h0001qz6x9k2v3abc"
    ];

    for (const href of unsafeHrefs) {
      expect(
        resolveCustomerNotificationHref({
          type: "consultation",
          metadataJson: { href }
        })
      ).toBe("/consult/advice-log");
    }
  });

  it("keeps the legacy consultation advice destination unchanged", () => {
    expect(
      resolveCustomerNotificationHref({
        type: "consultation",
        metadataJson: {
          href: "/consult/advice-log"
        }
      })
    ).toBe("/consult/advice-log");
  });
});
