import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { FooterNav } from "@/components/navigation/FooterNav";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { SafeArea } from "@/components/ui/SafeArea";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StitchedScreenPlaceholder } from "@/components/ui/StitchedScreenPlaceholder";

const mockedPathname = vi.hoisted(() => ({
  value: "/consult"
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname.value
}));

const TestGlassSurface = GlassSurface as ComponentType<{
  className?: string;
  children?: ReactNode;
}>;

const TestStatusBadge = StatusBadge as ComponentType<{
  tone?: "neutral" | "success" | "warning" | "danger";
  children?: ReactNode;
}>;

const TestSafeArea = SafeArea as ComponentType<{
  as?: "div" | "main" | "section";
  top?: boolean;
  bottom?: boolean;
  horizontal?: boolean;
  className?: string;
  children?: ReactNode;
}>;

const TestScreen = Screen as ComponentType<{
  className?: string;
  children?: ReactNode;
}>;

function render(component: ReactElement) {
  return renderToStaticMarkup(component);
}

describe("Stitch UI primitives", () => {
  beforeEach(() => {
    mockedPathname.value = "/consult";
  });

  it("renders glass surfaces with the shared Stitch glass treatment and custom spacing", () => {
    const html = render(createElement(TestGlassSurface, { className: "p-4" }, "Clinical card"));

    expect(html).toContain("Clinical card");
    expect(html).toContain("rounded-card");
    expect(html).toContain("bg-glass");
    expect(html).toContain("shadow-glass");
    expect(html).toContain("backdrop-blur-glass");
    expect(html).toContain("p-4");
  });

  it("maps status badge tones to the expected semantic token classes", () => {
    expect(render(createElement(TestStatusBadge, null, "Queued"))).toContain("bg-surface");
    expect(render(createElement(TestStatusBadge, { tone: "success" }, "Verified"))).toContain("text-success");
    expect(render(createElement(TestStatusBadge, { tone: "warning" }, "Pending"))).toContain("text-warning");
    expect(render(createElement(TestStatusBadge, { tone: "danger" }, "Rejected"))).toContain("text-danger");
  });

  it("renders screen and safe-area primitives with mobile-safe layout classes", () => {
    const screenHtml = render(createElement(TestScreen, { className: "gap-5" }, "Consult screen"));
    const safeAreaHtml = render(
      createElement(TestSafeArea, { as: "main", top: true, className: "max-w-mobile" }, "Safe content")
    );

    expect(screenHtml).toContain("Consult screen");
    expect(screenHtml).toContain("flex");
    expect(screenHtml).toContain("min-h-full");
    expect(screenHtml).toContain("gap-5");
    expect(safeAreaHtml).toContain("<main");
    expect(safeAreaHtml).toContain("pt-[env(safe-area-inset-top)]");
    expect(safeAreaHtml).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(safeAreaHtml).toContain("max-w-mobile");
  });

  it("keeps the final customer footer labels and marks nested routes active", () => {
    mockedPathname.value = "/store/orders";

    const html = render(createElement(FooterNav));

    expect(html).toContain("Consult");
    expect(html).toContain("Store");
    expect(html).toContain("Community");
    expect(html).toContain("Profile");
    expect(html).toContain('href="/store"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("text-primary");
  });

  it("keeps live consultation focused by hiding footer navigation", () => {
    mockedPathname.value = "/consult/live";

    const html = render(createElement(AppShell, null, createElement("p", null, "Live room")));

    expect(html).toContain("Live room");
    expect(html).not.toContain('aria-label="Primary"');
    expect(html).toContain("pb-0");
  });

  it("composes placeholder screens from shared glass and badge primitives", () => {
    const html = render(
      createElement(StitchedScreenPlaceholder, {
        eyebrow: "Consult",
        title: "Clinical queue",
        description: "Operational placeholder for a reviewed Stitch flow.",
        statusItems: ["Doctor list", "Booking"]
      })
    );

    expect(html).toContain("Clinical queue");
    expect(html).toContain("Stitch navigation plan");
    expect(html).toContain("Doctor list");
    expect(html).toContain("Booking");
    expect(html).toContain("bg-glass");
    expect(html).toContain("text-warning");
  });
});
