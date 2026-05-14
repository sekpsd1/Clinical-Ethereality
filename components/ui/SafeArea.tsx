import { cn } from "@/lib/design-system/variants";

type SafeAreaElement = "div" | "main" | "section";

type SafeAreaProps = {
  as?: SafeAreaElement;
  top?: boolean;
  bottom?: boolean;
  horizontal?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function SafeArea({
  as: Component = "div",
  top = false,
  bottom = true,
  horizontal = true,
  className,
  children
}: SafeAreaProps) {
  return (
    <Component
      className={cn(
        top && "pt-[env(safe-area-inset-top)]",
        bottom && "pb-[env(safe-area-inset-bottom)]",
        horizontal && "px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
        className
      )}
    >
      {children}
    </Component>
  );
}
