import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { FooterNav } from "@/components/navigation/FooterNav";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { Button } from "@/components/ui/Button";
import { CommunityPostCard } from "@/components/ui/CommunityPostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { IconButton } from "@/components/ui/IconButton";
import { NotificationItem } from "@/components/ui/NotificationItem";
import { OrderTrackingTimeline } from "@/components/ui/OrderTrackingTimeline";
import { PaymentStatusBadge } from "@/components/ui/PaymentStatusBadge";
import { ProfileSettingsItem } from "@/components/ui/ProfileSettingsItem";
import { SafeArea } from "@/components/ui/SafeArea";
import { Screen } from "@/components/ui/Screen";
import { SearchField } from "@/components/ui/SearchField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StitchedScreenPlaceholder } from "@/components/ui/StitchedScreenPlaceholder";
import { TextField } from "@/components/ui/TextField";

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

const TestButton = Button as ComponentType<{
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}>;

const TestIconButton = IconButton as ComponentType<{
  label: string;
  icon: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}>;

const TestTextField = TextField as ComponentType<{
  id?: string;
  name?: string;
  label: string;
  placeholder?: string;
  hint?: string;
  error?: string;
}>;

const TestSearchField = SearchField as ComponentType<{
  id?: string;
  name?: string;
  label: string;
  placeholder?: string;
}>;

const TestEmptyState = EmptyState as ComponentType<{
  title: string;
  body: string;
  icon?: ReactNode;
  action?: ReactNode;
}>;

const TestPaymentStatusBadge = PaymentStatusBadge as ComponentType<{
  status: "pending_slip" | "pending_review" | "verified" | "rejected" | "refunded" | "no_payment_record" | null;
  label?: string;
}>;

const TestOrderTrackingTimeline = OrderTrackingTimeline as ComponentType<{
  steps: Array<{
    title: string;
    description: string | null;
    status: "done" | "active" | "pending";
  }>;
  className?: string;
}>;

const TestNotificationItem = NotificationItem as ComponentType<{
  title: string;
  body: string;
  time: string;
  kind: "system" | "consultation" | "order" | "payment" | "prescription" | "community" | "reward" | "promo";
  unread: boolean;
  href: string;
}>;

const TestProfileSettingsItem = ProfileSettingsItem as ComponentType<{
  label: string;
  icon: ComponentType<{ className?: string; fill?: string }>;
  iconFill?: string;
}>;

const TestArticleCard = ArticleCard as ComponentType<{
  title: string;
  eyebrow: string;
  author: string;
  likes: string;
  date: string;
  imageSrc: string;
  imageAlt: string;
  badge?: string;
  badgeTone?: "light" | "teal";
  icon: "verified" | "review" | "medical";
  authorIcon: "person" | "account" | "medical";
  href?: string;
}>;

const TestCommunityPostCard = CommunityPostCard as ComponentType<{
  author: string;
  time: string;
  body: string;
  likes: string;
  comments: string;
  liked?: boolean;
  portrait: "ananya" | "somchai";
  href?: string;
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

  it("renders button primitives with Stitch control radius, variants, labels, and disabled states", () => {
    const buttonHtml = render(
      createElement(TestButton, { type: "submit", variant: "primary", size: "lg", disabled: true }, "Submit request")
    );
    const iconButtonHtml = render(
      createElement(TestIconButton, {
        label: "Open settings",
        icon: createElement("span", { "aria-hidden": true }, "S"),
        variant: "secondary"
      })
    );

    expect(buttonHtml).toContain('type="submit"');
    expect(buttonHtml).toContain("rounded-control");
    expect(buttonHtml).toContain("bg-primary");
    expect(buttonHtml).toContain("min-h-12");
    expect(buttonHtml).toContain("disabled");
    expect(iconButtonHtml).toContain('aria-label="Open settings"');
    expect(iconButtonHtml).toContain('title="Open settings"');
    expect(iconButtonHtml).toContain("rounded-full");
    expect(iconButtonHtml).toContain("size-10");
  });

  it("renders text and search fields with accessible labels and validation messaging", () => {
    const textFieldHtml = render(
      createElement(TestTextField, {
        id: "license",
        name: "license",
        label: "License number",
        placeholder: "Enter license",
        hint: "Shown to admins only",
        error: "Required"
      })
    );
    const searchFieldHtml = render(
      createElement(TestSearchField, {
        id: "community-search",
        label: "Search community",
        placeholder: "Search"
      })
    );

    expect(textFieldHtml).toContain('for="license"');
    expect(textFieldHtml).toContain('aria-invalid="true"');
    expect(textFieldHtml).toContain('aria-describedby="license-hint license-error"');
    expect(textFieldHtml).toContain("border-danger");
    expect(textFieldHtml).toContain("Shown to admins only");
    expect(searchFieldHtml).toContain('type="search"');
    expect(searchFieldHtml).toContain('aria-label="Search community"');
    expect(searchFieldHtml).toContain("sr-only");
    expect(searchFieldHtml).toContain("focus-within:border-primary");
  });

  it("renders empty states with optional icon and action slots", () => {
    const html = render(
      createElement(TestEmptyState, {
        title: "No orders yet",
        body: "Order tracking will appear here.",
        icon: createElement("span", { "aria-hidden": true }, "!"),
        action: createElement(TestButton, { variant: "secondary" }, "Browse store")
      })
    );

    expect(html).toContain("No orders yet");
    expect(html).toContain("Order tracking will appear here.");
    expect(html).toContain("Browse store");
    expect(html).toContain("border-dashed");
    expect(html).toContain("bg-primary/10");
  });

  it("maps payment statuses to semantic badges", () => {
    expect(render(createElement(TestPaymentStatusBadge, { status: "verified" }))).toContain("text-success");
    expect(render(createElement(TestPaymentStatusBadge, { status: "pending_review" }))).toContain("text-warning");
    expect(render(createElement(TestPaymentStatusBadge, { status: "rejected" }))).toContain("text-danger");
    expect(render(createElement(TestPaymentStatusBadge, { status: null, label: "No payment" }))).toContain("No payment");
  });

  it("renders order tracking timeline states from shared rows", () => {
    const html = render(
      createElement(TestOrderTrackingTimeline, {
        className: "pt-6",
        steps: [
          { title: "Order received", description: "Today", status: "done" },
          { title: "Payment review", description: "Waiting", status: "active" },
          { title: "Shipment", description: null, status: "pending" }
        ]
      })
    );

    expect(html).toContain("Order received");
    expect(html).toContain("Payment review");
    expect(html).toContain("Shipment");
    expect(html).toContain("bg-primary");
    expect(html).toContain("animate-pulse");
    expect(html).toContain("bg-[#e6e8ea]");
    expect(html).toContain("pt-6");
  });

  it("renders notification items with unread treatment and route links", () => {
    const unreadHtml = render(
      createElement(TestNotificationItem, {
        title: "Payment received",
        body: "Your slip is being reviewed.",
        time: "Now",
        kind: "payment",
        unread: true,
        href: "/store/orders"
      })
    );
    const readHtml = render(
      createElement(TestNotificationItem, {
        title: "Community update",
        body: "A post received a comment.",
        time: "Yesterday",
        kind: "community",
        unread: false,
        href: "/community"
      })
    );

    expect(unreadHtml).toContain('href="/store/orders"');
    expect(unreadHtml).toContain("Payment received");
    expect(unreadHtml).toContain("from-primary/30");
    expect(unreadHtml).toContain("lucide-stethoscope");
    expect(readHtml).toContain('href="/community"');
    expect(readHtml).toContain("Community update");
    expect(readHtml).toContain("hover:bg-white/80");
  });

  it("renders profile settings rows with icon and chevron affordance", () => {
    function TestIcon({ className, fill }: { className?: string; fill?: string }) {
      return createElement("svg", { className, fill, "aria-hidden": true });
    }

    const html = render(createElement(TestProfileSettingsItem, { label: "Shipping addresses", icon: TestIcon, iconFill: "#006067" }));

    expect(html).toContain("Shipping addresses");
    expect(html).toContain("min-h-[118px]");
    expect(html).toContain("bg-[#e8fbf7]");
    expect(html).toContain('fill="#006067"');
    expect(html).toContain("lucide-chevron-right");
  });

  it("renders article cards with Stitch media, metadata, and optional route links", () => {
    const html = render(
      createElement(TestArticleCard, {
        title: "Vitamin guide",
        eyebrow: "Medical Article",
        author: "Dr. Arisara",
        likes: "1.2k",
        date: "Oct 24",
        imageSrc: "/images/community/vitamin-bottles.png",
        imageAlt: "Amber vitamin supplement bottles",
        badge: "Recommended",
        icon: "verified",
        authorIcon: "person",
        href: "/community/vitamin-c-tips"
      })
    );

    expect(html).toContain('href="/community/vitamin-c-tips"');
    expect(html).toContain("Vitamin guide");
    expect(html).toContain("Medical Article");
    expect(html).toContain("Recommended");
    expect(html).toContain("lucide-badge-check");
    expect(html).toContain("rounded-[24px]");
  });

  it("renders community post cards with member portrait, metrics, and liked state", () => {
    const html = render(
      createElement(TestCommunityPostCard, {
        author: "K. Ananya",
        time: "2 hours ago",
        body: "Shared wellness routine",
        likes: "342",
        comments: "56",
        liked: true,
        portrait: "ananya",
        href: "/community/vitamin-c-tips"
      })
    );

    expect(html).toContain('href="/community/vitamin-c-tips"');
    expect(html).toContain("K. Ananya");
    expect(html).toContain("Shared wellness routine");
    expect(html).toContain("342");
    expect(html).toContain("56");
    expect(html).toContain('fill="#006067"');
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
