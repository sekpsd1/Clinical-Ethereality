import { cn } from "@/lib/design-system/variants";

export function GlassSurface({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-card border border-border bg-glass shadow-glass backdrop-blur-glass", className)}>
      {children}
    </div>
  );
}
