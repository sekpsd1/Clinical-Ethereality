import Link from "next/link";
import { Boxes, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/design-system/variants";

const productTabs = [
  {
    id: "catalog",
    href: "/admin/products",
    label: "แคตตาล็อกสินค้า",
    icon: LayoutGrid
  },
  {
    id: "inventory",
    href: "/admin/inventory",
    label: "สต็อกสินค้า",
    icon: Boxes
  }
] as const;

export function AdminProductTabs({ active }: { active: (typeof productTabs)[number]["id"] }) {
  return (
    <nav aria-label="จัดการสินค้า" className="grid grid-cols-2 rounded-[8px] border border-border bg-white/80 p-1 shadow-payment-card">
      {productTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-[7px] px-3 text-xs font-bold transition-colors sm:text-sm",
              isActive ? "bg-primary text-white shadow-chip" : "text-muted hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={2.1} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
