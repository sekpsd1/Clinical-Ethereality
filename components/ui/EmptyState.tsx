import type { ReactNode } from "react";
import { cn } from "@/lib/design-system/variants";

type EmptyStateProps = {
  title: string;
  body: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, body, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-border bg-surface/75 px-4 py-6 text-center shadow-chip",
        className
      )}
    >
      {icon ? <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div> : null}
      <h2 className="text-section font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
