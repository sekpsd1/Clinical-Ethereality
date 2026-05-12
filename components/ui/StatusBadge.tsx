import { cn } from "@/lib/design-system/variants";

const toneClasses = {
  neutral: "bg-surface text-muted ring-border",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-danger/10 text-danger ring-danger/25"
};

export function StatusBadge({
  tone = "neutral",
  children
}: {
  tone?: keyof typeof toneClasses;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-badge px-2.5 py-1 text-label font-semibold ring-1", toneClasses[tone])}>
      {children}
    </span>
  );
}
