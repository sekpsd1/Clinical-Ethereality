import { cn } from "@/lib/design-system/variants";

type ScreenProps = {
  className?: string;
  children: React.ReactNode;
};

export function Screen({ className, children }: ScreenProps) {
  return <section className={cn("flex min-h-full flex-1 flex-col", className)}>{children}</section>;
}
